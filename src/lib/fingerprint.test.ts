import { describe, it, expect } from 'vitest'
import {
  normalizeDescription,
  hashString,
  normalizeRow,
  classifyRows,
  existingFingerprintSet,
  type RawRow,
} from './fingerprint'
import type { Transaction } from '../types'

describe('normalizeDescription', () => {
  it('lowercases, strips punctuation and collapses spaces', () => {
    expect(normalizeDescription('Client Payment — Arcitech!!')).toBe('client payment arcitech')
    expect(normalizeDescription('  MULTIPLE   spaces  ')).toBe('multiple spaces')
    expect(normalizeDescription('Gojek #123 @client')).toBe('gojek 123 client')
  })
})

describe('hashString', () => {
  it('is deterministic for the same input', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
  })

  it('differs for different input', () => {
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })

  it('returns a non-empty string', () => {
    expect(hashString('anything').length).toBeGreaterThan(0)
  })
})

describe('normalizeRow', () => {
  it('normalizes a valid row and produces a fingerprint', () => {
    const res = normalizeRow({ date: '2026-09-04', description: 'Client payment — Arcitech', amount: '48.500.000' })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.row.date).toBe('2026-09-04')
      expect(res.row.amount).toBe(48_500_000)
      expect(res.row.description).toBe('client payment arcitech')
      expect(res.row.fingerprint).toBe('5ncnfo')
    }
  })

  it('rejects an unreadable date', () => {
    const res = normalizeRow({ date: 'not-a-date', description: 'x', amount: 100 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('Unreadable date')
  })

  it('rejects a missing description', () => {
    const res = normalizeRow({ date: '2026-09-04', description: '   ', amount: 100 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('Missing description')
  })

  it('rejects a bad amount', () => {
    const res = normalizeRow({ date: '2026-09-04', description: 'x', amount: 'abc' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('Bad amount')
  })

  it('rejects a bad balance when one is given', () => {
    const res = normalizeRow({ date: '2026-09-04', description: 'x', amount: 100, balance: 'xyz' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('Bad balance')
  })

  it('folds balance into the fingerprint when present', () => {
    const withoutBalance = normalizeRow({ date: '2026-09-04', description: 'x', amount: 100 })
    const withBalance = normalizeRow({ date: '2026-09-04', description: 'x', amount: 100, balance: 5000 })
    expect(withoutBalance.ok && withBalance.ok).toBe(true)
    if (withoutBalance.ok && withBalance.ok) {
      expect(withBalance.row.fingerprint).not.toBe(withoutBalance.row.fingerprint)
    }
  })
})

describe('classifyRows', () => {
  const rows: RawRow[] = [
    { date: '2026-09-01', description: 'Coffee', amount: -50000 },
    { date: '2026-09-02', description: 'Client payment', amount: 1_000_000 },
  ]

  it('marks everything new against an empty set', () => {
    const res = classifyRows(rows, new Set())
    expect(res.rowsNew).toHaveLength(2)
    expect(res.rowsDuplicate).toHaveLength(0)
    expect(res.errors).toHaveLength(0)
  })

  it('marks a row duplicate when its fingerprint is already known', () => {
    const first = normalizeRow(rows[0])
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const existing = new Set([first.row.fingerprint])

    const res = classifyRows(rows, existing)
    expect(res.rowsDuplicate).toHaveLength(1)
    expect(res.rowsNew).toHaveLength(1)
    expect(res.rowsDuplicate[0].row.fingerprint).toBe(first.row.fingerprint)
  })

  it('sends unparseable rows to errors, not to rows', () => {
    const withBad: RawRow[] = [...rows, { date: 'bad', description: 'x', amount: 1 }]
    const res = classifyRows(withBad, new Set())
    expect(res.errors).toHaveLength(1)
    expect(res.rows).toHaveLength(2)
  })
})

describe('existingFingerprintSet', () => {
  it('collects fingerprints and skips transactions without one', () => {
    const txns = [
      { id: '1', accountId: 'a', date: '2026-09-01', description: 'x', amount: 1, marked: true, fingerprint: 'aaa' },
      { id: '2', accountId: 'a', date: '2026-09-02', description: 'y', amount: 2, marked: true, fingerprint: 'bbb' },
      { id: '3', accountId: 'a', date: '2026-09-03', description: 'z', amount: 3, marked: true },
    ] as Transaction[]

    const set = existingFingerprintSet(txns)
    expect(set.has('aaa')).toBe(true)
    expect(set.has('bbb')).toBe(true)
    expect(set.size).toBe(2)
  })
})