export type BankId = 'blu' | 'bca' | 'jenius' | 'unknown'

export interface BankProfile {
  id: BankId
  label: string
  matches: (matrix: string[][]) => boolean
  swapDateParts: boolean
}

function topOfFile(matrix: string[][], rows = 8): string {
  return matrix
    .slice(0, rows)
    .map((r) => r.join(' '))
    .join(' ')
    .toLowerCase()
}

export const BANK_PROFILES: BankProfile[] = [
  {
    id: 'blu',
    label: 'blu by BCA Digital',
    matches: (m) => topOfFile(m).includes('bluaccount'),
    swapDateParts: true,
  },
  {
    id: 'bca',
    label: 'BCA',
    matches: (m) => {
      const top = topOfFile(m)
      return top.includes('rekening giro') || top.includes('no. rekening')
    },
    swapDateParts: false,
  },
  {
    id: 'jenius',
    label: 'Jenius',
    matches: (m) => {
      const top = topOfFile(m)
      return top.includes('jenius') || top.includes('cashtag')
    },
    swapDateParts: false,
  },
]

export const UNKNOWN_PROFILE: BankProfile = {
  id: 'unknown',
  label: 'Unknown bank',
  matches: () => false,
  swapDateParts: false,
}

export function detectBank(matrix: string[][]): BankProfile {
  return BANK_PROFILES.find((p) => p.matches(matrix)) ?? UNKNOWN_PROFILE
}

export function readStatementDate(value: unknown, profile: BankProfile): Date | null {
  if (value instanceof Date) {
    if (!profile.swapDateParts) return value
    const swapped = new Date(value.getFullYear(), value.getDate() - 1, value.getMonth() + 1)
    return Number.isNaN(swapped.getTime()) ? null : swapped
  }

  if (typeof value === 'string') {
    // Text dates were never misread, because no month is higher than 12.
    const m = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (!m) return null
    const [, day, month, year] = m
    const d = new Date(Number(year), Number(month) - 1, Number(day))
    return Number.isNaN(d.getTime()) ? null : d
  }

  return null
}