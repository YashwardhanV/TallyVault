export type Role = 'USER' | 'ADMIN'
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED'
export type EntryType = 'DEBIT' | 'CREDIT'

export interface AuthResponse {
  token: string
  userId: string
  email: string
  displayName: string
  role: Role
}

export interface Account {
  id: string
  accountNumber: string
  name: string
  currency: string
  status: AccountStatus
  balance: number
  createdAt: string
}

export interface AccountLookup {
  id: string
  accountNumber: string
  name: string
  currency: string
  status: AccountStatus
}

export interface BalanceSnapshot {
  accountId: string
  currency: string
  cachedBalance: number
  ledgerBalance: number
  reconciled: boolean
}

export interface LedgerEntry {
  entryId: string
  accountId: string
  accountNumber: string
  entryType: EntryType
  amount: number
  createdAt: string
}

export interface LedgerTransaction {
  transactionId: string
  transactionType: 'TRANSFER' | 'FUNDING' | 'REVERSAL'
  status: 'PROCESSING' | 'COMPLETED'
  reference?: string
  reversalOfTransactionId?: string
  createdAt: string
  completedAt?: string
  replayed: boolean
  entries: LedgerEntry[]
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
