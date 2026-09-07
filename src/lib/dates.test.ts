import { describe, it, expect } from 'vitest'
import {
  toISODate,
  parseDate,
  daysBetween,
  relativeDayLabel,
  fmtDate,
} from './dates'

// Build an ISO date N days before today, using the same local-time basis
// the module uses, so relativeDayLabel tests don't drift by timezone.
function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISODate(d)
}

describe('toISODate', () => {
  it('formats a Date as YYYY-MM-DD with zero padding', () => {
    expect(toISODate(new Date(2026, 8, 4))).toBe('2026-09-04')
    expect(toISODate(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('parseDate', () => {
  it('accepts an ISO date', () => {
    expect(parseDate('2026-09-04')).toBe('2026-09-04')
  })

  it('accepts an ISO date that carries a time', () => {
    expect(parseDate('2026-09-04T10:30:00')).toBe('2026-09-04')
  })

  it('accepts day-first formats with slash or dash', () => {
    expect(parseDate('04/09/2026')).toBe('2026-09-04')
    expect(parseDate('04-09-2026')).toBe('2026-09-04')
    expect(parseDate('4/9/2026')).toBe('2026-09-04')
  })

  it('reads an Excel serial number', () => {
    expect(parseDate(44927)).toBe('2023-01-01')
    expect(parseDate(45000)).toBe('2023-03-15')
  })

  it('rejects an impossible calendar date', () => {
    expect(parseDate('31/02/2026')).toBeNull()
  })

  it('rejects empty, non-date text and non-string/number input', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate('hello')).toBeNull()
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate(100)).toBeNull()
  })
})

describe('daysBetween', () => {
  it('counts forward days as positive', () => {
    expect(daysBetween('2026-09-01', '2026-09-04')).toBe(3)
  })

  it('counts backward days as negative', () => {
    expect(daysBetween('2026-09-04', '2026-09-01')).toBe(-3)
  })

  it('is 0 for the same day', () => {
    expect(daysBetween('2026-09-04', '2026-09-04')).toBe(0)
  })
})

describe('relativeDayLabel', () => {
  it('labels today and yesterday', () => {
    expect(relativeDayLabel(daysAgoISO(0))).toBe('today')
    expect(relativeDayLabel(daysAgoISO(1))).toBe('yesterday')
  })

  it('labels recent days, weeks and months', () => {
    expect(relativeDayLabel(daysAgoISO(3))).toBe('3 days ago')
    expect(relativeDayLabel(daysAgoISO(10))).toBe('1w ago')
    expect(relativeDayLabel(daysAgoISO(40))).toBe('1mo ago')
  })
})

describe('fmtDate', () => {
  it('formats an ISO date as "DD Mon YYYY"', () => {
    expect(fmtDate('2026-09-04')).toBe('04 Sep 2026')
    expect(fmtDate('2026-01-15')).toBe('15 Jan 2026')
  })
})