/**
 * Google Sheets API wrappers — typed thin layer over gapi.client.sheets.
 */

import type { Account, Group, RevenueRow, Transaction } from '../types'

function sheets() {
  const s = window.gapi?.client.sheets
  if (!s) throw new Error('Sheets API not loaded')
  return s
}

export async function spreadsheetGet(spreadsheetId: string): Promise<{ spreadsheetId: string; sheets: { properties: { sheetId: number; title: string } }[] }> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
        const res = await sheets().spreadsheets.get({ spreadsheetId, fields: 'spreadsheetId,sheets.properties(sheetId,title)' })
      return res.result as never
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
    }
  }
  throw lastErr
}

export async function valuesGet(spreadsheetId: string, range: string): Promise<string[][]> {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId, range })
  return res.result.values ?? []
}

export async function valuesBatchGet(
  spreadsheetId: string,
  ranges: string[],
): Promise<string[][][]> {
  const res = await sheets().spreadsheets.values.batchGet({ spreadsheetId, ranges })
  const result = res.result as { valueRanges?: { values?: string[][] }[] }
  return (result.valueRanges ?? []).map((vr) => vr.values ?? [])
}

export async function valuesAppend(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][],
): Promise<void> {
  await sheets().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values },
  })
}

export async function valuesUpdate(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][],
): Promise<void> {
  await sheets().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  })
}

export async function createSpreadsheet(title: string): Promise<string> {
  // Drive API create returns the new file id
  const drive = window.gapi?.client.drive
  if (!drive) throw new Error('Drive API not loaded')
  const res = await drive.files.create({
    fields: 'id',
    resource: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
  })
  return res.result.id
}

export async function ensureSheetTabs(spreadsheetId: string, tabs: string[]): Promise<void> {
  const info = await spreadsheetGet(spreadsheetId)
  const existing = new Set(info.sheets.map((s) => s.properties.title))
  const missing = tabs.filter((t) => !existing.has(t))
  if (missing.length === 0) return

  await sheets().spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: missing.map((title) => ({
        addSheet: { properties: { title } },
      })),
    },
  })
}

export async function appendRows(
  spreadsheetId: string,
  tab: string,
  rows: Transaction[],
): Promise<void> {
  if (rows.length === 0) return
      const values = rows.map((t) => [
    t.id,
    t.accountId,
    t.date,
    t.description,
    t.category ?? '',
    t.amount,
    t.balance ?? '',
    t.source ?? '',
    t.sourceLink ?? '',
    t.fingerprint ?? '',
    t.importedAt ?? '',
    t.marked ? 'TRUE' : 'FALSE',
    t.invoiceLink ?? '',
    t.notes ?? '',
    t.updatedAt ?? '',
    t.syncState ?? '',
    t.deletedAt ?? '',
  ])
  await valuesAppend(spreadsheetId, `${tab}!A1`, values)
}

// --- Meta sheet serialization -------------------------------------------------

const REVENUE_HEADERS = ['id', 'date', 'type', 'description', 'amount', 'driveLink', 'note']

export async function readAccounts(spreadsheetId: string): Promise<Account[]> {
  const rows = await valuesGet(spreadsheetId, 'Accounts!A1:J')
  const header = rows[0] ?? []
  const idx = (name: string) => header.indexOf(name)
  return rows.slice(1).filter((r) => r[0]).map((r) => ({
    id: r[idx('id')],
    name: r[idx('name')],
    type: (r[idx('type')] as Account['type']) ?? 'bank',
    owner: (r[idx('owner')] as Account['owner']) ?? 'nirmal',
    groupId: r[idx('groupId')],
    sheetId: r[idx('sheetId')],
    currency: r[idx('currency')] ?? 'IDR',
    lastUpdated: r[idx('lastUpdated')] || undefined,
    lastTransactionDate: r[idx('lastTransactionDate')] || undefined,
    cadenceDays: r[idx('cadenceDays')] ? Number(r[idx('cadenceDays')]) : undefined,
  }))
}

