export type OwnerId = 'nirmal' | 'shalfin' | 'shared'

export type AccountType = 'bank' | 'ewallet' | 'cash' | 'gateway'

export type GroupId = string

export interface Group {
  id: GroupId
  name: string
  accountIds: string[]
  owner: OwnerId | 'shared'
}

export interface Account {
  id: string
  name: string
  type: AccountType
  owner: OwnerId
  groupId: GroupId
  sheetId: string
  currency: string
  lastUpdated?: string // ISO date — last statement import
  lastTransactionDate?: string // ISO date — most recent transaction
  cadenceDays?: number // expected statement cadence, for staleness
}

export interface Transaction {
  id: string
  accountId: string
  date: string // YYYY-MM-DD
  description: string
  category?: string
  amount: number // integer rupiah, negative = outflow
  balance?: number
  source?: string // import filename
  sourceLink?: string // Drive link to raw statement
  importedAt?: string
  marked: boolean
  invoiceLink?: string
  notes?: string
  fingerprint?: string
}

export interface RevenueRow {
  id: string
  date: string
  type: 'unearned' | 'unbilled'
  description: string
  amount: number // positive integer rupiah
  driveLink?: string
  note?: string
}

export interface Category {
  id: string
  name: string
  key: string // '1' - '9' keyboard shortcut
  color: string
  type: 'expense' | 'income' | 'both'
}

export interface Workspace {
  id: string
  name: string
  folderId: string
  folderLink: string
}

export interface AppData {
  groups: Group[]
  accounts: Account[]
  transactions: Transaction[]
  revenue: RevenueRow[]
  lastSyncAt?: string
}
