import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Layers3, LockKeyhole, Scale, ShieldCheck, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { money, shortId, time } from '../lib'
import type { Account, LedgerTransaction } from '../types'

type LedgerState = 'checking' | 'reconciled' | 'attention' | 'empty'

export function DashboardPage({ token, accounts, onSelect }: { token: string; accounts: Account[]; onSelect: (transaction: LedgerTransaction) => void }) {
  const [recent, setRecent] = useState<LedgerTransaction[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [ledgerState, setLedgerState] = useState<LedgerState>('checking')
  const accountIds = useMemo(() => new Set(accounts.map(account => account.id)), [accounts])
  const total = accounts.reduce((sum, account) => sum + Number(account.balance), 0)
  const primaryCurrency = accounts[0]?.currency ?? 'INR'

  useEffect(() => {
    let cancelled = false
    if (!accounts[0]) { setRecent([]); setRecentLoading(false); return }
    setRecentLoading(true)
    api.history(token, accounts[0].id).then(page => {
      if (!cancelled) setRecent(page.content.slice(0, 6))
    }).catch(() => { if (!cancelled) setRecent([]) })
      .finally(() => { if (!cancelled) setRecentLoading(false) })
    return () => { cancelled = true }
  }, [token, accounts])

  useEffect(() => {
    let cancelled = false
    if (!accounts.length) { setLedgerState('empty'); return }
    setLedgerState('checking')
    Promise.all(accounts.map(account => api.balance(token, account.id)))
      .then(balances => { if (!cancelled) setLedgerState(balances.every(balance => balance.reconciled) ? 'reconciled' : 'attention') })
      .catch(() => { if (!cancelled) setLedgerState('attention') })
    return () => { cancelled = true }
  }, [token, accounts])

  return <>
    <section className="reveal relative overflow-hidden rounded-[28px] border border-white/[.08] bg-[#11141e] p-6 shadow-[0_30px_100px_rgba(0,0,0,.34)] sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute -right-24 -top-36 h-[28rem] w-[28rem] rounded-full bg-[#8172ff]/20 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-36 right-1/3 h-72 w-72 rounded-full bg-[#56dfc2]/10 blur-[90px]" />
      <div className="relative grid gap-10 xl:grid-cols-[1.2fr_.8fr] xl:items-end">
        <div>
          <div className="eyebrow">Portfolio balance</div>
          <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-2"><h1 className="text-5xl font-extrabold tracking-[-.065em] sm:text-6xl lg:text-7xl">{money(total, primaryCurrency)}</h1><span className="mb-2 rounded-full border border-[#56dfc2]/15 bg-[#56dfc2]/[.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#78ead5]">Across {accounts.length} wallet{accounts.length === 1 ? '' : 's'}</span></div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-[#858a9a]">A live view of your cached balances, continuously checked against the immutable entry history.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link className="btn-primary" to="/transfer">Move funds <ArrowRight size={16} /></Link><Link className="btn-secondary" to="/history"><Layers3 size={16} />Explore the ledger</Link></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <IntegrityLine icon={Scale} label="Double-entry" value="Debit = Credit" tone="violet" />
          <IntegrityLine icon={ShieldCheck} label="Ledger integrity" value={ledgerCopy(ledgerState).title} tone={ledgerState === 'attention' ? 'amber' : 'mint'} loading={ledgerState === 'checking'} />
          <IntegrityLine icon={LockKeyhole} label="Transfer safety" value="Atomic commit" tone="neutral" />
        </div>
      </div>
    </section>

    <section className="reveal reveal-delay-1 mt-8 grid gap-4 md:grid-cols-3">
      <Metric icon={WalletCards} label="Active wallets" value={String(accounts.filter(account => account.status === 'ACTIVE').length)} note={`${accounts.length} total account${accounts.length === 1 ? '' : 's'}`} />
      <Metric icon={Scale} label="Reconciliation" value={ledgerCopy(ledgerState).title} note={ledgerCopy(ledgerState).note} accent={ledgerState === 'reconciled'} />
      <Metric icon={ShieldCheck} label="History model" value="Append-only" note="corrections post as reversals" />
    </section>

    <section className="reveal reveal-delay-2 mt-8 grid gap-6 xl:grid-cols-[.88fr_1.25fr]">
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-5 sm:px-6"><div><h2 className="section-title">Your wallets</h2><p className="mt-1 text-xs text-[#666b79]">Balances ready to move</p></div><span className="eyebrow">Accounts</span></div>
        <div className="space-y-3 p-4 sm:p-5">
          {accounts.map((account, index) => <AccountCard key={account.id} account={account} index={index} />)}
          {!accounts.length ? <Empty icon={WalletCards} title="No wallet yet" text="Create an account through the API to begin posting entries." /> : null}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-5 sm:px-6"><div><h2 className="section-title">Recent activity</h2><p className="mt-1 text-xs text-[#666b79]">Newest entries in your primary wallet</p></div><Link to="/history" className="group flex items-center gap-1.5 text-xs font-bold text-[#aaa0ff]">View all <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></Link></div>
        <div className="p-2">
          {recentLoading ? <ActivitySkeleton /> : recent.map(transaction => {
            const ownEntry = transaction.entries.find(entry => accountIds.has(entry.accountId))
            const debit = ownEntry?.entryType === 'DEBIT'
            return <button onClick={() => onSelect(transaction)} key={transaction.transactionId} className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[16px] p-3.5 text-left transition hover:bg-white/[.04] sm:gap-4">
              <span className={`grid h-11 w-11 place-items-center rounded-[14px] border transition group-hover:scale-105 ${debit ? 'border-rose-300/10 bg-rose-300/[.07] text-rose-200' : 'border-[#56dfc2]/10 bg-[#56dfc2]/[.07] text-[#78ead5]'}`}>{debit ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{transaction.reference || humanize(transaction.transactionType)}</span><span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[.08em] text-[#5e6270]">{shortId(transaction.transactionId)} · {time(transaction.createdAt)}</span></span>
              <span className={`text-right text-sm font-extrabold sm:text-base ${debit ? 'text-rose-100' : 'text-[#9af2e2]'}`}>{debit ? '−' : '+'}{money(ownEntry?.amount ?? 0, primaryCurrency)}</span>
            </button>
          })}
          {!recentLoading && !recent.length ? <Empty icon={Layers3} title="Nothing posted yet" text="Your latest balanced transactions will appear here." /> : null}
        </div>
      </div>
    </section>
  </>
}

function AccountCard({ account, index }: { account: Account; index: number }) {
  const hues = ['from-[#8172ff]/20 to-[#8172ff]/[.03]', 'from-[#56dfc2]/15 to-[#56dfc2]/[.02]', 'from-[#f4b76a]/15 to-[#f4b76a]/[.02]']
  const statusClass = account.status === 'ACTIVE' ? 'status-active' : account.status === 'FROZEN' ? 'status-frozen' : 'status-closed'
  return <article className={`panel-hover relative overflow-hidden rounded-[18px] border border-white/[.07] bg-gradient-to-br ${hues[index % hues.length]} p-5`}>
    <div className="absolute right-[-30px] top-[-42px] h-28 w-28 rounded-full border border-white/[.04]" />
    <div className="relative flex items-start justify-between gap-4"><div className="min-w-0"><div className="truncate text-sm font-bold">{account.name}</div><div className="mt-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-[#626675]">{account.accountNumber}</div></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-[.08em] ${statusClass}`}>{account.status}</span></div>
    <div className="relative mt-7 text-2xl font-extrabold tracking-[-.035em]">{money(account.balance, account.currency)}</div>
    <div className="relative mt-2 flex items-center gap-1.5 text-[10px] text-[#737887]"><Check size={12} className="text-[#67e5ce]" />Balance projection available</div>
  </article>
}

function IntegrityLine({ icon: Icon, label, value, tone, loading = false }: { icon: typeof Scale; label: string; value: string; tone: 'violet' | 'mint' | 'amber' | 'neutral'; loading?: boolean }) {
  const colors = { violet: 'bg-[#9e8fff]/10 text-[#b9afff]', mint: 'bg-[#56dfc2]/10 text-[#78ead5]', amber: 'bg-amber-300/10 text-amber-200', neutral: 'bg-white/[.05] text-[#9a9ead]' }
  return <div className="flex items-center gap-3 rounded-[16px] border border-white/[.06] bg-black/[.12] p-3.5"><span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[tone]}`}><Icon size={16} /></span><span><span className="block text-[10px] font-semibold text-[#626675]">{label}</span><span className="mt-0.5 flex items-center gap-2 text-xs font-bold">{loading ? <i className="h-2 w-2 animate-pulse rounded-full bg-[#9e8fff]" /> : null}{value}</span></span></div>
}

function Metric({ icon: Icon, label, value, note, accent = false }: { icon: typeof Scale; label: string; value: string; note: string; accent?: boolean }) {
  return <div className={`panel panel-hover p-5 sm:p-6 ${accent ? 'border-[#56dfc2]/15' : ''}`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#666b79]">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${accent ? 'bg-[#56dfc2]/10 text-[#78ead5]' : 'bg-white/[.04] text-[#777c8b]'}`}><Icon size={16} /></span></div><div className="mt-5 text-2xl font-extrabold tracking-[-.035em]">{value}</div><div className="mt-2 text-xs text-[#666b79]">{note}</div></div>
}

function ActivitySkeleton() {
  return <div className="space-y-2 p-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center gap-4 p-2"><div className="skeleton h-11 w-11 rounded-[14px]" /><div className="flex-1"><div className="skeleton h-3 w-2/5 rounded-full" /><div className="skeleton mt-2 h-2 w-3/5 rounded-full" /></div><div className="skeleton h-3 w-20 rounded-full" /></div>)}</div>
}

function Empty({ icon: Icon, title, text }: { icon: typeof Scale; title: string; text: string }) {
  return <div className="grid place-items-center px-6 py-12 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[.07] bg-white/[.03] text-[#666b79]"><Icon size={19} /></span><div className="mt-4 text-sm font-bold">{title}</div><p className="mt-1.5 max-w-xs text-xs leading-5 text-[#626675]">{text}</p></div>
}

function ledgerCopy(state: LedgerState) {
  if (state === 'reconciled') return { title: 'Reconciled', note: 'cache matches ledger entries' }
  if (state === 'checking') return { title: 'Checking…', note: 'comparing balance sources' }
  if (state === 'empty') return { title: 'No entries', note: 'waiting for the first account' }
  return { title: 'Review needed', note: 'balance check needs attention' }
}

function humanize(value: string) { return value.charAt(0) + value.slice(1).toLowerCase() }
