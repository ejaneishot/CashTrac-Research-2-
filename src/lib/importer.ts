import { parse } from 'papaparse'
import * as XLSX from 'xlsx'
import { readPdfPieces } from './pdfText'
import { parseBcaStatement, bcaRowsToRecords } from './bcaPdf'
import { detectBank, readStatementDate, type BankProfile } from './bankProfiles'
import {
  classifyRows,
  existingFingerprintSet,
  type ImportResult,
  type NormalizedRow,
  type RawRow,
} from './fingerprint'
import { parseAmountRupiah } from './money'
import type { Transaction } from '../types'

// --- Column detection --------------------------------------------------------

export interface ColumnMap {
  date?: string
  description?: string
  amount?: string
  debit?: string
  credit?: string
  balance?: string
  direction?: string
}

const ALIASES: Record<keyof ColumnMap, string[]> = {
  date: ['date', 'tanggal', 'tgl', 'transaction date', 'posting date', 'value date'],
  description: ['description', 'keterangan', 'uraian', 'narasi', 'remark', 'remarks', 'details', 'detail'],
  amount: ['amount', 'mutasi', 'jumlah', 'nominal', 'nilai'],
  debit: ['debit', 'debet', 'keluar', 'withdrawal', 'penarikan', 'pengeluaran'],
  credit: ['credit', 'kredit', 'masuk', 'deposit', 'setoran', 'pemasukan'],
  balance: ['balance', 'saldo', 'running balance'],
  direction: ['db cr', 'cr db', 'dbcr', 'dk', 'type', 'tipe', 'jenis'],
}

// Order matters. Balance and debit/credit are claimed before amount so a
// header like "Mutasi Debet" lands on debit, not on amount.
const FIELD_ORDER: (keyof ColumnMap)[] = [
  'date', 'balance', 'debit', 'credit', 'direction', 'description', 'amount',
]

// Normalize a header to a key we can match against the aliases.
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// Detect the columns in the CSV file based on the headers.
export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {}
  const used = new Set<string>()
  const cols = headers.map((h) => ({ original: h, key: normalizeHeader(h) }))

  for (const field of FIELD_ORDER) {
    const aliases = ALIASES[field]
    const free = cols.filter((c) => !used.has(c.original))
    const hit =
      free.find((c) => aliases.includes(c.key)) ??
      free.find((c) => c.key.split(' ').some((word) => aliases.includes(word)))
    if (hit) {
      map[field] = hit.original
      used.add(hit.original)
    }
  }
  return map
}

// --- Rows --------------------------------------------------------------------


export function directionMarker(value: string): 'in' | 'out' | null {
  const tokens = value.toUpperCase().replace(/[^A-Z]+/g, ' ').trim().split(' ').filter(Boolean)
  for (const t of tokens) {
    if (['DB', 'DR', 'D', 'DEBIT', 'DEBET'].includes(t)) return 'out'
    if (['CR', 'KR', 'K', 'CREDIT', 'KREDIT'].includes(t)) return 'in'
  }
  return null
}


export function signedAmount(record: Record<string, string>, map: ColumnMap): number | null {
  if (map.debit || map.credit) {
    const d = map.debit ? parseAmountRupiah(record[map.debit]) : null
    const c = map.credit ? parseAmountRupiah(record[map.credit]) : null
    const out = d && d.ok ? Math.abs(d.value) : 0
    const into = c && c.ok ? Math.abs(c.value) : 0
    if (out === 0 && into === 0) return null
    return into - out
  }

  if (!map.amount) return null
  const cell = String(record[map.amount] ?? '')
  const parsed = parseAmountRupiah(cell)
  if (!parsed.ok) return null

  const marker =
    directionMarker(cell) ??
    (map.direction ? directionMarker(String(record[map.direction] ?? '')) : null)
  if (marker === 'out') return -Math.abs(parsed.value)
  if (marker === 'in') return Math.abs(parsed.value)
  return parsed.value
}

