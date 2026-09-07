import type { AppData, Account, Transaction, RevenueRow, Workspace } from '../types'

/**
 * Mock mode — lets the whole UI run before Google credentials exist.
 * Data mirrors the real workspace layout: Fastrac group + personal groups.
 */

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const accounts: Account[] = [
  {
    id: 'bca-fastrac',
    name: 'BCA Fastrac',
    type: 'bank',
    owner: 'nirmal',
    groupId: 'fastrac',
    sheetId: 'mock-bca',
    currency: 'IDR',
    lastUpdated: daysAgo(2),
    lastTransactionDate: daysAgo(1),
    cadenceDays: 7,
  },
  {
    id: 'midtrans',
    name: 'Midtrans Gateway',
    type: 'gateway',
    owner: 'shared',
    groupId: 'fastrac',
    sheetId: 'mock-midtrans',
    currency: 'IDR',
    lastUpdated: daysAgo(4),
    lastTransactionDate: daysAgo(3),
    cadenceDays: 7,
  },
  {
    id: 'blu-nirmal',
    name: 'Blu — Nirmal',
    type: 'ewallet',
    owner: 'nirmal',
    groupId: 'fastrac',
    sheetId: 'mock-blu-nirmal',
    currency: 'IDR',
    lastUpdated: daysAgo(9),
    lastTransactionDate: daysAgo(8),
    cadenceDays: 7,
  },
  {
    id: 'jenius-nirmal',
    name: 'Jenius — Nirmal',
    type: 'bank',
    owner: 'nirmal',
    groupId: 'fastrac',
    sheetId: 'mock-jenius',
    currency: 'IDR',
    lastUpdated: daysAgo(15),
    lastTransactionDate: daysAgo(14),
    cadenceDays: 7,
  },
  {
    id: 'cash-reserve',
    name: 'Cash Reserve',
    type: 'cash',
    owner: 'nirmal',
    groupId: 'fastrac',
    sheetId: 'mock-cash',
    currency: 'IDR',
    lastUpdated: daysAgo(6),
    lastTransactionDate: daysAgo(5),
    cadenceDays: 14,
  },
  {
    id: 'blu-shalfin',
    name: 'Blu — Shalfin',
    type: 'ewallet',
    owner: 'shalfin',
    groupId: 'fastrac',
    sheetId: 'mock-blu-shalfin',
    currency: 'IDR',
    lastUpdated: daysAgo(12),
    lastTransactionDate: daysAgo(11),
    cadenceDays: 7,
  },
  {
    id: 'blu-personal-nirmal',
    name: 'Blu Personal',
    type: 'ewallet',
    owner: 'nirmal',
    groupId: 'nirmal-personal',
    sheetId: 'mock-personal-blu',
    currency: 'IDR',
    lastUpdated: daysAgo(3),
    lastTransactionDate: daysAgo(2),
    cadenceDays: 30,
  },
]

const groups: AppData['groups'] = [
  {
    id: 'fastrac',
    name: 'Fastrac / Arcitech',
    accountIds: ['bca-fastrac', 'midtrans', 'blu-nirmal', 'jenius-nirmal', 'cash-reserve', 'blu-shalfin'],
    owner: 'shared',
  },
  {
    id: 'nirmal-personal',
    name: 'Nirmal Personal',
    accountIds: ['blu-personal-nirmal'],
    owner: 'nirmal',
  },
]

const t = (
  accountId: string,
  dateOffset: number,
  description: string,
  amount: number,
  category?: string,
  marked = true,
): Transaction => ({
  id: `${accountId}-${dateOffset}-${Math.abs(amount)}`,
  accountId,
  date: daysAgo(dateOffset),
  description,
  category,
  amount,
  marked,
  balance: undefined,
  source: 'mock-import.csv',
  sourceLink: 'https://drive.google.com',
  importedAt: daysAgo(Math.min(dateOffset, 20)),
})

const transactions: Transaction[] = [
  // BCA Fastrac — company operating
  t('bca-fastrac', 1, 'Client payment — Arcitech project', 48_500_000, 'Revenue'),
  t('bca-fastrac', 2, 'Transfer to Blu Nirmal', -25_000_000, 'Transfer', false),
  t('bca-fastrac', 4, 'AWS hosting invoice', -2_340_000, 'Infrastructure'),
  t('bca-fastrac', 6, 'Client payment — Fastrac retainer', 32_000_000, 'Revenue'),
  t('bca-fastrac', 9, 'Internet — Biznet', -1_250_000, 'Utilities'),
  t('bca-fastrac', 12, 'Office rent', -8_000_000, 'Rent', false),
  // Midtrans — gateway settlements
  t('midtrans', 3, 'Settlement — online orders', 18_750_000, 'Revenue'),
  t('midtrans', 5, 'Settlement — online orders', 12_300_000, 'Revenue'),
  t('midtrans', 8, 'Gateway fee', -295_000, 'Fees', false),
  // Blu Nirmal — company e-wallet
  t('blu-nirmal', 2, 'Transfer from BCA', 25_000_000, 'Transfer'),
  t('blu-nirmal', 7, 'Team lunch', -650_000, 'Meals'),
  t('blu-nirmal', 10, 'Gojek — client visit', -180_000, 'Transport'),
  // Jenius Nirmal
  t('jenius-nirmal', 14, 'Transfer from BCA', 15_000_000, 'Transfer'),
  t('jenius-nirmal', 20, 'Software subscription', -540_000, 'Software'),
  // Cash reserve
  t('cash-reserve', 5, 'Cash deposit', 10_000_000, 'Transfer'),
  t('cash-reserve', 13, 'Petty cash — supplies', -750_000, 'Supplies'),
  // Blu Shalfin
  t('blu-shalfin', 11, 'Client visit — transport', -420_000, 'Transport'),
  t('blu-shalfin', 15, 'Team dinner', -890_000, 'Meals'),
  // Personal
  t('blu-personal-nirmal', 2, 'Personal spending', -1_200_000, 'Personal'),
  t('blu-personal-nirmal', 6, 'Personal top-up', 5_000_000, 'Personal'),
]

const revenue: RevenueRow[] = [
  {
    id: 'rev-1',
    date: daysAgo(30),
    type: 'unearned',
    description: 'Arcitech — advance for Q3',
    amount: 25_000_000,
    note: 'Paid upfront, work ongoing',
  },
  {
    id: 'rev-2',
    date: daysAgo(15),
    type: 'unbilled',
    description: 'Fastrac retainer — August',
    amount: 32_000_000,
    note: 'Invoice to be sent',
  },
  {
    id: 'rev-3',
    date: daysAgo(4),
    type: 'unearned',
    description: 'Fastrac retainer — September',
    amount: 32_000_000,
    note: 'Paid in advance',
  },
]

export const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-fastrac',
    name: 'PT Fastrac',
    folderId: 'mock-folder-fastrac',
    folderLink: 'https://drive.google.com/drive/folders/mock-folder-fastrac',
  },
  {
    id: 'ws-nirmal',
    name: 'Nirmal Personal',
    folderId: 'mock-folder-nirmal',
    folderLink: 'https://drive.google.com/drive/folders/mock-folder-nirmal',
  },
]

export const mockData: AppData = {
  groups,
  accounts,
  transactions,
  revenue,
  lastSyncAt: new Date().toISOString(),
}
