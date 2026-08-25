/**
 * Setup wizard data layer — creates the `_cashtrac` structure inside a
 * workspace folder and bootstraps the Meta spreadsheet.
 */

import { createSpreadsheet, ensureSheetTabs, valuesUpdate } from './sheets'
import { createFolder, resolveFile } from './drive'
import type { Group } from '../types'

export const META_HEADERS = {
  accounts: ['id', 'name', 'type', 'owner', 'groupId', 'sheetId', 'currency', 'lastUpdated', 'lastTransactionDate', 'cadenceDays'],
  groups: ['id', 'name', 'accountIds', 'owner'],
  revenue: ['id', 'date', 'type', 'description', 'amount', 'driveLink', 'note'],
}

export interface SetupResult {
  rootFolderId: string
  metaFolderId: string
  ledgersFolderId: string
  statementsFolderId: string
  metaSpreadsheetId: string
}

/**
 * Verify a Drive folder link resolves and is accessible.
 * Returns the folder id, or an error describing what went wrong.
 */
export async function verifyWorkspaceFolder(folderLink: string): Promise<{ ok: true; folderId: string } | { ok: false; error: string }> {
  const m = folderLink.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (!m) return { ok: false, error: 'That link does not look like a Drive folder link.' }
  const folderId = m[1]
  const file = await resolveFile(folderId)
  if (!file) return { ok: false, error: 'Could not open that folder. Is it shared with you?' }
  return { ok: true, folderId }
}

/**
 * Create the `_cashtrac` structure inside a workspace folder:
 *   _cashtrac/
 *     meta/            → Meta spreadsheet (Accounts, Groups, Revenue tabs)
 *     ledgers/         → one spreadsheet per account (created by caller)
 *     statements/      → raw statement files
 */
export async function initWorkspaceStructure(folderId: string): Promise<SetupResult> {
  const rootFolderId = await createFolder(folderId, '_cashtrac')
  const metaFolderId = await createFolder(rootFolderId, 'meta')
  const ledgersFolderId = await createFolder(rootFolderId, 'ledgers')
  const statementsFolderId = await createFolder(rootFolderId, 'statements')

  const metaSpreadsheetId = await createSpreadsheet('Meta')
  await ensureSheetTabs(metaSpreadsheetId, ['Accounts', 'Groups', 'Revenue'])

  // Seed headers
  await valuesUpdate(metaSpreadsheetId, 'Accounts!A1', [META_HEADERS.accounts])
  await valuesUpdate(metaSpreadsheetId, 'Groups!A1', [META_HEADERS.groups])
  await valuesUpdate(metaSpreadsheetId, 'Revenue!A1', [META_HEADERS.revenue])

  // Move the Meta spreadsheet into the meta/ folder (Drive create defaults to root)
  const drive = window.gapi?.client.drive
  if (drive) {
    await drive.files.update({
      fileId: metaSpreadsheetId,
      addParents: metaFolderId,
      removeParents: 'root',
      fields: 'id,parents',
    })
  }

  return { rootFolderId, metaFolderId, ledgersFolderId, statementsFolderId, metaSpreadsheetId }
}

/**
 * Create a ledger spreadsheet for an account and move it into ledgers/.
 * Returns the spreadsheet id.
 */
export async function createLedgerSpreadsheet(accountName: string, ledgersFolderId: string): Promise<string> {
  const id = await createSpreadsheet(`Ledger — ${accountName}`)
  await ensureSheetTabs(id, ['Transactions', 'Imports'])

  const drive = window.gapi?.client.drive
  if (drive) {
    await drive.files.update({
      fileId: id,
      addParents: ledgersFolderId,
      removeParents: 'root',
      fields: 'id,parents',
    })
  }
  return id
}

/**
 * Bootstrap the Meta spreadsheet with the standard groups.
 * Accounts get added later via the UI; this just seeds the group rows.
 */
export async function seedGroups(metaSpreadsheetId: string, groups: Group[]): Promise<void> {
  const values = [
    META_HEADERS.groups,
    ...groups.map((g) => [g.id, g.name, g.accountIds.join(', '), g.owner]),
  ]
  await valuesUpdate(metaSpreadsheetId, 'Groups!A1', values)
}
