import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CATEGORIES,
  getCategoryByKey,
  getCategoryById,
  categoryColor,
} from './categories'

describe('DEFAULT_CATEGORIES', () => {
  it('has nine categories', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(9)
  })

  it('uses keys 1 through 9 with no gaps or repeats', () => {
    const keys = DEFAULT_CATEGORIES.map((c) => c.key).sort()
    expect(keys).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('has a unique id for every category', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getCategoryByKey', () => {
  it('finds the category for a hotkey', () => {
    expect(getCategoryByKey('1')?.id).toBe('saas')
    expect(getCategoryByKey('7')?.id).toBe('client_income')
  })

  it('returns undefined for a key that has no category', () => {
    expect(getCategoryByKey('0')).toBeUndefined()
    expect(getCategoryByKey('x')).toBeUndefined()
  })
})

describe('getCategoryById', () => {
  it('finds the category for an id', () => {
    expect(getCategoryById('payroll')?.name).toBe('Team & Payroll')
    expect(getCategoryById('draw')?.type).toBe('both')
  })

  it('returns undefined for an unknown id', () => {
    expect(getCategoryById('nope')).toBeUndefined()
  })
})

describe('categoryColor', () => {
  it('returns the color for a known category', () => {
    expect(categoryColor('saas')).toBe('#38bdf8')
    expect(categoryColor('client_income')).toBe('#34d399')
  })

  it('falls back to the misc grey for an unknown id', () => {
    expect(categoryColor('nope')).toBe('#a1a1aa')
  })
})