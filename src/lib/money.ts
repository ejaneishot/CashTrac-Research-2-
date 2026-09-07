/**
 * Money — all amounts are integer rupiah. No floats, ever.
 */

export type ParsedAmount =
  | { ok: true; value: number }
  | { ok: false; reason: string }

/** Strip currency symbols, thousand separators, whitespace → integer rupiah. */
export function parseAmountRupiah(raw: unknown): ParsedAmount {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, reason: 'Not a number' }
    return { ok: true, value: Math.round(raw) }
  }
  if (typeof raw !== 'string') return { ok: false, reason: 'Not a number' }

  let s = raw.trim().toUpperCase()
  if (s === '') return { ok: false, reason: 'Empty' }

  // Indonesian decimal comma → dot, then strip everything non-numeric
  s = s.replace(/\./g, '').replace(',', '.')
  s = s.replace(/[^\d.-]/g, '')
  if (s === '' || s === '-' || s === '.') return { ok: false, reason: 'Not a number' }

  const n = Number(s)
  if (!Number.isFinite(n)) return { ok: false, reason: 'Not a number' }
  return { ok: true, value: Math.round(n) }
}

/** 48_500_000 → "Rp 48.5 jt" compact, or full "Rp 48.500.000" */
export function formatIDR(amount: number, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '−' : ''

  if (opts.compact && abs >= 1_000_000) {
    const jt = abs / 1_000_000
    const s = jt >= 100 ? jt.toFixed(0) : jt.toFixed(1).replace(/\.0$/, '')
    return `${sign}Rp ${s} jt`
  }
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`
}

export function formatIDRShort(amount: number): string {
  return formatIDR(amount, { compact: true })
}

/** Group cash position: sum of transaction amounts per account. */
export function accountPosition(transactions: { accountId: string; amount: number }[], accountId: string): number {
  return transactions
    .filter((tx) => tx.accountId === accountId)
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function groupPosition(
  transactions: { accountId: string; amount: number }[],
  accountIds: string[],
): number {
  return transactions
    .filter((tx) => accountIds.includes(tx.accountId))
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function sumRevenue(rows: { amount: number }[]): number {
  return rows.reduce((sum, r) => sum + r.amount, 0)
}
