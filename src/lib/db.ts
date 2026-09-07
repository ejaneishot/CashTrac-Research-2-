import Dexie, { type Table } from 'dexie'
import type { Account, Group, RevenueRow, Transaction } from '../types'

/**
 * Local-first cache of the workspace, backed by IndexedDB via Dexie.
 * This mirrors what lives in Google Sheets so the app can read and write
 * instantly and sync in the background.
 *
 * Schema notes:
 *  - The first field in each store string is the primary key.
 *  - The rest are secondary indexes, listed only for fields we actually
 *    query or sort by. Adding an index we never query just costs write time.
 */
export class CashTracDB extends Dexie {
  transactions!: Table<Transaction, string>
  accounts!: Table<Account, string>
  groups!: Table<Group, string>
  revenue!: Table<RevenueRow, string>

  constructor() {
    super('cashtrac')
    this.version(1).stores({
      // id (pk); indexed by account for the ledger view, date for sorting,
      // marked for the triage filter, fingerprint for dedup, syncState to
      // find local edits still waiting to reach Sheets.
      transactions: 'id, accountId, date, marked, fingerprint, syncState',
      // id (pk); indexed by group for grouped views.
      accounts: 'id, groupId',
      groups: 'id',
      // id (pk); indexed by type for the unearned/unbilled split.
      revenue: 'id, type',
    })
  }
}

export const db = new CashTracDB()