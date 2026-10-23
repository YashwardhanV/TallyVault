import { History, LayoutDashboard, LogOut, Scale, Send, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { AuthResponse } from '../types'

const baseLinks = [
  { to: '/', label: 'Overview', short: 'Home', icon: LayoutDashboard, end: true },
  { to: '/transfer', label: 'New transfer', short: 'Transfer', icon: Send },
  { to: '/history', label: 'Ledger history', short: 'History', icon: History },
]

export function Shell({ session, onLogout, children }: {
  session: AuthResponse; onLogout: () => void; children: ReactNode
}) {
  const location = useLocation()
  const links = session.role === 'ADMIN'
    ? [...baseLinks, { to: '/admin', label: 'Admin desk', short: 'Admin', icon: ShieldCheck }]
    : baseLinks
  const current = links.find(link => link.to === location.pathname)?.label ?? 'Workspace'
  const initials = session.displayName.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()

  return <div className="min-h-screen">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] border-r border-white/[.07] bg-[#0b0d15]/95 p-5 backdrop-blur-2xl lg:flex lg:flex-col">
      <NavLink to="/" className="flex items-center gap-3 px-2 py-2">
        <BrandMark />
        <div><div className="text-[17px] font-extrabold tracking-[-.04em]">TallyVault</div><div className="font-mono text-[8px] uppercase tracking-[.2em] text-[#5e6271]">Every value accounted</div></div>
      </NavLink>

      <div className="mt-11 px-3 font-mono text-[9px] uppercase tracking-[.2em] text-[#4f5361]">Workspace</div>
      <nav className="mt-3 space-y-1.5">
        {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}
          className={({ isActive }) => `group relative flex items-center gap-3 overflow-hidden rounded-[14px] px-3.5 py-3 text-sm font-semibold transition duration-200 ${isActive ? 'bg-[#9e8fff]/12 text-white' : 'text-[#838795] hover:bg-white/[.045] hover:text-[#e8e9ef]'}`}>
          {({ isActive }) => <><span className={`absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#9e8fff] transition ${isActive ? 'opacity-100' : 'opacity-0'}`} /><span className={`grid h-8 w-8 place-items-center rounded-[10px] transition ${isActive ? 'bg-[#9e8fff] text-[#100d22]' : 'bg-white/[.035] text-[#777c8b] group-hover:text-white'}`}><Icon size={15} strokeWidth={2.2} /></span>{label}</>}
        </NavLink>)}
      </nav>

      <div className="mt-auto">
        <div className="mb-4 rounded-[18px] border border-[#56dfc2]/10 bg-[#56dfc2]/[.035] p-3.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#68e6cf]"><span className="live-dot h-1.5 w-1.5 rounded-full bg-[#58e0c7]" />Ledger online</div>
          <p className="mt-2 text-[11px] leading-5 text-[#666b79]">Atomic posting and balance reconciliation are active.</p>
        </div>
        <div className="flex items-center gap-3 rounded-[18px] border border-white/[.07] bg-white/[.025] p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-[#8172ff]/25 to-[#56dfc2]/15 text-xs font-extrabold text-[#c5bdff]">{initials}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{session.displayName}</div><div className="mt-0.5 truncate text-[10px] text-[#666b79]">{session.email}</div></div>
          <button onClick={onLogout} className="icon-button !h-9 !w-9" aria-label="Sign out" title="Sign out"><LogOut size={15} /></button>
        </div>
      </div>
    </aside>

    <div className="lg:pl-[272px]">
      <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-white/[.06] bg-[#080a11]/75 px-5 backdrop-blur-2xl sm:px-7 lg:px-9">
        <div className="flex items-center gap-3 lg:hidden"><BrandMark compact /><span className="font-extrabold tracking-[-.035em]">TallyVault</span></div>
        <div className="hidden lg:block"><div className="font-mono text-[9px] uppercase tracking-[.2em] text-[#555a68]">Current view</div><div className="mt-1 text-sm font-bold">{current}</div></div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-white/[.07] bg-white/[.03] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.14em] text-[#777c8a] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#58e0c7]" />PostgreSQL synced</span>
          <span className="rounded-full border border-[#9e8fff]/15 bg-[#9e8fff]/[.07] px-3 py-1.5 font-mono text-[9px] font-medium uppercase tracking-[.14em] text-[#b9afff]">{session.role}</span>
        </div>
      </header>
      <main key={location.pathname} className="page-enter mx-auto max-w-[1480px] p-5 pb-28 sm:p-7 sm:pb-28 lg:p-9 xl:p-11">{children}</main>
    </div>

    <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-[20px] border border-white/[.09] bg-[#11141e]/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,.55)] backdrop-blur-2xl lg:hidden">
      {links.map(({ to, short, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} aria-label={label}
        className={({ isActive }) => `grid min-w-[58px] place-items-center gap-1 rounded-[13px] px-2 py-2 text-[9px] font-bold transition ${isActive ? 'bg-[#9e8fff] text-[#100d22]' : 'text-[#747987]'}`}>
        <Icon size={17} /><span>{short}</span>
      </NavLink>)}
      <button onClick={onLogout} aria-label="Sign out" className="grid min-w-[58px] place-items-center gap-1 rounded-[13px] px-2 py-2 text-[9px] font-bold text-[#747987]"><LogOut size={17} /><span>Exit</span></button>
    </nav>
  </div>
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`relative grid place-items-center overflow-hidden rounded-[13px] bg-gradient-to-br from-[#b6aaff] to-[#7d6cff] text-[#110d25] shadow-[0_10px_28px_rgba(125,108,255,.2)] ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}><Scale size={compact ? 17 : 20} strokeWidth={2.4} /><i className="absolute inset-x-1 bottom-0 h-px bg-white/40" /></span>
}
