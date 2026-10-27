import { ArrowDown, ArrowRight, Check, CheckCircle2, KeyRound, LockKeyhole, RefreshCw, Scale, Search, Send } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { money } from '../lib'
import type { Account, AccountLookup, LedgerTransaction } from '../types'

export function TransferPage({ token, accounts, onComplete }: { token: string; accounts: Account[]; onComplete: (transaction: LedgerTransaction) => void }) {
  const [sourceId, setSourceId] = useState(accounts[0]?.id ?? '')
  const [destinationNumber, setDestinationNumber] = useState('TV-BOB-001')
  const [destination, setDestination] = useState<AccountLookup | null>(null)
  const [amount, setAmount] = useState('500.00')
  const [reference, setReference] = useState('Wallet transfer')
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const source = accounts.find(account => account.id === sourceId)
  const validAmount = Number(amount) > 0

  useEffect(() => { if (!sourceId && accounts[0]) setSourceId(accounts[0].id) }, [accounts, sourceId])

  async function lookup() {
    if (!destinationNumber.trim()) return
    setError('')
    setDestination(null)
    setLookupLoading(true)
    try { setDestination(await api.lookup(token, destinationNumber)) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Destination lookup failed') }
    finally { setLookupLoading(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!destination) { setError('Verify the destination before posting the transfer.'); return }
    if (sourceId === destination.id) { setError('Source and destination accounts must be different.'); return }
    setPosting(true)
    try {
      const result = await api.transfer(token, key, { sourceAccountId: sourceId, destinationAccountId: destination.id, amount, reference })
      setKey(crypto.randomUUID())
      onComplete(result)
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Transfer could not be posted') }
    finally { setPosting(false) }
  }

  return <div className="mx-auto max-w-6xl">
    <header className="reveal flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><div className="eyebrow">Atomic money movement</div><h1 className="mt-4 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">Create a transfer.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#858a9a]">Verify both sides, then post one retry-safe transaction. The debit and credit commit together.</p></div>
      <div className="flex items-center gap-2 rounded-full border border-[#56dfc2]/12 bg-[#56dfc2]/[.045] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#78ead5]"><LockKeyhole size={13} />Protected by row locks</div>
    </header>

    <div className="reveal reveal-delay-1 mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-start">
      <form onSubmit={submit} className="panel overflow-hidden">
        <div className="flex items-center gap-1 border-b border-white/[.06] px-5 py-4 sm:px-7">
          <Step number="01" label="Accounts" active />
          <span className="mx-2 h-px flex-1 bg-white/[.07]" />
          <Step number="02" label="Details" active={validAmount} />
          <span className="mx-2 h-px flex-1 bg-white/[.07]" />
          <Step number="03" label="Post" active={Boolean(destination && validAmount)} />
        </div>

        <div className="space-y-7 p-5 sm:p-7">
          <section>
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-extrabold">Choose both accounts</h2><p className="mt-1 text-xs text-[#626675]">Funds leave an account you own and enter a verified wallet.</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#9e8fff]/10 text-[#b9afff]"><Scale size={16} /></span></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="source">From</label><select id="source" className="input" value={sourceId} onChange={event => setSourceId(event.target.value)} required>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.accountNumber}</option>)}</select>{source ? <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.025] px-3.5 py-3 text-xs"><span className="text-[#686d7b]">Available balance</span><strong>{money(source.balance, source.currency)}</strong></div> : null}</div>
              <div><label className="label" htmlFor="destination">Destination account</label><div className="flex gap-2"><input id="destination" className="input font-mono uppercase" value={destinationNumber} onChange={event => { setDestinationNumber(event.target.value.toUpperCase()); setDestination(null) }} placeholder="TV-ACCOUNT-NUMBER" required /><button className="icon-button !h-[50px] !w-[50px] shrink-0" type="button" onClick={lookup} disabled={lookupLoading} aria-label="Verify destination">{lookupLoading ? <RefreshCw size={17} className="animate-spin" /> : <Search size={17} />}</button></div>{destination ? <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[#56dfc2]/12 bg-[#56dfc2]/[.05] px-3.5 py-3 text-xs text-[#9af2e2]"><CheckCircle2 size={15} /><span className="min-w-0 truncate"><strong>{destination.name}</strong> · {destination.status}</span></div> : <div className="mt-2.5 text-[10px] text-[#555a68]">Verify the account number before continuing.</div>}</div>
            </div>
          </section>

          <div className="h-px bg-white/[.06]" />

          <section>
            <div className="mb-4"><h2 className="text-sm font-extrabold">Transfer details</h2><p className="mt-1 text-xs text-[#626675]">Amounts accept at most two decimal places and are never silently rounded.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="amount">Amount</label><div className="relative"><span className="absolute left-4 top-[13px] text-sm font-bold text-[#777c8a]">₹</span><input id="amount" className="input !pl-8 text-base font-extrabold" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></div><div className="mt-2 flex gap-2">{['500.00', '1000.00', '2500.00'].map(value => <button key={value} type="button" onClick={() => setAmount(value)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${amount === value ? 'border-[#9e8fff]/30 bg-[#9e8fff]/10 text-[#b9afff]' : 'border-white/[.06] text-[#666b79] hover:bg-white/[.04]'}`}>₹{Number(value).toLocaleString('en-IN')}</button>)}</div></div>
              <div><label className="label" htmlFor="reference">Reference</label><input id="reference" className="input" maxLength={140} value={reference} onChange={event => setReference(event.target.value)} placeholder="What is this transfer for?" /><div className="mt-2 text-right font-mono text-[9px] text-[#4f5361]">{reference.length} / 140</div></div>
            </div>
          </section>

          {error ? <div role="alert" className="rounded-[14px] border border-rose-300/15 bg-rose-300/[.07] px-4 py-3 text-sm text-rose-200">{error}</div> : null}
        </div>

        <div className="border-t border-white/[.06] bg-black/[.12] p-5 sm:px-7">
          <details className="group mb-4 rounded-[14px] border border-white/[.06] bg-white/[.02] px-3.5 py-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-bold text-[#858a9a]"><KeyRound size={14} className="text-[#aaa0ff]" />Retry protection details<ArrowRight size={12} className="ml-auto transition group-open:rotate-90" /></summary><div className="mt-3 break-all border-t border-white/[.05] pt-3 font-mono text-[9px] leading-5 text-[#555a68]">Idempotency-Key · {key}</div></details>
          <button className="btn-primary w-full" disabled={posting || !sourceId || !destination || !validAmount}>{posting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#100d22]/25 border-t-[#100d22]" />Locking accounts & posting entries…</> : <><Send size={16} />Post balanced transfer<ArrowRight size={16} /></>}</button>
        </div>
      </form>

      <aside className="panel sticky top-[94px] overflow-hidden">
        <div className="border-b border-white/[.06] px-5 py-5 sm:px-6"><div className="eyebrow">Live posting preview</div><h2 className="mt-2 text-lg font-extrabold">One amount. Two entries.</h2></div>
        <div className="p-5 sm:p-6">
          <EntryPreview label="Debit" account={source?.accountNumber ?? 'Choose source'} name={source?.name ?? 'Source wallet'} amount={validAmount ? money(amount, source?.currency) : '₹0.00'} tone="violet" />
          <div className="relative flex h-16 items-center justify-center"><span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-[#9e8fff]/50 to-[#56dfc2]/50" /><span className="relative grid h-8 w-8 place-items-center rounded-full border border-white/[.08] bg-[#0c0f17] text-[#858a9a]"><ArrowDown size={14} /></span></div>
          <EntryPreview label="Credit" account={destination?.accountNumber ?? (destinationNumber || 'Verify destination')} name={destination?.name ?? 'Destination wallet'} amount={validAmount ? money(amount, destination?.currency ?? source?.currency) : '₹0.00'} tone="mint" />
          <div className="mt-5 rounded-[15px] border border-white/[.06] bg-white/[.025] p-4">
            <div className="flex items-center justify-between text-xs"><span className="text-[#686d7b]">Ledger difference</span><strong className="text-[#78ead5]">₹0.00</strong></div>
            <div className="mt-3 h-0.5 w-full rounded-full balance-flow" />
            <div className="mt-3 flex items-center gap-2 text-[10px] leading-4 text-[#686d7b]"><Check size={13} className="text-[#67e5ce]" />Debit total will equal credit total at commit.</div>
          </div>
        </div>
      </aside>
    </div>
  </div>
}

function Step({ number, label, active }: { number: string; label: string; active: boolean }) {
  return <span className={`flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.12em] transition ${active ? 'text-[#c7c2e8]' : 'text-[#454956]'}`}><i className={`grid h-6 w-6 place-items-center rounded-lg font-mono not-italic ${active ? 'bg-[#9e8fff]/12 text-[#aaa0ff]' : 'bg-white/[.03]'}`}>{number}</i><span className="hidden sm:inline">{label}</span></span>
}

function EntryPreview({ label, account, name, amount, tone }: { label: string; account: string; name: string; amount: string; tone: 'violet' | 'mint' }) {
  return <div className={`relative overflow-hidden rounded-[18px] border p-4 ${tone === 'violet' ? 'border-[#9e8fff]/16 bg-[#9e8fff]/[.06]' : 'border-[#56dfc2]/16 bg-[#56dfc2]/[.055]'}`}><span className={`absolute right-[-24px] top-[-30px] h-24 w-24 rounded-full blur-2xl ${tone === 'violet' ? 'bg-[#9e8fff]/15' : 'bg-[#56dfc2]/15'}`} /><div className="relative flex items-start justify-between gap-3"><div><div className={`text-[9px] font-extrabold uppercase tracking-[.18em] ${tone === 'violet' ? 'text-[#b9afff]' : 'text-[#78ead5]'}`}>{label} entry</div><div className="mt-2 text-sm font-bold">{name}</div><div className="mt-1 max-w-[180px] truncate font-mono text-[9px] text-[#626675]">{account}</div></div><div className="text-base font-extrabold">{amount}</div></div></div>
}
