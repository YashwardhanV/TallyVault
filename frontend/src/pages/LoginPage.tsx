import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Scale, ShieldCheck } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { AuthResponse } from '../types'

export function LoginPage({ onLogin }: { onLogin: (session: AuthResponse) => void }) {
  const [email, setEmail] = useState('alice@tallyvault.dev')
  const [password, setPassword] = useState('Alice123!')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try { onLogin(await api.login(email, password)) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'TallyVault is currently unreachable') }
    finally { setLoading(false) }
  }

  function useDemo(profile: 'user' | 'admin') {
    setEmail(profile === 'user' ? 'alice@tallyvault.dev' : 'admin@tallyvault.dev')
    setPassword(profile === 'user' ? 'Alice123!' : 'Admin123!')
    setError('')
  }

  return <main className="relative grid min-h-screen overflow-hidden bg-[#080a11] lg:grid-cols-[1.08fr_.92fr]">
    <div className="pointer-events-none absolute left-[-14rem] top-[-15rem] h-[34rem] w-[34rem] rounded-full bg-[#7d6cff]/15 blur-[100px]" />
    <div className="pointer-events-none absolute bottom-[-16rem] right-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#4edbc0]/10 blur-[110px]" />

    <section className="relative hidden min-h-screen overflow-hidden border-r border-white/[.07] px-12 py-10 lg:flex lg:flex-col xl:px-20 xl:py-12">
      <Brand />
      <div className="relative z-10 my-auto max-w-2xl py-16">
        <div className="eyebrow reveal">Double-entry clarity</div>
        <h1 className="reveal reveal-delay-1 mt-6 text-6xl font-extrabold leading-[.98] tracking-[-.065em] xl:text-7xl">
          Money moves.<br /><span className="bg-gradient-to-r from-[#b9afff] via-[#9e8fff] to-[#62e8d0] bg-clip-text text-transparent">The truth stays.</span>
        </h1>
        <p className="reveal reveal-delay-2 mt-7 max-w-xl text-lg leading-8 text-[#989cab]">
          A transparent wallet workspace where every transfer resolves into two balanced, immutable entries.
        </p>

        <div className="reveal reveal-delay-3 relative mt-12 max-w-xl rounded-[26px] border border-white/[.09] bg-[#10131d]/80 p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[.2em] text-[#777c8c]">Live transaction anatomy</span>
            <span className="flex items-center gap-2 text-[11px] font-bold text-[#77ead5]"><i className="live-dot h-1.5 w-1.5 rounded-full bg-[#58e0c7]" />BALANCED</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <EntryCard label="Debit" account="TV-ALICE-001" amount="− ₹500.00" tone="violet" />
            <div className="relative grid h-12 w-12 place-items-center rounded-full border border-white/[.09] bg-[#0b0d15]">
              <Scale size={18} className="text-[#9e8fff]" />
              <span className="absolute inset-x-[-18px] top-1/2 -z-10 h-px balance-flow" />
            </div>
            <EntryCard label="Credit" account="TV-BOB-001" amount="+ ₹500.00" tone="mint" />
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-2.5 text-xs text-[#8d91a0]">
            <ShieldCheck size={14} className="text-[#67e5ce]" /> Both entries commit together—or neither does.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-5 font-mono text-[9px] uppercase tracking-[.18em] text-[#555a68]">
        <span>Spring Boot</span><i className="h-1 w-1 rounded-full bg-[#393d49]" /><span>PostgreSQL</span><i className="h-1 w-1 rounded-full bg-[#393d49]" /><span>React</span>
      </div>
    </section>

    <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-[430px] page-enter">
        <div className="mb-10 lg:hidden"><Brand /></div>
        <div className="mb-8">
          <div className="eyebrow">Your ledger workspace</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Welcome back.</h2>
          <p className="mt-3 text-sm leading-6 text-[#858a9a]">Sign in to inspect balances, post transfers, and follow every accounting entry.</p>
        </div>

        <form onSubmit={submit} className="panel p-5 sm:p-7">
          <div><label className="label" htmlFor="email">Email address</label><input id="email" className="input" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" required /></div>
          <div className="mt-5"><label className="label" htmlFor="password">Password</label><div className="relative"><input id="password" className="input pr-12" value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required /><button type="button" className="absolute right-1.5 top-1.5 grid h-10 w-10 place-items-center rounded-xl text-[#777c8c] transition hover:bg-white/[.06] hover:text-white" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
          {error ? <div role="alert" className="mt-5 rounded-[14px] border border-rose-300/15 bg-rose-300/[.07] px-4 py-3 text-sm text-rose-200">{error}</div> : null}
          <button className="btn-primary mt-6 w-full" disabled={loading}>{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#100d22]/25 border-t-[#100d22]" />Opening workspace…</> : <><LockKeyhole size={17} />Open workspace<ArrowRight size={16} /></>}</button>
        </form>

        <div className="mt-6 rounded-[18px] border border-white/[.07] bg-white/[.025] p-4">
          <div className="flex items-center justify-between"><span className="label !mb-0">Instant demo access</span><span className="flex items-center gap-1.5 text-[10px] text-[#67e5ce]"><Check size={12} />Prefilled</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary !py-2.5" onClick={() => useDemo('user')}>Alice · User</button>
            <button type="button" className="btn-secondary !py-2.5" onClick={() => useDemo('admin')}>Admin desk</button>
          </div>
          <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[.12em] text-[#555a68]">Demo destination · TV-BOB-001</p>
        </div>
      </div>
    </section>
  </main>
}

function Brand() {
  return <div className="relative z-10 flex items-center gap-3">
    <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#b6aaff] to-[#7d6cff] text-[#110d25] shadow-[0_12px_32px_rgba(125,108,255,.25)]">
      <Scale size={21} strokeWidth={2.4} /><span className="absolute inset-x-1 bottom-0 h-px bg-white/40" />
    </div>
    <div><div className="text-lg font-extrabold tracking-[-.035em]">TallyVault</div><div className="font-mono text-[8px] uppercase tracking-[.22em] text-[#6f7483]">Every value accounted</div></div>
  </div>
}

function EntryCard({ label, account, amount, tone }: { label: string; account: string; amount: string; tone: 'violet' | 'mint' }) {
  return <div className={`animate-drift rounded-2xl border p-4 ${tone === 'violet' ? 'border-[#9e8fff]/20 bg-[#9e8fff]/[.07]' : 'animate-drift-slow border-[#56dfc2]/20 bg-[#56dfc2]/[.07]'}`}>
    <div className={`text-[10px] font-extrabold uppercase tracking-[.18em] ${tone === 'violet' ? 'text-[#b9afff]' : 'text-[#78ead5]'}`}>{label}</div>
    <div className="mt-5 text-lg font-extrabold">{amount}</div>
    <div className="mt-1 truncate font-mono text-[9px] text-[#6f7482]">{account}</div>
  </div>
}
