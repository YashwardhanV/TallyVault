import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api/client'
import { Shell } from './components/Shell'
import { TransactionDetails } from './components/TransactionDetails'
import { AdminPage } from './pages/AdminPage'
import { DashboardPage } from './pages/DashboardPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { TransferPage } from './pages/TransferPage'
import type { Account, AuthResponse, LedgerTransaction } from './types'

const STORAGE_KEY = 'tallyvault.session.v1'

export default function App() {
  const [session, setSession] = useState<AuthResponse | null>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') }
    catch { return null }
  })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState<LedgerTransaction | null>(null)
  const reloadAccounts = useCallback(async () => {
    if (!session) { setAccounts([]); return }
    try { setAccounts(await api.accounts(session.token)) }
    catch { setAccounts([]) }
  }, [session])
  useEffect(() => { void reloadAccounts() }, [reloadAccounts])

  function login(next: AuthResponse) { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSession(next) }
  function logout() { localStorage.removeItem(STORAGE_KEY); setSession(null); setAccounts([]) }
  if (!session) return <LoginPage onLogin={login} />

  return <Shell session={session} onLogout={logout}>
    <Routes>
      <Route path="/" element={<DashboardPage token={session.token} accounts={accounts} onSelect={setSelected} />} />
      <Route path="/transfer" element={<TransferPage token={session.token} accounts={accounts} onComplete={transaction => { setSelected(transaction); void reloadAccounts() }} />} />
      <Route path="/history" element={<HistoryPage token={session.token} accounts={accounts} onSelect={setSelected} />} />
      <Route path="/admin" element={session.role === 'ADMIN' ? <AdminPage token={session.token} onSelect={setSelected} /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {selected && <TransactionDetails transaction={selected} onClose={() => setSelected(null)} />}
  </Shell>
}
