/**
 * Sync engine — pushes pending local edits up to the ledger spreadsheets.
 */

import type { Account } from '../types'
import { pendingTransactions, markSynced } from './repository'
import { updateTransactionRows } from './sheets'

export interface FlushResult {
  pushed: number
  skipped: number
}

/**
 * Send every pending transaction edit to its account's ledger.
 * Rows that don't exist remotely yet are left pending for the import path.
 */
export async function flushPending(accounts: Account[]): Promise<FlushResult> {
  const pending = await pendingTransactions()
  if (pending.length === 0) return { pushed: 0, skipped: 0 }

  const sheetIdByAccount = new Map(accounts.map((a) => [a.id, a.sheetId]))
  const byAccount = new Map<string, typeof pending>()

  for (const t of pending) {
    const list = byAccount.get(t.accountId) ?? []
    list.push(t)
    byAccount.set(t.accountId, list)
  }

  const synced: string[] = []

  for (const [accountId, rows] of byAccount) {
    const sheetId = sheetIdByAccount.get(accountId)
    if (!sheetId || sheetId.startsWith('mock-')) continue
    const written = await updateTransactionRows(sheetId, rows)
    synced.push(...written)
  }

  if (synced.length > 0) await markSynced(synced)

  return { pushed: synced.length, skipped: pending.length - synced.length }
}