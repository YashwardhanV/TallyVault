import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, Layers3, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { money, shortId, time } from '../lib'
import type { Account, LedgerTransaction, Page } from '../types'

type Direction = 'ALL' | 'DEBIT' | 'CREDIT'

export function HistoryPage({ token, accounts, onSelect }: { token: string; accounts: Account[]; onSelect: (transaction: LedgerTransaction) => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [pageNumber, setPageNumber] = useState(0)
  const [page, setPage] = useState<Page<LedgerTransaction> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<Direction>('ALL')
  const account = accounts.find(item => item.id === accountId)

  useEffect(() => { if (!accountId && accounts[0]) setAccountId(accounts[0].id) }, [accounts, accountId])
  useEffect(() => {
    let cancelled = false
    if (!accountId) { setLoading(false); return }
    setLoading(true)
    setError('')
    api.history(token, accountId, pageNumber)
      .then(result => { if (!cancelled) setPage(result) })
      .catch(() => { if (!cancelled) setError('Transaction history could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, accountId, pageNumber])

  const visible = useMemo(() => (page?.content ?? []).filter(transaction => {
    const entry = transaction.entries.find(item => item.accountId === accountId)
    const matchesDirection = direction === 'ALL' || entry?.entryType === direction
    const haystack = `${transaction.reference ?? ''} ${transaction.transactionId} ${transaction.transactionType}`.toLowerCase()
    return matchesDirection && haystack.includes(query.trim().toLowerCase())
  }), [page, accountId, direction, query])

  return <>
    <header className="reveal flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
      <div><div className="eyebrow">Immutable activity</div><h1 className="mt-4 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">Follow every entry.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#858a9a]">Search the timeline, separate money in from money out, and open any transaction to inspect its balanced proof.</p></div>
      <div className="rounded-[16px] border border-white/[.07] bg-white/[.025] p-1.5"><select aria-label="Select account history" className="min-w-[260px] bg-transparent px-3 py-2 text-xs font-bold text-[#dfe1e8] outline-none" value={accountId} onChange={event => { setAccountId(event.target.value); setPageNumber(0) }}>{accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.accountNumber}</option>)}</select></div>
    </header>

    <section className="reveal reveal-delay-1 mt-8 grid gap-4 sm:grid-cols-3">
      <Summary label="Selected wallet" value={account?.name ?? 'No wallet'} note={account?.accountNumber ?? '—'} />
      <Summary label="Current balance" value={money(account?.balance ?? 0, account?.currency)} note="transactional projection" />
      <Summary label="History size" value={String(page?.totalElements ?? 0)} note="immutable transaction records" />
    </section>

    <section className="reveal reveal-delay-2 panel mt-6 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/[.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="relative flex-1 sm:max-w-sm"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e6270]" /><input className="input !py-2.5 !pl-10" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reference or transaction ID" aria-label="Search transactions" /></div>
        <div className="flex items-center gap-1 rounded-[13px] border border-white/[.06] bg-[#0b0d15]/60 p-1"><SlidersHorizontal size={14} className="mx-2 text-[#555a68]" />{(['ALL', 'DEBIT', 'CREDIT'] as Direction[]).map(value => <button key={value} onClick={() => setDirection(value)} className={`rounded-[10px] px-3 py-2 text-[9px] font-extrabold tracking-[.1em] transition ${direction === value ? 'bg-[#9e8fff] text-[#100d22]' : 'text-[#666b79] hover:text-white'}`}>{value}</button>)}</div>
      </div>

      <div className="hidden grid-cols-[1.45fr_.85fr_.55fr_.65fr_auto] border-b border-white/[.05] px-6 py-3 font-mono text-[8px] uppercase tracking-[.18em] text-[#4f5361] md:grid"><span>Transaction</span><span>Timestamp</span><span>Type</span><span>Direction</span><span className="text-right">Amount</span></div>

      <div className="p-2">
        {loading ? <HistorySkeleton /> : visible.map(transaction => {
          const entry = transaction.entries.find(item => item.accountId === accountId)
          const debit = entry?.entryType === 'DEBIT'
          return <button key={transaction.transactionId} onClick={() => onSelect(transaction)} className="group grid w-full items-center gap-3 rounded-[16px] p-3.5 text-left transition hover:bg-white/[.04] md:grid-cols-[1.45fr_.85fr_.55fr_.65fr_auto] md:px-4">
            <span className="flex min-w-0 items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border transition group-hover:scale-105 ${debit ? 'border-rose-300/10 bg-rose-300/[.07] text-rose-200' : 'border-[#56dfc2]/10 bg-[#56dfc2]/[.07] text-[#78ead5]'}`}>{debit ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{transaction.reference || titleCase(transaction.transactionType)}</span><span className="mt-1 block font-mono text-[9px] text-[#555a68]">{shortId(transaction.transactionId)}</span></span></span>
            <span className="hidden items-center gap-1.5 text-[10px] text-[#747987] md:flex"><Clock3 size={12} />{time(transaction.createdAt)}</span>
            <span className="hidden text-[10px] font-bold text-[#7b7f8e] md:block">{titleCase(transaction.transactionType)}</span>
            <span className={`hidden w-fit rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-[.08em] md:block ${debit ? 'border-rose-300/10 bg-rose-300/[.06] text-rose-200' : 'border-[#56dfc2]/10 bg-[#56dfc2]/[.06] text-[#78ead5]'}`}>{entry?.entryType ?? '—'}</span>
            <span className={`text-right text-sm font-extrabold ${debit ? 'text-rose-100' : 'text-[#9af2e2]'}`}>{debit ? '−' : '+'}{money(entry?.amount ?? 0, account?.currency)}</span>
          </button>
        })}
        {!loading && !visible.length ? <div className="grid place-items-center px-6 py-16 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[.07] bg-white/[.03] text-[#666b79]"><Layers3 size={19} /></span><h3 className="mt-4 text-sm font-bold">No matching entries</h3><p className="mt-1.5 text-xs text-[#5e6270]">Try another filter or wait for a new transaction.</p></div> : null}
        {error ? <div role="alert" className="m-3 rounded-[14px] border border-rose-300/15 bg-rose-300/[.07] px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      </div>

      <div className="flex items-center justify-between border-t border-white/[.06] px-4 py-4 text-[10px] text-[#626675] sm:px-5"><span>Page {pageNumber + 1} of {Math.max(page?.totalPages ?? 1, 1)} · {page?.totalElements ?? 0} records</span><div className="flex gap-2"><button className="icon-button !h-9 !w-9" disabled={!pageNumber || loading} onClick={() => setPageNumber(number => number - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button><button className="icon-button !h-9 !w-9" disabled={loading || !page || pageNumber + 1 >= page.totalPages} onClick={() => setPageNumber(number => number + 1)} aria-label="Next page"><ChevronRight size={15} /></button></div></div>
    </section>
  </>
}

function Summary({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="panel panel-hover p-5"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#626675]">{label}</div><div className="mt-4 truncate text-xl font-extrabold tracking-[-.03em]">{value}</div><div className="mt-1.5 truncate font-mono text-[9px] uppercase tracking-[.08em] text-[#555a68]">{note}</div></div>
}

function HistorySkeleton() {
  return <div className="space-y-2 p-2">{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex items-center gap-4 p-2"><div className="skeleton h-10 w-10 rounded-[13px]" /><div className="flex-1"><div className="skeleton h-3 w-1/3 rounded-full" /><div className="skeleton mt-2 h-2 w-1/2 rounded-full" /></div><div className="skeleton h-3 w-20 rounded-full" /></div>)}</div>
}

function titleCase(value: string) { return value.charAt(0) + value.slice(1).toLowerCase() }
