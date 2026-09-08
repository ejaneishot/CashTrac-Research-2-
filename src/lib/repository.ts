import { db } from './db'
import type { Account, AppData, Group, RevenueRow, Transaction } from '../types'
/**
 * Repository — the only place the app talks to the local database.
 * The store calls these methods; nothing else imports `db` directly.
 * This keeps all the storage detail in one file and gives the sync layer
 * (added later) a single seam to hook into.
 *
 * Two kinds of write:
 *  - hydrate*  : data coming FROM Sheets. It is the source of truth, so it
 *                lands as 'synced'.
 *  - save* / softDelete* : a local user edit. It has not reached Sheets yet,
 *                so it is stamped 'pending' with a fresh updatedAt.
 */

function now(): string {
  return new Date().toISOString()
}

// --- Reads -------------------------------------------------------------------

/** Load the workspace for the app to show. Soft-deleted rows are left out. */
export async function loadAll(): Promise<AppData> {
  const [groups, accounts, transactions, revenue] = await Promise.all([
    db.groups.toArray(),
    db.accounts.toArray(),
    db.transactions.filter((t) => !t.deletedAt).toArray(),
    db.revenue.toArray(),
  ])
  return { groups, accounts, transactions, revenue }
}

/** Local edits still waiting to be pushed to Sheets. Used by the sync layer. */
export async function pendingTransactions(): Promise<Transaction[]> {
  return db.transactions.where('syncState').equals('pending').toArray()
}

/**
 * Read path entry point for startup.
 * If the local database already has data, return it as-is — this keeps any
 * local edits (including ones still 'pending') intact across a refresh.
 * Only when the database is empty (a first run) does it seed from the given
 * source and return that. It never overwrites existing local data.
 */
export async function loadOrSeed(seed: AppData): Promise<AppData> {
  const existing = await loadAll()
  const isEmpty =
    existing.groups.length === 0 &&
    existing.accounts.length === 0 &&
    existing.transactions.length === 0 &&
    existing.revenue.length === 0
  if (isEmpty) {
    await hydrateAll(seed)
    return loadAll()
  }
  return existing
}

// --- Hydrate from Sheets (source of truth → local) ---------------------------

/**
 * Replace the local cache with a fresh pull from Sheets.
 * Everything lands as 'synced'. Note: this is a plain overwrite and does not
 * yet merge against local pending edits — that merge is the conflict step,
 * handled later. Call this only on a clean initial load for now.
 */
export async function hydrateAll(data: AppData): Promise<void> {
  await db.transaction('rw', db.transactions, db.accounts, db.groups, db.revenue, async () => {
    await Promise.all([
      db.transactions.clear(),
      db.accounts.clear(),
      db.groups.clear(),
      db.revenue.clear(),
    ])
    await Promise.all([
             db.transactions.bulkPut(
          data.transactions.map((t) => ({
            ...t,
            syncState: (t.syncState ?? 'synced') as Transaction['syncState'],
          })),
        ),
        db.accounts.bulkPut(data.accounts),
        db.groups.bulkPut(data.groups),
        db.revenue.bulkPut(data.revenue),
    ])
  })
}

// --- Local writes (user edit → local, pending) -------------------------------

/** Save a user edit to one transaction. Stamps updatedAt + 'pending'. */
export async function saveTransaction(tx: Transaction): Promise<void> {
  await db.transactions.put({ ...tx, updatedAt: now(), syncState: 'pending' })
}

/** Soft-delete a transaction: mark it removed but keep it for the next sync. */
export async function softDeleteTransaction(id: string): Promise<void> {
  const ts = now()
  await db.transactions.update(id, { deletedAt: ts, updatedAt: ts, syncState: 'pending' })
}

export async function saveAccount(account: Account): Promise<void> {
  await db.accounts.put(account)
}

export async function saveGroup(group: Group): Promise<void> {
  await db.groups.put(group)
}

export async function saveRevenue(row: RevenueRow): Promise<void> {
  await db.revenue.put(row)
}

export async function deleteRevenue(id: string): Promise<void> {
  await db.revenue.delete(id)
}

// --- Sync bookkeeping --------------------------------------------------------

/** Mark transactions as synced once they have been written back to Sheets. */
export async function markSynced(ids: string[]): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    await Promise.all(ids.map((id) => db.transactions.update(id, { syncState: 'synced' })))
  })
}

// Save imported transactions, skipping any that already exist. Returns the number of new rows added
export async function saveImportedTransactions(rows: Transaction[]): Promise<number> {
  if (rows.length === 0) return 0

  return db.transaction('rw', db.transactions, async () => {
    const found = await db.transactions.bulkGet(rows.map((r) => r.id))
    const known = new Set(found.filter((t): t is Transaction => Boolean(t)).map((t) => t.id))
    const fresh = rows.filter((r) => !known.has(r.id))
    await db.transactions.bulkPut(fresh)
    return fresh.length
  })
}

