import { describe, it, expect } from 'vitest'
import {
  normalizeHeader,
  detectColumns,
  directionMarker,
  signedAmount,
  toRawRows,
  computeTally,
  lastKnownBalance,
  recordsFromMatrix,
  buildImportReport,
} from './importer'
import { normalizeRow } from './fingerprint'
import type { Transaction } from '../types'

// A small BCA-shaped statement, oldest row first.
// Opening balance 1.000.000, one payment in, two payments out.
//   1.000.000 + 500.000 - 250.000 = 1.250.000
function rec(date: string, desc: string, amount: string, balance: string) {
  return { Tanggal: date, Keterangan: desc, Mutasi: amount, Saldo: balance }
}

const statement = [
  rec('01/09/2026', 'Client payment Arcitech', '500.000', '1.500.000'),
  rec('02/09/2026', 'Gojek ride', '50.000 DB', '1.450.000'),
  rec('03/09/2026', 'AWS servers', '200.000 DB', '1.250.000'),
]

const NOW = '2026-09-08T00:00:00.000Z'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 'x1',
    accountId: 'a1',
    date: '2026-08-31',
    description: 'Older row',
    amount: -1000,
    marked: true,
    ...over,
  }
}

function report(records: Record<string, string>[], existing: Transaction[] = []) {
  return buildImportReport({
    filename: 'bca-sept.csv',
    accountId: 'a1',
    records,
    existing,
    now: NOW,
  })
}

describe('normalizeHeader', () => {
  it('lowercases and reduces punctuation to single spaces', () => {
    expect(normalizeHeader('  Saldo/Akhir ')).toBe('saldo akhir')
    expect(normalizeHeader('DB_CR')).toBe('db cr')
  })
})

describe('detectColumns', () => {
  it('reads Indonesian headers', () => {
    expect(detectColumns(['Tanggal', 'Keterangan', 'Mutasi', 'Saldo'])).toEqual({
      date: 'Tanggal',
      description: 'Keterangan',
      amount: 'Mutasi',
      balance: 'Saldo',
    })
  })

  it('reads English headers with split debit and credit', () => {
    const map = detectColumns(['Date', 'Description', 'Debit', 'Credit', 'Balance'])
    expect(map.date).toBe('Date')
    expect(map.debit).toBe('Debit')
    expect(map.credit).toBe('Credit')
    expect(map.amount).toBeUndefined()
  })

  it('gives each header to one field only', () => {
    const map = detectColumns(['Tanggal', 'Keterangan', 'Mutasi Debet', 'Saldo Akhir'])
    expect(map.debit).toBe('Mutasi Debet')
    expect(map.balance).toBe('Saldo Akhir')
    expect(map.amount).toBeUndefined()
  })

  it('returns nothing for headers it does not recognise', () => {
    expect(detectColumns(['foo', 'bar'])).toEqual({})
  })
})

describe('directionMarker', () => {
  it('reads debit and credit markers', () => {
    expect(directionMarker('50.000 DB')).toBe('out')
    expect(directionMarker('500.000 CR')).toBe('in')
    expect(directionMarker('K')).toBe('in')
  })

  it('returns nothing when there is no marker', () => {
    expect(directionMarker('500.000')).toBeNull()
    expect(directionMarker('Rp 500.000')).toBeNull()
  })
})

describe('signedAmount', () => {
  const split = detectColumns(['Date', 'Description', 'Debit', 'Credit', 'Balance'])

  it('treats credit as money in and debit as money out', () => {
    expect(signedAmount({ Debit: '', Credit: '500.000' }, split)).toBe(500_000)
    expect(signedAmount({ Debit: '50.000', Credit: '' }, split)).toBe(-50_000)
  })

  it('returns nothing when both debit and credit are empty', () => {
    expect(signedAmount({ Debit: '', Credit: '' }, split)).toBeNull()
  })

  it('applies a DB marker sitting next to the amount', () => {
    const map = detectColumns(['Tanggal', 'Keterangan', 'Mutasi', 'Saldo'])
    expect(signedAmount({ Mutasi: '50.000 DB' }, map)).toBe(-50_000)
    expect(signedAmount({ Mutasi: '500.000' }, map)).toBe(500_000)
  })
})

describe('toRawRows', () => {
  const map = detectColumns(['Tanggal', 'Keterangan', 'Mutasi', 'Saldo'])

  it('leaves out lines with no amount, since they are not transactions', () => {
    const rows = toRawRows([...statement, rec('04/09/2026', 'Saldo awal', '', '1.250.000')], map)
    expect(rows).toHaveLength(3)
  })

  it('passes an unreadable amount through so it can be reported', () => {
    const rows = toRawRows([rec('04/09/2026', 'Odd row', 'lima ratus', '1.250.000')], map)
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe('lima ratus')
  })
})

