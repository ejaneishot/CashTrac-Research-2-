import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import {
  loadAll,
  hydrateAll,
  loadOrSeed, // also added ts for repository 
  saveTransaction,
  softDeleteTransaction,
  pendingTransactions,
  saveAccount,
  saveRevenue,
  deleteRevenue,
  markSynced,
} from './repository'
import type { AppData, Account, RevenueRow, Transaction } from '../types'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    accountId: 'a1',
    date: '2026-09-01',
    description: 'Client payment',
    amount: 1000,
    marked: false,
    ...over,
  }
}

const sampleData: AppData = {
  groups: [{ id: 'fastrac', name: 'Fastrac', accountIds: ['a1'], owner: 'shared' }],
  accounts: [
    { id: 'a1', name: 'BCA', type: 'bank', owner: 'nirmal', groupId: 'fastrac', sheetId: 's1', currency: 'IDR' },
  ] as Account[],
  transactions: [tx({ id: 't1' }), tx({ id: 't2', amount: -500 })],
  revenue: [{ id: 'r1', date: '2026-09-01', type: 'unearned', description: 'Deposit', amount: 5000 }] as RevenueRow[],
}

// Start every test from an empty database.
beforeEach(async () => {
  await db.transactions.clear()
  await db.accounts.clear()
  await db.groups.clear()
  await db.revenue.clear()
})

describe('hydrateAll + loadAll', () => {
  it('loads a full workspace back out', async () => {
    await hydrateAll(sampleData)
    const data = await loadAll()
    expect(data.groups).toHaveLength(1)
    expect(data.accounts).toHaveLength(1)
    expect(data.transactions).toHaveLength(2)
    expect(data.revenue).toHaveLength(1)
  })

  it('marks hydrated transactions as synced, not pending', async () => {
    await hydrateAll(sampleData)
    const pending = await pendingTransactions()
    expect(pending).toHaveLength(0)
  })

  it('replaces existing data rather than appending', async () => {
    await hydrateAll(sampleData)
    await hydrateAll({ ...sampleData, transactions: [tx({ id: 'tX' })] })
    const data = await loadAll()
    expect(data.transactions.map((t) => t.id)).toEqual(['tX'])
  })
})

describe('saveTransaction', () => {
  it('stamps a local edit as pending with an updatedAt', async () => {
    await saveTransaction(tx({ id: 't1', marked: true, category: 'infra' }))
    const stored = await db.transactions.get('t1')
    expect(stored?.marked).toBe(true)
    expect(stored?.category).toBe('infra')
    expect(stored?.syncState).toBe('pending')
    expect(stored?.updatedAt).toBeTruthy()
  })

  it('shows up in pendingTransactions', async () => {
    await hydrateAll(sampleData)
    await saveTransaction(tx({ id: 't1', marked: true }))
    const pending = await pendingTransactions()
    expect(pending.map((t) => t.id)).toEqual(['t1'])
  })
})

describe('softDeleteTransaction', () => {
  it('hides the row from loadAll but keeps it in the table', async () => {
    await hydrateAll(sampleData)
    await softDeleteTransaction('t1')

    const data = await loadAll()
    expect(data.transactions.map((t) => t.id)).toEqual(['t2'])

    const raw = await db.transactions.get('t1')
    expect(raw?.deletedAt).toBeTruthy()
    expect(raw?.syncState).toBe('pending')
  })
})

describe('markSynced', () => {
  it('flips pending rows back to synced', async () => {
    await hydrateAll(sampleData)
    await saveTransaction(tx({ id: 't1', marked: true }))
    await saveTransaction(tx({ id: 't2', marked: true }))
    expect(await pendingTransactions()).toHaveLength(2)

    await markSynced(['t1', 't2'])
    expect(await pendingTransactions()).toHaveLength(0)
  })
})

describe('loadOrSeed', () => {
  it('seeds from the source when the database is empty', async () => {
    const data = await loadOrSeed(sampleData)
    expect(data.transactions).toHaveLength(2)
    expect(await pendingTransactions()).toHaveLength(0)
  })

  it('keeps existing local data and ignores the seed on a later run', async () => {
    await hydrateAll(sampleData)
    await saveTransaction(tx({ id: 't1', marked: true }))

    const data = await loadOrSeed({ ...sampleData, transactions: [tx({ id: 'DIFFERENT' })] })

    expect(data.transactions.map((t) => t.id).sort()).toEqual(['t1', 't2'])
    expect(await pendingTransactions()).toHaveLength(1)
  })
})

describe('accounts and revenue', () => {
  it('saves an account', async () => {
    await saveAccount(sampleData.accounts[0])
    const data = await loadAll()
    expect(data.accounts[0].name).toBe('BCA')
  })

  it('saves and deletes a revenue row', async () => {
    await saveRevenue(sampleData.revenue[0])
    expect((await loadAll()).revenue).toHaveLength(1)
    await deleteRevenue('r1')
    expect((await loadAll()).revenue).toHaveLength(0)
  })
})
