#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

const flags = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => {
  if (!arg.startsWith('--')) return [arg, true]
  const [name, inline] = arg.slice(2).split('=', 2)
  return [name, inline ?? (all[index + 1]?.startsWith('--') ? true : all[index + 1])]
}))

const config = {
  mode: String(flags.mode ?? 'throughput'),
  baseUrl: String(flags.baseUrl ?? process.env.TALLYVAULT_URL ?? 'http://localhost:8080'),
  email: process.env.TALLYVAULT_EMAIL ?? 'alice@tallyvault.dev',
  password: process.env.TALLYVAULT_PASSWORD ?? 'Alice123!',
  destination: process.env.TALLYVAULT_DESTINATION ?? 'TV-BOB-001',
  requests: Number(flags.requests ?? 100),
  concurrency: Number(flags.concurrency ?? 10),
  amount: String(flags.amount ?? '0.01'),
  output: flags.output ? String(flags.output) : undefined,
}

if (!['throughput', 'idempotency', 'overspend'].includes(config.mode)) {
  throw new Error('--mode must be throughput, idempotency, or overspend')
}
if (!Number.isInteger(config.requests) || config.requests < 1) throw new Error('--requests must be a positive integer')
if (!Number.isInteger(config.concurrency) || config.concurrency < 1) throw new Error('--concurrency must be a positive integer')

async function api(path, options = {}) {
  const response = await fetch(`${config.baseUrl}${path}`, options)
  const text = await response.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status, ok: response.ok, body }
}

const login = await api('/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: config.email, password: config.password }),
})
if (!login.ok) throw new Error(`login failed (${login.status}): ${JSON.stringify(login.body)}`)
const auth = { Authorization: `Bearer ${login.body.token}` }
const own = await api('/accounts', { headers: auth })
if (!own.ok || !own.body.length) throw new Error('the benchmark user needs at least one account')
const source = own.body.find(account => account.status === 'ACTIVE') ?? own.body[0]
const lookup = await api(`/accounts/lookup?accountNumber=${encodeURIComponent(config.destination)}`, { headers: auth })
if (!lookup.ok) throw new Error(`destination lookup failed (${lookup.status})`)

function percentile(values, fraction) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)].toFixed(2))
}

async function postTransfer(index, key, amount) {
  const started = performance.now()
  try {
    const response = await api('/transfers', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({
        sourceAccountId: source.id,
        destinationAccountId: lookup.body.id,
        amount,
        reference: config.mode === 'idempotency'
          ? 'benchmark repeated idempotency request'
          : `benchmark ${config.mode} request ${index}`,
      }),
    })
    return { index, durationMs: performance.now() - started, status: response.status,
      transactionId: response.body?.transactionId, replayed: response.body?.replayed,
      errorCode: response.body?.code }
  } catch (error) {
    return { index, durationMs: performance.now() - started, status: 0, errorCode: String(error) }
  }
}

async function runBounded(tasks, concurrency) {
  const results = new Array(tasks.length)
  let cursor = 0
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++
      results[index] = await tasks[index]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

let amount = config.amount
let sharedKey
if (config.mode === 'idempotency') sharedKey = `bench-idempotency-${randomUUID()}`
if (config.mode === 'overspend') {
  const balance = await api(`/accounts/${source.id}/balance`, { headers: auth })
  if (!balance.ok) throw new Error('could not read starting balance')
  amount = (Number(balance.body.cachedBalance) * 0.6).toFixed(2)
  if (Number(amount) <= 0) throw new Error('overspend mode requires a positive source balance')
}

const tasks = Array.from({ length: config.requests }, (_, index) => () =>
  postTransfer(index, sharedKey ?? `bench-${config.mode}-${randomUUID()}`, amount))
const wallStart = performance.now()
const results = await runBounded(tasks, config.concurrency)
const wallMs = performance.now() - wallStart
const durations = results.map(result => result.durationMs)
const transactionIds = new Set(results.map(result => result.transactionId).filter(Boolean))
const finalBalance = await api(`/accounts/${source.id}/balance`, { headers: auth })

const report = {
  recordedAt: new Date().toISOString(),
  environment: { node: process.version, platform: `${process.platform}/${process.arch}`, baseUrl: config.baseUrl },
  workload: { mode: config.mode, requests: config.requests, concurrency: config.concurrency, amount,
    sourceAccount: source.accountNumber, destinationAccount: lookup.body.accountNumber },
  result: {
    successfulResponses: results.filter(result => result.status === 200 || result.status === 201).length,
    rejectedResponses: results.filter(result => result.status >= 400).length,
    transportFailures: results.filter(result => result.status === 0).length,
    distinctTransactionIds: transactionIds.size,
    replayedResponses: results.filter(result => result.replayed === true).length,
    throughputRequestsPerSecond: Number((config.requests / (wallMs / 1000)).toFixed(2)),
    latencyMs: { average: Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(2)),
      median: percentile(durations, 0.5), p95: percentile(durations, 0.95) },
    finalBalance: finalBalance.body ?? null,
    invalidBalance: !finalBalance.ok || Number(finalBalance.body.cachedBalance) < 0 || finalBalance.body.reconciled !== true,
    statusCounts: Object.fromEntries([...new Set(results.map(result => result.status))]
      .sort((a, b) => a - b).map(status => [status, results.filter(result => result.status === status).length])),
  },
}

const rendered = `${JSON.stringify(report, null, 2)}\n`
process.stdout.write(rendered)
if (config.output) {
  await mkdir(dirname(config.output), { recursive: true })
  await writeFile(config.output, rendered, 'utf8')
}
