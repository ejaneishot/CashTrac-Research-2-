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
  const res = await sheets().spreadsheets.get({ spreadsheetId })
  return res.result as never
}

export async function valuesGet(spreadsheetId: string, range: string): Promise<string[][]> {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId, range })
  return res.result.values ?? []
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
    requestBody: { values },
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
    requestBody: { values },
  })
}

export async function createSpreadsheet(title: string): Promise<string> {
  // Drive API create returns the new file id
  const drive = window.gapi?.client.drive
  if (!drive) throw new Error('Drive API not loaded')
  const res = await drive.files.create({
    fields: 'id',
    requestBody: {
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
    requestBody: {
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
  const rows = await valuesGet(spreadsheetId, 'Transactions!A1:L')
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
  }))
}
