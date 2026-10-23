import { ArrowDownLeft, ArrowUpRight, Check, Copy, Link2, Scale, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { money, shortId, time } from '../lib'
import type { LedgerTransaction } from '../types'

export function TransactionDetails({ transaction, onClose }: { transaction: LedgerTransaction; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const debits = transaction.entries.filter(entry => entry.entryType === 'DEBIT').reduce((sum, entry) => sum + Number(entry.amount), 0)
  const credits = transaction.entries.filter(entry => entry.entryType === 'CREDIT').reduce((sum, entry) => sum + Number(entry.amount), 0)
  const balanced = debits === credits

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', closeOnEscape) }
  }, [onClose])

  async function copyId() {
    try { await navigator.clipboard.writeText(transaction.transactionId); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }
    catch { setCopied(false) }
  }

  return <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-[#05060a]/80 p-3 backdrop-blur-md sm:p-6" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="transaction-title" className="modal-card panel max-h-[92vh] w-full max-w-3xl overflow-auto" onMouseDown={event => event.stopPropagation()}>
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[.06] bg-[#11141e]/95 px-5 py-5 backdrop-blur-xl sm:px-7 sm:py-6">
        <div><div className="eyebrow">Transaction proof</div><h2 id="transaction-title" className="mt-2 text-2xl font-extrabold tracking-[-.04em]">Every value has a counter-entry.</h2></div>
        <button className="icon-button shrink-0" onClick={onClose} aria-label="Close transaction details"><X size={17} /></button>
      </header>

      <div className="p-5 sm:p-7">
        <div className="grid gap-3 rounded-[18px] border border-white/[.06] bg-black/[.12] p-4 sm:grid-cols-3 sm:p-5">
          <Meta label="Type" value={titleCase(transaction.transactionType)} />
          <Meta label="Status" value={transaction.status} accent />
          <Meta label="Completed" value={transaction.completedAt ? time(transaction.completedAt) : 'Processing'} />
          <div className="sm:col-span-2"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#555a68]">Transaction ID</div><button onClick={copyId} className="mt-1.5 flex max-w-full items-center gap-2 font-mono text-[10px] text-[#aaa0ff] hover:text-[#c7c0ff]"><span className="truncate">{transaction.transactionId}</span>{copied ? <Check size={13} /> : <Copy size={13} />}</button></div>
          <Meta label="Reference" value={transaction.reference || 'No reference'} />
          {transaction.reversalOfTransactionId ? <div className="sm:col-span-3"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#555a68]">Linked original</div><div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-[#aaa0ff]"><Link2 size={13} />{shortId(transaction.reversalOfTransactionId)}</div></div> : null}
        </div>

        <div className="my-7 flex items-center gap-3"><div className="h-px flex-1 bg-white/[.07]" /><span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.18em] text-[#626675]"><Scale size={13} />Balanced entries</span><div className="h-px flex-1 bg-white/[.07]" /></div>

        <div className="grid gap-4 sm:grid-cols-2">
          {transaction.entries.map((entry, index) => <EntryProof key={entry.entryId} entry={entry} index={index} />)}
        </div>

        <div className={`mt-5 overflow-hidden rounded-[18px] border ${balanced ? 'border-[#56dfc2]/14 bg-[#56dfc2]/[.045]' : 'border-rose-300/15 bg-rose-300/[.05]'}`}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 sm:p-5"><Total label="Total debits" value={debits} align="left" /><span className={`grid h-10 w-10 place-items-center rounded-full ${balanced ? 'bg-[#56dfc2]/10 text-[#78ead5]' : 'bg-rose-300/10 text-rose-200'}`}>{balanced ? <Check size={17} /> : <X size={17} />}</span><Total label="Total credits" value={credits} align="right" /></div><div className={`h-0.5 ${balanced ? 'balance-flow' : 'bg-rose-300/50'}`} />
        </div>
        <p className="mt-4 text-center text-[10px] leading-5 text-[#626675]">{balanced ? 'The database accepts completion only when debit and credit totals match.' : 'This transaction requires integrity review.'}</p>
      </div>
    </section>
  </div>
}

function EntryProof({ entry, index }: { entry: LedgerTransaction['entries'][number]; index: number }) {
  const debit = entry.entryType === 'DEBIT'
  return <article className={`relative overflow-hidden rounded-[20px] border p-5 transition hover:-translate-y-0.5 ${debit ? 'border-[#9e8fff]/16 bg-[#9e8fff]/[.055]' : 'border-[#56dfc2]/16 bg-[#56dfc2]/[.05]'}`} style={{ animationDelay: `${index * 70}ms` }}>
    <span className={`absolute right-[-28px] top-[-34px] h-28 w-28 rounded-full blur-3xl ${debit ? 'bg-[#9e8fff]/15' : 'bg-[#56dfc2]/15'}`} />
    <div className="relative flex items-center justify-between"><span className={`flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.18em] ${debit ? 'text-[#b9afff]' : 'text-[#78ead5]'}`}>{debit ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}{entry.entryType}</span><span className="font-mono text-[8px] text-[#555a68]">ENTRY {String(index + 1).padStart(2, '0')}</span></div>
    <div className="relative mt-8 text-2xl font-extrabold tracking-[-.035em]">{money(entry.amount)}</div>
    <div className="relative mt-3 border-t border-white/[.06] pt-3"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#555a68]">Account</div><div className="mt-1.5 font-mono text-[10px] text-[#858a9a]">{entry.accountNumber}</div></div>
  </article>
}

function Meta({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#555a68]">{label}</div><div className={`mt-1.5 truncate text-xs font-bold ${accent ? 'text-[#78ead5]' : 'text-[#dfe1e8]'}`}>{value}</div></div>
}

function Total({ label, value, align }: { label: string; value: number; align: 'left' | 'right' }) {
  return <div className={align === 'right' ? 'text-right' : ''}><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#626675]">{label}</div><div className="mt-1.5 text-lg font-extrabold">{money(value)}</div></div>
}

function titleCase(value: string) { return value.charAt(0) + value.slice(1).toLowerCase() }