export async function readGroups(spreadsheetId: string): Promise<Group[]> {
  const rows = await valuesGet(spreadsheetId, 'Groups!A1:D')
  const header = rows[0] ?? []
  const idx = (name: string) => header.indexOf(name)
  return rows.slice(1).filter((r) => r[0]).map((r) => ({
    id: r[idx('id')],
    name: r[idx('name')],
    accountIds: (r[idx('accountIds')] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    owner: (r[idx('owner')] as Group['owner']) ?? 'shared',
  }))
}

export async function readRevenue(spreadsheetId: string): Promise<RevenueRow[]> {
  const rows = await valuesGet(spreadsheetId, 'Revenue!A1:G')
  const header = rows[0] ?? []
  const idx = (name: string) => header.indexOf(name)
  return rows.slice(1).filter((r) => r[0]).map((r) => ({
    id: r[idx('id')],
    date: r[idx('date')],
    type: (r[idx('type')] as RevenueRow['type']) ?? 'unearned',
    description: r[idx('description')],
    amount: Number(r[idx('amount')]) || 0,
    driveLink: r[idx('driveLink')] || undefined,
    note: r[idx('note')] || undefined,
  }))
}

export async function writeRevenueRows(spreadsheetId: string, rows: RevenueRow[]): Promise<void> {
  const values = [REVENUE_HEADERS, ...rows.map((r) => [
    r.id, r.date, r.type, r.description, r.amount, r.driveLink ?? '', r.note ?? '',
  ])]
  await valuesUpdate(spreadsheetId, 'Revenue!A1', values)
}

export async function readTransactions(spreadsheetId: string): Promise<Transaction[]> {
  const rows = await valuesGet(spreadsheetId, 'Transactions!A1:Q')
  const header = rows[0] ?? []
  const idx = (name: string) => header.indexOf(name)
  return rows.slice(1).filter((r) => r[0]).map((r) => ({
    id: r[idx('id')],
    accountId: r[idx('accountId')],
    date: r[idx('date')],
    description: r[idx('description')],
    category: r[idx('category')] || undefined,
    amount: Number(r[idx('amount')]) || 0,
    balance: r[idx('balance')] ? Number(r[idx('balance')]) : undefined,
    source: r[idx('source')] || undefined,
    sourceLink: r[idx('sourceLink')] || undefined,
    importedAt: r[idx('importedAt')] || undefined,
    marked: (r[idx('marked')] ?? '').toUpperCase() === 'TRUE',
    invoiceLink: r[idx('invoiceLink')] || undefined,
    notes: r[idx('notes')] || undefined,
    fingerprint: r[idx('fingerprint')] || undefined,
    updatedAt: r[idx('updatedAt')] || undefined,
    syncState: (r[idx('syncState')] as Transaction['syncState']) || undefined,
    deletedAt: r[idx('deletedAt')] || undefined,
  }))
}
  
// Read Accounts, Groups and Revenue from the Meta spreadsheet in one request
export async function readMeta(spreadsheetId: string): Promise<{
  accounts: Account[]
  groups: Group[]
  revenue: RevenueRow[]
}> {
  const [accountRows, groupRows, revenueRows] = await valuesBatchGet(spreadsheetId, [
    'Accounts!A1:J',
    'Groups!A1:D',
    'Revenue!A1:G',
  ])

  const parse = <T>(rows: string[][], build: (idx: (n: string) => number, r: string[]) => T): T[] => {
    const header = rows[0] ?? []
    const idx = (name: string) => header.indexOf(name)
    return rows.slice(1).filter((r) => r[0]).map((r) => build(idx, r))
  }

  const accounts = parse<Account>(accountRows, (idx, r) => ({
    id: r[idx('id')],
    name: r[idx('name')],
    type: (r[idx('type')] as Account['type']) ?? 'bank',
    owner: (r[idx('owner')] as Account['owner']) ?? 'nirmal',
    groupId: r[idx('groupId')],
    sheetId: r[idx('sheetId')],
    currency: r[idx('currency')] ?? 'IDR',
    lastUpdated: r[idx('lastUpdated')] || undefined,
    lastTransactionDate: r[idx('lastTransactionDate')] || undefined,
    cadenceDays: r[idx('cadenceDays')] ? Number(r[idx('cadenceDays')]) : undefined,
  }))

  const groups = parse<Group>(groupRows, (idx, r) => ({
    id: r[idx('id')],
    name: r[idx('name')],
    accountIds: (r[idx('accountIds')] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    owner: (r[idx('owner')] as Group['owner']) ?? 'shared',
  }))

  const revenue = parse<RevenueRow>(revenueRows, (idx, r) => ({
    id: r[idx('id')],
    date: r[idx('date')],
    type: (r[idx('type')] as RevenueRow['type']) ?? 'unearned',
    description: r[idx('description')],
    amount: Number(r[idx('amount')]) || 0,
    driveLink: r[idx('driveLink')] || undefined,
    note: r[idx('note')] || undefined,
  }))

  return { accounts, groups, revenue }
}

// Read transactions from every account's ledger spreadsheet
export async function readAllTransactions(accounts: Account[]): Promise<{
  transactions: Transaction[]
  failedAccountIds: string[]
}> {
  const withSheets = accounts.filter((a) => a.sheetId && !a.sheetId.startsWith('mock-'))
  const failedAccountIds: string[] = []

  const results = await Promise.all(
    withSheets.map(async (a) => {
      try {
        return await readTransactions(a.sheetId)
      } catch {
        failedAccountIds.push(a.id)
        return []
      }
    }),
  )

  return { transactions: results.flat(), failedAccountIds }
}

export async function appendRawRows(
  spreadsheetId: string,
  tab: string,
  rows: (string | number | boolean | null)[][],
): Promise<void> {
  if (rows.length === 0) return
  await valuesAppend(spreadsheetId, `${tab}!A1`, rows)
}

/** Turn a transaction into a sheet row, in TRANSACTION_HEADERS order. */
function transactionToRow(t: Transaction): (string | number)[] {
  return [
    t.id, t.accountId, t.date, t.description, t.category ?? '',
    t.amount, t.balance ?? '', t.source ?? '', t.sourceLink ?? '',
    t.fingerprint ?? '', t.importedAt ?? '', t.marked ? 'TRUE' : 'FALSE',
    t.invoiceLink ?? '', t.notes ?? '', t.updatedAt ?? '',
    'synced', t.deletedAt ?? '',
  ]
}

// Update existing transaction rows in the sheet. Returns the ids of the updated transactions.
export async function updateTransactionRows(
  spreadsheetId: string,
  rows: Transaction[],
): Promise<string[]> {
  if (rows.length === 0) return []

  const existing = await valuesGet(spreadsheetId, 'Transactions!A1:Q')
  const rowIndexById = new Map<string, number>()
  existing.slice(1).forEach((r, i) => {
    if (r[0]) rowIndexById.set(r[0], i + 2)
  })

  const data = rows
    .filter((t) => rowIndexById.has(t.id))
    .map((t) => ({
      range: `Transactions!A${rowIndexById.get(t.id)}:Q${rowIndexById.get(t.id)}`,
      values: [transactionToRow(t)],
    }))

  const missing = rows.filter((t) => !rowIndexById.has(t.id))
  if (missing.length > 0) {
    await appendRawRows(spreadsheetId, 'Transactions', missing.map((t) => transactionToRow(t)))
  }

  if (data.length === 0) return rows.map((t) => t.id)

  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: { valueInputOption: 'USER_ENTERED', data },
  })

  return rows.map((t) => t.id)
}