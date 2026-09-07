import { describe, it, expect } from 'vitest'
import {
  parseAmountRupiah,
  formatIDR,
  formatIDRShort,
  accountPosition,
  groupPosition,
  sumRevenue,
} from './money'

// formatIDR uses a real minus sign (U+2212), not a hyphen, for negatives.
const MINUS = '\u2212'

describe('parseAmountRupiah', () => {
  it('accepts a plain number and rounds it to a whole rupiah', () => {
    expect(parseAmountRupiah(1000)).toEqual({ ok: true, value: 1000 })
    expect(parseAmountRupiah(1000.7)).toEqual({ ok: true, value: 1001 })
  })

  it('rejects non-finite numbers', () => {
    expect(parseAmountRupiah(Infinity).ok).toBe(false)
    expect(parseAmountRupiah(NaN).ok).toBe(false)
  })

  it('strips currency symbols and thousand separators', () => {
    expect(parseAmountRupiah('Rp 48.500.000')).toEqual({ ok: true, value: 48_500_000 })
    expect(parseAmountRupiah('1.000.000')).toEqual({ ok: true, value: 1_000_000 })
  })

  it('reads Indonesian decimal comma and rounds', () => {
    expect(parseAmountRupiah('1.234,56')).toEqual({ ok: true, value: 1235 })
  })

  it('keeps negatives', () => {
    expect(parseAmountRupiah('-25000')).toEqual({ ok: true, value: -25000 })
  })

  it('rejects empty, whitespace and non-numeric input', () => {
    expect(parseAmountRupiah('').ok).toBe(false)
    expect(parseAmountRupiah('   ').ok).toBe(false)
    expect(parseAmountRupiah('abc').ok).toBe(false)
    expect(parseAmountRupiah('-').ok).toBe(false)
  })

  it('rejects values that are neither string nor number', () => {
    expect(parseAmountRupiah(null).ok).toBe(false)
    expect(parseAmountRupiah(undefined).ok).toBe(false)
    expect(parseAmountRupiah({}).ok).toBe(false)
  })
})

describe('formatIDR', () => {
  it('formats a positive amount with dot separators', () => {
    expect(formatIDR(25_000_000)).toBe('Rp 25.000.000')
  })

  it('uses a real minus sign for negatives', () => {
    expect(formatIDR(-25_000_000)).toBe(`${MINUS}Rp 25.000.000`)
  })

  it('formats zero', () => {
    expect(formatIDR(0)).toBe('Rp 0')
  })

  it('compacts millions to "jt"', () => {
    expect(formatIDR(48_500_000, { compact: true })).toBe('Rp 48.5 jt')
    expect(formatIDR(2_000_000, { compact: true })).toBe('Rp 2 jt')
    expect(formatIDR(150_000_000, { compact: true })).toBe('Rp 150 jt')
  })

  it('compacts negatives with the minus sign', () => {
    expect(formatIDR(-48_500_000, { compact: true })).toBe(`${MINUS}Rp 48.5 jt`)
  })

  it('does not compact amounts under a million', () => {
    expect(formatIDR(500_000, { compact: true })).toBe('Rp 500.000')
  })
})

describe('formatIDRShort', () => {
  it('is the compact form of formatIDR', () => {
    expect(formatIDRShort(48_500_000)).toBe('Rp 48.5 jt')
  })
})

describe('accountPosition', () => {
  const txns = [
    { accountId: 'a', amount: 100 },
    { accountId: 'a', amount: -30 },
    { accountId: 'b', amount: 999 },
  ]

  it('sums only the given account', () => {
    expect(accountPosition(txns, 'a')).toBe(70)
  })

  it('returns 0 for an account with no transactions', () => {
    expect(accountPosition(txns, 'c')).toBe(0)
  })
})

describe('groupPosition', () => {
  const txns = [
    { accountId: 'a', amount: 100 },
    { accountId: 'b', amount: 200 },
    { accountId: 'c', amount: 50 },
  ]

  it('sums every account in the group', () => {
    expect(groupPosition(txns, ['a', 'b'])).toBe(300)
  })

  it('returns 0 for an empty group', () => {
    expect(groupPosition(txns, [])).toBe(0)
  })
})

describe('sumRevenue', () => {
  it('adds up the amounts', () => {
    expect(sumRevenue([{ amount: 10 }, { amount: 20 }, { amount: 5 }])).toBe(35)
  })

  it('returns 0 for no rows', () => {
    expect(sumRevenue([])).toBe(0)
  })
})