describe('computeTally', () => {
  function normalized(records: Record<string, string>[]) {
    const map = detectColumns(['Tanggal', 'Keterangan', 'Mutasi', 'Saldo'])
    return toRawRows(records, map).flatMap((r) => {
      const res = normalizeRow(r)
      return res.ok ? [res.row] : []
    })
  }

  it('tallies a statement that adds up', () => {
    const t = computeTally(normalized(statement))
    expect(t.available).toBe(true)
    expect(t.saldoAwal).toBe(1_000_000)
    expect(t.saldoAkhir).toBe(1_250_000)
    expect(t.inflows).toBe(500_000)
    expect(t.outflows).toBe(250_000)
    expect(t.tallied).toBe(true)
    expect(t.difference).toBe(0)
  })

  it('flags a mismatch and reports the size of it', () => {
    const broken = [...statement.slice(0, 2), rec('03/09/2026', 'AWS servers', '200.000 DB', '1.300.000')]
    const t = computeTally(normalized(broken))
    expect(t.tallied).toBe(false)
    expect(t.difference).toBe(-50_000)
  })

  it('handles a file listed newest first', () => {
    const t = computeTally(normalized([...statement].reverse()))
    expect(t.saldoAwal).toBe(1_000_000)
    expect(t.tallied).toBe(true)
  })

  it('says so when the file has no running balance', () => {
    const map = detectColumns(['Tanggal', 'Keterangan', 'Mutasi'])
    const rows = toRawRows(
      statement.map(({ Tanggal, Keterangan, Mutasi }) => ({ Tanggal, Keterangan, Mutasi })),
      map,
    ).flatMap((r) => {
      const res = normalizeRow(r)
      return res.ok ? [res.row] : []
    })
    const t = computeTally(rows)
    expect(t.available).toBe(false)
    expect(t.inflows).toBe(500_000)
    expect(t.outflows).toBe(250_000)
  })
})

describe('lastKnownBalance', () => {
  it('takes the balance from the latest row of that account', () => {
    const txns = [
      tx({ id: '1', date: '2026-08-01', balance: 700_000 }),
      tx({ id: '2', date: '2026-08-31', balance: 900_000 }),
      tx({ id: '3', accountId: 'a2', date: '2026-09-05', balance: 5_000 }),
    ]
    expect(lastKnownBalance(txns, 'a1')).toBe(900_000)
  })

  it('returns nothing when no row carries a balance', () => {
    expect(lastKnownBalance([tx()], 'a1')).toBeUndefined()
  })
})

describe('recordsFromMatrix', () => {
  it('skips the title lines above the real header', () => {
    const matrix = [
      ['REKENING KORAN'],
      ['Periode 01/09/2026 - 30/09/2026'],
      ['Tanggal', 'Keterangan', 'Mutasi', 'Saldo'],
      ['01/09/2026', 'Client payment Arcitech', '500.000', '1.500.000'],
    ]
    const { records, headerRow } = recordsFromMatrix(matrix)
    expect(headerRow).toBe(2)
    expect(records).toHaveLength(1)
    expect(records[0].Keterangan).toBe('Client payment Arcitech')
  })

  it('returns nothing when no row looks like a header', () => {
    expect(recordsFromMatrix([['foo', 'bar'], ['1', '2']]).headerRow).toBe(-1)
  })
})

describe('buildImportReport', () => {
  it('imports every row of a fresh statement', () => {
    const r = report(statement)
    expect(r.rowsFound).toBe(3)
    expect(r.rowsNew).toBe(3)
    expect(r.rowsDuplicate).toBe(0)
    expect(r.errors).toHaveLength(0)
    expect(r.tally.tallied).toBe(true)
  })

  it('builds transactions ready to save', () => {
    const t = report(statement).transactions[0]
    expect(t.accountId).toBe('a1')
    expect(t.date).toBe('2026-09-01')
    expect(t.amount).toBe(500_000)
    expect(t.balance).toBe(1_500_000)
    expect(t.description).toBe('Client payment Arcitech') // original text, not the normalized one
    expect(t.marked).toBe(false)
    expect(t.syncState).toBe('pending')
    expect(t.source).toBe('bca-sept.csv')
    expect(t.importedAt).toBe(NOW)
  })

  it('gives the same row the same id every time, so a re-import cannot double up', () => {
    expect(report(statement).transactions.map((t) => t.id)).toEqual(
      report(statement).transactions.map((t) => t.id),
    )
  })

  it('skips rows the ledger already has', () => {
    const first = report(statement)
    const second = report(statement, first.transactions)
    expect(second.rowsNew).toBe(0)
    expect(second.rowsDuplicate).toBe(3)
  })

  it('still tallies when part of the file was already imported', () => {
    const first = report(statement)
    const overlap = report(statement, first.transactions.slice(0, 1))
    expect(overlap.rowsNew).toBe(2)
    expect(overlap.rowsDuplicate).toBe(1)
    expect(overlap.tally.tallied).toBe(true) // the skipped row still moved the balance
  })

  it('only dedups against the same account', () => {
    const other = report(statement).transactions.map((t) => ({ ...t, accountId: 'a2' }))
    expect(report(statement, other).rowsNew).toBe(3)
  })

  it('imports a row repeated inside the file once', () => {
    const r = report([statement[0], statement[0], statement[1]])
    expect(r.rowsNew).toBe(2)
    expect(r.rowsDuplicate).toBe(1)
  })

  it('reports rows it could not read instead of dropping them silently', () => {
    const r = report([...statement, rec('bukan tanggal', 'Broken row', '10.000', '1.240.000')])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].reason).toContain('Unreadable date')
    expect(r.rowsNew).toBe(3)
  })

  it('flags a gap between this statement and the ledger', () => {
    const r = report(statement, [tx({ date: '2026-08-31', balance: 900_000 })])
    expect(r.continuityGap).toBe(100_000) // file opens at 1.000.000, ledger ended at 900.000
  })

  it('reports no gap when the statement carries on from the ledger', () => {
    const r = report(statement, [tx({ date: '2026-08-31', balance: 1_000_000 })])
    expect(r.continuityGap).toBeUndefined()
  })
})