import type { Category } from '../types'

/**
 * Categories with 1-9 hotkeys, colors, and income/expense/both typing.
 * Inherited from legacy CashTrac's DEFAULT_CATEGORIES, adapted to v2's palette.
 */

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'saas', name: 'Software & SaaS', key: '1', color: '#38bdf8', type: 'expense' },
  { id: 'payroll', name: 'Team & Payroll', key: '2', color: '#a855f7', type: 'expense' },
  { id: 'infra', name: 'Servers & Cloud', key: '3', color: '#6366f1', type: 'expense' },
  { id: 'office', name: 'Office & Admin', key: '4', color: '#f59e0b', type: 'expense' },
  { id: 'marketing', name: 'Marketing & Ads', key: '5', color: '#ec4899', type: 'expense' },
  { id: 'legal', name: 'Tax & Legal', key: '6', color: '#14b8a6', type: 'expense' },
  { id: 'client_income', name: 'Client Revenue', key: '7', color: '#34d399', type: 'income' },
  { id: 'draw', name: 'Owner Draw', key: '8', color: '#fb7185', type: 'both' },
  { id: 'misc', name: 'General & Misc', key: '9', color: '#a1a1aa', type: 'expense' },
]

export function getCategoryByKey(key: string): Category | undefined {
  return DEFAULT_CATEGORIES.find((c) => c.key === key)
}

export function getCategoryById(id: string): Category | undefined {
  return DEFAULT_CATEGORIES.find((c) => c.id === id)
}

export function categoryColor(id: string): string {
  return getCategoryById(id)?.color ?? '#a1a1aa'
}
