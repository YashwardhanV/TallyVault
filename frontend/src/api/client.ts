import type { Account, AccountLookup, AccountStatus, AuthResponse, BalanceSnapshot, LedgerTransaction, Page } from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, body?.code || 'request_failed', body?.message || 'Request failed')
  return body as T
}

export const api = {
  login: (email: string, password: string) => request<AuthResponse>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),
  accounts: (token: string) => request<Account[]>('/accounts', {}, token),
  balance: (token: string, accountId: string) =>
    request<BalanceSnapshot>(`/accounts/${accountId}/balance`, {}, token),
  lookup: (token: string, accountNumber: string) =>
    request<AccountLookup>(`/accounts/lookup?accountNumber=${encodeURIComponent(accountNumber)}`, {}, token),
  history: (token: string, accountId: string, page = 0) =>
    request<Page<LedgerTransaction>>(`/accounts/${accountId}/transactions?page=${page}&size=20`, {}, token),
  transaction: (token: string, id: string) => request<LedgerTransaction>(`/transactions/${id}`, {}, token),
  transfer: (token: string, key: string, payload: object) => request<LedgerTransaction>('/transfers', {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(payload),
  }, token),
  adminAccounts: (token: string) => request<Page<Account>>('/admin/accounts?page=0&size=100', {}, token),
  changeStatus: (token: string, id: string, status: AccountStatus) =>
    request<Account>(`/admin/accounts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  adminTransactions: (token: string) => request<Page<LedgerTransaction>>('/transactions?page=0&size=50', {}, token),
  reverse: (token: string, id: string, reason: string) => request<LedgerTransaction>(
    `/transactions/${id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) }, token),
}