// 
export function toRawRows(records: Record<string, string>[], map: ColumnMap): RawRow[] {
  if (!map.date || !map.description) return []

  const rows: RawRow[] = []
  for (const rec of records) {
    const amount = signedAmount(rec, map)
    const date = rec[map.date] ?? ''
    const description = rec[map.description] ?? ''
    const balance = map.balance ? rec[map.balance] : undefined

    if (amount === null) {
      const cell = map.amount ? String(rec[map.amount] ?? '').trim() : ''
      // Blank amount means the line is not a transaction, so leave it out.
      // A filled amount we could not read is passed on, so it shows as an error.
      if (cell === '') continue
      rows.push({ date, description, amount: cell, balance })
      continue
    }
    rows.push({ date, description, amount, balance })
  }
  return rows
}

// --- Tally -------------------------------------------------------------------

export interface Tally {
  available: boolean
  reason?: string
  inflows: number
  outflows: number
  saldoAwal?: number
  saldoAkhir?: number
  expected?: number
  difference?: number
  tallied?: boolean
}

// 
export function computeTally(rows: NormalizedRow[]): Tally {
  const inflows = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)
  const outflows = rows.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0)

  if (rows.length === 0) {
    return { available: false, reason: 'No readable rows', inflows, outflows }
  }

  // Some banks list newest first. Flip so the first row is the oldest.
  const ordered = [...rows]
  if (ordered[0].date > ordered[ordered.length - 1].date) ordered.reverse()

  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  if (first.balance === undefined || last.balance === undefined) {
    return { available: false, reason: 'This file has no running balance column', inflows, outflows }
  }

  const saldoAwal = first.balance - first.amount
  const saldoAkhir = last.balance
  const expected = saldoAwal + inflows - outflows
  const difference = expected - saldoAkhir

  return {
    available: true,
    inflows,
    outflows,
    saldoAwal,
    saldoAkhir,
    expected,
    difference,
    tallied: difference === 0,
  }
}

// --- Import report -----------------------------------------------------------
export function lastKnownBalance(transactions: Transaction[], accountId: string): number | undefined {
  const withBalance = transactions
    .filter((t) => t.accountId === accountId && t.balance !== undefined && !t.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date))
  return withBalance.length ? withBalance[withBalance.length - 1].balance : undefined
}

export interface ImportReport {
  filename: string
  accountId: string
  columns: ColumnMap
  rowsFound: number
  rowsNew: number
  rowsDuplicate: number
  errors: ImportResult['errors']
  tally: Tally
  continuityGap?: number
  transactions: Transaction[]
}

function toTransaction(
  row: NormalizedRow,
  accountId: string,
  filename: string,
  now: string,
  sourceLink?: string,
): Transaction {
  return {
    // Same file imported twice produces the same id, so a re-import
    // overwrites rather than doubling up.
    id: `imp-${accountId}-${row.fingerprint}`,
    accountId,
    date: row.date,
    description: String(row.raw.description ?? '').trim(),
    amount: row.amount,
    balance: row.balance,
    source: filename,
    sourceLink,
    importedAt: now,
    marked: false,
    fingerprint: row.fingerprint,
    updatedAt: now,
    syncState: 'pending',
    deletedAt: null,
  }
}

