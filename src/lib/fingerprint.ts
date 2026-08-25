import { parseAmountRupiah } from './money'
import { parseDate } from './dates'
import type { Transaction } from '../types'

/**
 * Fingerprint + dedup classifier.
 *
 * A row is fingerprinted as date | amount | normalizedDescription | balance?
 * (balance only when the statement provides a running balance). Weekly and
 * monthly statements for the same account naturally produce identical
 * fingerprints for overlapping transactions.
 */

export interface RawRow {
  date: string | number
  description: string
  amount: string | number
  balance?: string | number
}

export interface NormalizedRow {
  date: string // YYYY-MM-DD
  description: string
  amount: number // signed integer rupiah
  balance?: number
  fingerprint: string
  raw: RawRow
}

export type RowClassification = 'new' | 'duplicate' | 'conflict'

export interface ClassifiedRow {
  row: NormalizedRow
  classification: RowClassification
  reason?: string
}

export interface ImportResult {
  rows: ClassifiedRow[]
  rowsNew: ClassifiedRow[]
  rowsDuplicate: ClassifiedRow[]
  rowsConflict: ClassifiedRow[]
  // Unparseable rows, kept for the review screen
  errors: { row: RawRow; reason: string }[]
}

/** Normalize description: lowercase, collapse whitespace, strip punctuation noise. */
export function normalizeDescription(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Deterministic 32-bit string hash (FNV-1a). */
export function hashString(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(36)
}

/**
 * Parse a raw row into a normalized row. Returns null with a reason when
 * the row can't be parsed (missing date/description, bad amount).
 */
export function normalizeRow(raw: RawRow): { ok: true; row: NormalizedRow } | { ok: false; reason: string } {
  const date = parseDate(raw.date)
  if (!date) return { ok: false, reason: `Unreadable date: ${String(raw.date)}` }

  const desc = String(raw.description ?? '').trim()
  if (desc === '') return { ok: false, reason: 'Missing description' }

  const amt = parseAmountRupiah(raw.amount)
  if (!amt.ok) return { ok: false, reason: `Bad amount: ${String(raw.amount)}` }

  const balance = raw.balance !== undefined && raw.balance !== '' ? parseAmountRupiah(raw.balance) : undefined
  if (balance && !balance.ok) return { ok: false, reason: `Bad balance: ${String(raw.balance)}` }

  const normalizedDescription = normalizeDescription(desc)
  const parts = [date, String(amt.value), normalizedDescription]
  if (balance?.ok && balance.value !== undefined) parts.push(String(balance.value))

  return {
    ok: true,
    row: {
      date,
      description: normalizedDescription,
      amount: amt.value,
      balance: balance?.ok ? balance.value : undefined,
      fingerprint: hashString(parts.join('|')),
      raw,
    },
  }
}

/**
 * Classify rows against the account's existing fingerprints.
 * Existing transactions must expose { fingerprint, date, amount, description }.
 */
export function classifyRows(
  rawRows: RawRow[],
  existingFingerprints: Set<string>,
): ImportResult {
  const rows: ClassifiedRow[] = []
  const errors: ImportResult['errors'] = []

  for (const raw of rawRows) {
    const res = normalizeRow(raw)
    if (!res.ok) {
      errors.push({ row: raw, reason: res.reason })
      continue
    }
    const { row } = res

    let classification: RowClassification = 'new'
    if (existingFingerprints.has(row.fingerprint)) {
      classification = 'duplicate'
    }
    rows.push({ row, classification })
  }

  return {
    rows,
    rowsNew: rows.filter((r) => r.classification === 'new'),
    rowsDuplicate: rows.filter((r) => r.classification === 'duplicate'),
    rowsConflict: rows.filter((r) => r.classification === 'conflict'),
    errors,
  }
}

/** Existing transaction fingerprints for dedup. */
export function existingFingerprintSet(transactions: Transaction[]): Set<string> {
  return new Set(transactions.filter((t) => t.fingerprint).map((t) => t.fingerprint as string))
}
