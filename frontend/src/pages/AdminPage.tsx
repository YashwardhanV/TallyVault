import { Activity, CheckCircle2, Eye, PauseCircle, PlayCircle, RotateCcw, ShieldCheck, Snowflake, X } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { money, shortId, time } from '../lib'
import type { Account, LedgerTransaction } from '../types'

export function AdminPage({ token, onSelect }: { token: string; onSelect: (transaction: LedgerTransaction) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyAccount, setBusyAccount] = useState<string | null>(null)
  const [reversalTarget, setReversalTarget] = useState<LedgerTransaction | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [accountPage, transactionPage] = await Promise.all([api.adminAccounts(token), api.adminTransactions(token)])
      setAccounts(accountPage.content)
      setTransactions(transactionPage.content)
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Admin data could not be loaded') }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { void reload() }, [reload])

  async function toggle(account: Account) {
    setBusyAccount(account.id)
    setError('')
    try {
      const next = account.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE'
      await api.changeStatus(token, account.id, next)
      setMessage(`${account.name} is now ${next.toLowerCase()}.`)
      await reload()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Account state could not be changed') }
    finally { setBusyAccount(null) }
  }

  return <>
    <header className="reveal flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><div className="eyebrow">Authorized operations</div><h1 className="mt-4 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">Admin review desk.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#858a9a]">Review account state, inspect balanced entries, and post explicit compensating reversals without deleting history.</p></div>
      <span className="flex w-fit items-center gap-2 rounded-full border border-[#9e8fff]/15 bg-[#9e8fff]/[.07] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#b9afff]"><ShieldCheck size={13} />Admin permission</span>
    </header>

    <section className="reveal reveal-delay-1 mt-8 grid gap-4 sm:grid-cols-3">
      <AdminMetric icon={Activity} label="Tracked accounts" value={String(accounts.length)} />
      <AdminMetric icon={Snowflake} label="Frozen accounts" value={String(accounts.filter(account => account.status === 'FROZEN').length)} tone="amber" />
      <AdminMetric icon={CheckCircle2} label="Recent transactions" value={String(transactions.length)} tone="mint" />
    </section>

    {message ? <div role="status" className="reveal mt-6 flex items-center gap-2 rounded-[15px] border border-[#56dfc2]/12 bg-[#56dfc2]/[.05] px-4 py-3 text-sm text-[#9af2e2]"><CheckCircle2 size={16} />{message}<button onClick={() => setMessage('')} className="ml-auto text-[#67a89c] hover:text-white" aria-label="Dismiss message"><X size={14} /></button></div> : null}
    {error ? <div role="alert" className="reveal mt-6 flex items-center gap-2 rounded-[15px] border border-rose-300/15 bg-rose-300/[.07] px-4 py-3 text-sm text-rose-200">{error}<button onClick={() => setError('')} className="ml-auto text-rose-300/70 hover:text-white" aria-label="Dismiss error"><X size={14} /></button></div> : null}

    <section className="reveal reveal-delay-2 panel mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-5 sm:px-6"><div><h2 className="section-title">Account controls</h2><p className="mt-1 text-xs text-[#626675]">Freeze or restore transaction access</p></div><span className="eyebrow">{accounts.length} records</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-black/[.1] font-mono text-[8px] uppercase tracking-[.18em] text-[#4f5361]"><tr><th className="px-6 py-3.5">Account</th><th className="px-5 py-3.5">Balance</th><th className="px-5 py-3.5">State</th><th className="px-6 py-3.5 text-right">Control</th></tr></thead><tbody>
        {loading ? <TableSkeleton columns={4} /> : accounts.map(account => <tr key={account.id} className="border-t border-white/[.05] transition hover:bg-white/[.025]"><td className="px-6 py-4"><div className="font-bold">{account.name}</div><div className="mt-1 font-mono text-[9px] text-[#555a68]">{account.accountNumber}</div></td><td className="px-5 py-4 font-extrabold">{money(account.balance, account.currency)}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-[.08em] ${account.status === 'ACTIVE' ? 'status-active' : account.status === 'FROZEN' ? 'status-frozen' : 'status-closed'}`}>{account.status}</span></td><td className="px-6 py-4 text-right"><button className="btn-secondary !px-3 !py-2 text-[11px]" disabled={busyAccount === account.id || account.status === 'CLOSED'} onClick={() => toggle(account)}>{busyAccount === account.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : account.status === 'ACTIVE' ? <PauseCircle size={14} /> : <PlayCircle size={14} />}{account.status === 'ACTIVE' ? 'Freeze' : account.status === 'FROZEN' ? 'Restore' : 'Closed'}</button></td></tr>)}
      </tbody></table></div>
    </section>

    <section className="reveal reveal-delay-3 panel mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-5 sm:px-6"><div><h2 className="section-title">Transaction review</h2><p className="mt-1 text-xs text-[#626675]">Inspect proof or create a compensating entry</p></div><span className="eyebrow">Latest 50</span></div>
      <div className="p-2">
        {loading ? <ListSkeleton /> : transactions.map(transaction => <div key={transaction.transactionId} className="grid items-center gap-3 rounded-[16px] p-3.5 transition hover:bg-white/[.035] sm:grid-cols-[1.2fr_.7fr_auto] sm:px-4"><div className="min-w-0"><div className="truncate text-sm font-bold">{transaction.reference || titleCase(transaction.transactionType)}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[.07em] text-[#555a68]">{shortId(transaction.transactionId)} · {time(transaction.createdAt)}</div></div><div className="flex items-center gap-2"><span className="rounded-full border border-white/[.06] bg-white/[.025] px-2.5 py-1 text-[9px] font-bold text-[#747987]">{transaction.transactionType}</span><span className="text-[9px] font-bold text-[#67e5ce]">{transaction.status}</span></div><div className="flex justify-end gap-2"><button className="icon-button" onClick={() => onSelect(transaction)} title="Inspect entries" aria-label={`Inspect ${transaction.transactionId}`}><Eye size={15} /></button>{transaction.transactionType === 'TRANSFER' ? <button className="icon-button hover:!border-amber-300/20 hover:!text-amber-200" onClick={() => setReversalTarget(transaction)} title="Create reversal" aria-label={`Reverse ${transaction.transactionId}`}><RotateCcw size={15} /></button> : null}</div></div>)}
        {!loading && !transactions.length ? <div className="p-12 text-center text-sm text-[#626675]">No transactions available.</div> : null}
      </div>
    </section>

    {reversalTarget ? <ReversalDialog token={token} transaction={reversalTarget} onClose={() => setReversalTarget(null)} onComplete={async () => { setReversalTarget(null); setMessage('Reversal posted as a new balanced transaction.'); await reload() }} /> : null}
  </>
}

function ReversalDialog({ token, transaction, onClose, onComplete }: { token: string; transaction: LedgerTransaction; onClose: () => void; onComplete: () => Promise<void> }) {
  const [reason, setReason] = useState('Operator correction')
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPosting(true)
    setError('')
    try { await api.reverse(token, transaction.transactionId, reason); await onComplete() }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Reversal could not be posted') }
    finally { setPosting(false) }
  }

  return <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-[#05060a]/80 p-4 backdrop-blur-md" onMouseDown={onClose}><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="reversal-title" className="modal-card panel w-full max-w-md p-6" onMouseDown={event => event.stopPropagation()}><div className="flex items-start justify-between"><div><div className="eyebrow">Compensating entry</div><h2 id="reversal-title" className="mt-2 text-xl font-extrabold">Reverse transaction?</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={16} /></button></div><p className="mt-4 text-sm leading-6 text-[#7b7f8e]">The original <span className="font-mono text-[#aaa0ff]">{shortId(transaction.transactionId)}</span> stays immutable. A new balanced transaction restores its economic effect.</p><div className="mt-5"><label className="label" htmlFor="reversal-reason">Reason</label><textarea id="reversal-reason" className="input min-h-24 resize-none" minLength={3} maxLength={140} value={reason} onChange={event => setReason(event.target.value)} required /></div>{error ? <div role="alert" className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[.07] p-3 text-sm text-rose-200">{error}</div> : null}<div className="mt-6 flex gap-3"><button type="button" className="btn-secondary flex-1" onClick={onClose}>Keep original</button><button className="btn-primary flex-1" disabled={posting}>{posting ? 'Posting…' : <><RotateCcw size={15} />Post reversal</>}</button></div></form></div>
}

function AdminMetric({ icon: Icon, label, value, tone = 'violet' }: { icon: typeof Activity; label: string; value: string; tone?: 'violet' | 'amber' | 'mint' }) {
  const styles = tone === 'mint' ? 'bg-[#56dfc2]/10 text-[#78ead5]' : tone === 'amber' ? 'bg-amber-300/10 text-amber-200' : 'bg-[#9e8fff]/10 text-[#b9afff]'
  return <div className="panel panel-hover flex items-center gap-4 p-5"><span className={`grid h-11 w-11 place-items-center rounded-[14px] ${styles}`}><Icon size={18} /></span><div><div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#626675]">{label}</div><div className="mt-1 text-2xl font-extrabold">{value}</div></div></div>
}

function TableSkeleton({ columns }: { columns: number }) {
  return <>{Array.from({ length: 4 }, (_, row) => <tr key={row} className="border-t border-white/[.05]">{Array.from({ length: columns }, (_, column) => <td key={column} className="p-5"><div className="skeleton h-3 w-24 rounded-full" /></td>)}</tr>)}</>
}

function ListSkeleton() {
  return <div className="space-y-2 p-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center gap-4 p-2"><div className="flex-1"><div className="skeleton h-3 w-1/3 rounded-full" /><div className="skeleton mt-2 h-2 w-1/2 rounded-full" /></div><div className="skeleton h-9 w-20 rounded-xl" /></div>)}</div>
}

function titleCase(value: string) { return value.charAt(0) + value.slice(1).toLowerCase() }
