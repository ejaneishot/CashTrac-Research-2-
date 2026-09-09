
import type { TextPiece } from './pdfText'

const COL = {
  dateMax: 60,
  typeMax: 150,
  descMax: 370,
  amountMax: 430,
  markerMax: 500,
}

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
}

export interface BcaRow {
  date: string
  description: string
  amount: number
  balance: number | null
}

export interface BcaStatement {
  accountNumber: string | null
  year: number | null
  rows: BcaRow[]
  openingBalance: number | null
  closingBalance: number | null
}

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}


function toLines(pieces: TextPiece[]): TextPiece[][] {
  const byLine = new Map<string, TextPiece[]>()
  for (const p of pieces) {
    const key = p.page + ':' + p.y
    const line = byLine.get(key)
    if (line) line.push(p)
    else byLine.set(key, [p])
  }
  return [...byLine.entries()]
    .sort((a, b) => {
      const [pageA, yA] = a[0].split(':').map(Number)
      const [pageB, yB] = b[0].split(':').map(Number)
      return pageA - pageB || yA - yB
    })
    .map(([, line]) => line.sort((a, b) => a.x - b.x))
}


function findYear(lines: TextPiece[][]): number | null {
  for (const line of lines) {
    const text = line.map((p) => p.text).join(' ').toLowerCase()
    const m = text.match(/([a-z]+)\s+(\d{4})/)
    if (m && MONTHS[m[1]]) return Number(m[2])
  }
  return null
}

function findAccountNumber(lines: TextPiece[][]): string | null {
  for (const line of lines) {
    const text = line.map((p) => p.text).join(' ')
    if (!text.toUpperCase().includes('NO. REKENING')) continue
    const m = text.match(/(\d{8,})/)
    if (m) return m[1]
  }
  return null
}


function findSummary(lines: TextPiece[][]): { opening: number | null; closing: number | null } {
  let opening: number | null = null
  let closing: number | null = null

  for (const line of lines) {
    const text = line.map((p) => p.text).join(' ').toUpperCase()
    const amounts = line.map((p) => parseAmount(p.text)).filter((n): n is number => n !== null)
    if (text.includes('SALDO AWAL') && amounts.length > 0) opening = amounts[amounts.length - 1]
    if (text.includes('SALDO AKHIR') && amounts.length > 0) closing = amounts[amounts.length - 1]
  }

  return { opening, closing }
}

export function parseBcaStatement(pieces: TextPiece[]): BcaStatement {
  const lines = toLines(pieces)
  const year = findYear(lines)
  const accountNumber = findAccountNumber(lines)
  const { opening, closing } = findSummary(lines)

  const rows: BcaRow[] = []
  let current: { date: string; parts: string[]; amount: number | null; isDebit: boolean; balance: number | null } | null = null

    const flush = () => {
    if (!current || current.amount === null) return
    rows.push({
      date: current.date,
      description: current.parts.join(' ').replace(/\s+/g, ' ').trim(),
      amount: current.isDebit ? -current.amount : current.amount,
      balance: current.balance,
    })
  }

    for (const line of lines) {
    const lineText = line.map((p) => p.text).join(' ').toUpperCase()
    if (/SALDO AWAL\s*:/.test(lineText) || /MUTASI (CR|DB)\s*:/.test(lineText)) break

    const first = line[0]
    const startsRow = first.x <= COL.dateMax && /^\d{2}\/\d{2}$/.test(first.text)

    if (startsRow) {
      flush()
      current = { date: first.text, parts: [], amount: null, isDebit: false, balance: null }
    }

    if (!current) continue

    for (const p of line) {
      if (p === first && startsRow) continue

      if (p.x <= COL.descMax) {
        current.parts.push(p.text)
      } else if (p.x <= COL.amountMax) {
        const n = parseAmount(p.text)
        if (n !== null && current.amount === null) current.amount = n
      } else if (p.x <= COL.markerMax) {
        if (p.text.toUpperCase() === 'DB') current.isDebit = true
      } else {
        const n = parseAmount(p.text)
        if (n !== null) current.balance = n
      }
    }
  }

  flush()
  const real = rows.filter((r) => !/^SALDO AWAL/.test(r.description.toUpperCase()))

  return { accountNumber, year, rows: real, openingBalance: opening, closingBalance: closing }
}

export function bcaRowsToRecords(statement: BcaStatement): Record<string, string>[] {
  const year = statement.year ?? new Date().getFullYear()

  return statement.rows.map((r) => {
    const [day, month] = r.date.split('/')
    return {
      Tanggal: `${day}/${month}/${year}`,
      Keterangan: r.description,
      Mutasi: String(r.amount),
      Saldo: r.balance === null ? '' : String(r.balance),
    }
  })
}