// 
export function buildImportReport(args: {
  filename: string
  accountId: string
  records: Record<string, string>[]
  existing: Transaction[]
  now?: string
  sourceLink?: string
}): ImportReport {
  const { filename, accountId, records, existing, sourceLink } = args
  const now = args.now ?? new Date().toISOString()

  const columns = detectColumns(records.length ? Object.keys(records[0]) : [])
  const rawRows = toRawRows(records, columns)

  // Dedup is per account. Fingerprints do not include the account, so the same
  // amount and description at two banks would otherwise collide.
  const sameAccount = existing.filter((t) => t.accountId === accountId)
  const result = classifyRows(rawRows, existingFingerprintSet(sameAccount))

  // Dedup inside the file too, so a file that repeats a row imports it once.
  const seen = new Set<string>()
  const fresh: NormalizedRow[] = []
  let repeated = 0
  for (const c of result.rowsNew) {
    if (seen.has(c.row.fingerprint)) {
      repeated++
      continue
    }
    seen.add(c.row.fingerprint)
    fresh.push(c.row)
  }

  const tally = computeTally(result.rows.map((c) => c.row))
  const previous = lastKnownBalance(existing, accountId)
  const continuityGap =
    tally.saldoAwal !== undefined && previous !== undefined && previous !== tally.saldoAwal
      ? tally.saldoAwal - previous
      : undefined

  return {
    filename,
    accountId,
    columns,
    rowsFound: result.rows.length,
    rowsNew: fresh.length,
    rowsDuplicate: result.rowsDuplicate.length + repeated,
    errors: result.errors,
    tally,
    continuityGap,
    transactions: fresh.map((row) => toTransaction(row, accountId, filename, now, sourceLink)),
  }
}

// 
export function recordsFromMatrix(matrix: string[][]): {
  records: Record<string, string>[]
  headerRow: number
} {
  for (let i = 0; i < matrix.length; i++) {
    const map = detectColumns(matrix[i])
    if (map.date && (map.amount || map.debit || map.credit)) {
      const headers = matrix[i].map((h, idx) => (String(h).trim() === '' ? `col${idx}` : String(h).trim()))
      const records = matrix
        .slice(i + 1)
        .filter((r) => r.some((cell) => String(cell).trim() !== ''))
        .map((r) => Object.fromEntries(headers.map((h, idx) => [h, String(r[idx] ?? '')])))
      return { records, headerRow: i }
    }
  }
  return { records: [], headerRow: -1 }
}

// Read a CSV file and return the records and header row index.
export async function readCsvFile(file: File): Promise<{
  records: Record<string, string>[]
  headerRow: number
}> {
  const text = await file.text()
  const parsed = parse<string[]>(text, { skipEmptyLines: true })
  return recordsFromMatrix(parsed.data)
}

function repairDates(raw: unknown[][], profile: BankProfile): string[][] {
  return raw.map((row) =>
    row.map((cell) => {
      if (typeof cell === 'number' && cell > 20000 && cell < 90000) {
        const asDate = new Date(Date.UTC(1899, 11, 30) + cell * 86400000)
        const fixed = readStatementDate(
          new Date(asDate.getUTCFullYear(), asDate.getUTCMonth(), asDate.getUTCDate()),
          profile,
        )
        if (fixed) {
          const d = String(fixed.getDate()).padStart(2, '0')
          const m = String(fixed.getMonth() + 1).padStart(2, '0')
          return d + '/' + m + '/' + fixed.getFullYear()
        }
      }
      return cell == null ? '' : String(cell)
    }),
  )
}
export async function readExcelFile(file: File): Promise<{
  records: Record<string, string>[]
  headerRow: number
}> {
    const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0]]
  if (!sheet) return { records: [], headerRow: -1 }

  // Read once as text to identify the bank, since detection only looks at labels.
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  const profile = detectBank(matrix)

  // blu's dates are wrong once formatted, so for blu we need the raw cell values
  // and correct them ourselves. Other banks are fine as text.
  if (profile.swapDateParts) {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
    return recordsFromMatrix(repairDates(raw, profile))
  }

  return recordsFromMatrix(matrix)
}

async function readPdfFile(file: File): Promise<{
  records: Record<string, string>[]
  headerRow: number
}> {
  const pieces = await readPdfPieces(file)
  const statement = parseBcaStatement(pieces)

  if (statement.rows.length === 0) {
    throw new Error('This PDF could not be read. Only BCA statements are supported so far.')
  }

  return { records: bcaRowsToRecords(statement), headerRow: 0 }
}

export async function readStatementFile(file: File): Promise<{
  records: Record<string, string>[]
  headerRow: number
}> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return readCsvFile(file)
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return readExcelFile(file)
    if (name.endsWith('.pdf')) return readPdfFile(file)
  throw new Error('This file type cannot be read.')
}