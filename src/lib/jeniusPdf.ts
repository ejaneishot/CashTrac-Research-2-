import type { TextPiece } from './pdfText'

export interface JeniusRow {
  date: string
  time: string
  description: string
  type: string
  amount: number
  balance: number | null
}

export interface JeniusStatement {
  accountNumber: string | null
  year: number | null
  rows: JeniusRow[]
  openingBalance: number | null
  closingBalance: number | null
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

const DATE_RE = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/
const TIME_RE = /^\d{1,2}:\d{2}$/
const NOISE_RE = /SMBC|jenius\.com|1500\s?365|Bank Indonesia|Otoritas Jasa|LPS|E-STATEMENT|TRANSACTION HISTORY|^\d+ of \d+$/i
const HEADER_RE = /^(DATE & TIME|DETAILS|NOTES|AMOUNT|ENDING BALANCE|PREVIOUS BALANCE|Transaction ID \| Category|Transaction Type|Category)$/i

function parseSignedAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '').replace(/\s/g, '')
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function ordered(pieces: TextPiece[]): TextPiece[] {
  return [...pieces].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
}

function isSectionHead(pieces: TextPiece[], i: number): boolean {
  const p = pieces[i]
  if (p.x >= 40) return false
  const from = Math.max(0, i - 8)
  const to = Math.min(pieces.length, i + 12)
  for (let j = from; j < to; j++) {
    const q = pieces[j]
    if (q.page !== p.page || q.x >= 40) continue
    const dy = q.y - p.y
    if (dy > 0 && dy < 16 && /^Active Since/i.test(q.text)) return true
  }
  return false
}

function sectionSlice(pieces: TextPiece[], name: string): TextPiece[] | null {
  const heads: number[] = []
  for (let i = 0; i < pieces.length; i++) {
    if (isSectionHead(pieces, i)) heads.push(i)
  }
  for (let n = 0; n < heads.length; n++) {
    if (pieces[heads[n]].text.trim().toLowerCase() !== name.toLowerCase()) continue
    const end = n + 1 < heads.length ? heads[n + 1] : pieces.length
    return pieces.slice(heads[n], end)
  }
  return null
}

export function parseJeniusStatement(pieces: TextPiece[]): JeniusStatement {
  const all = ordered(pieces)
  const section = sectionSlice(all, 'Active Balance IDR') ?? all

  let openingBalance: number | null = null
  let closingBalance: number | null = null

  for (const p of section) {
    const label = p.text.trim().toUpperCase()
    if (label !== 'PREVIOUS BALANCE' && label !== 'ENDING BALANCE') continue
    if (p.x > 400) continue
    const value = section.find((q) => q.page === p.page && Math.abs(q.y - p.y) < 4 && q.x > 500)
    const n = value ? parseSignedAmount(value.text) : null
    if (n === null) continue
    if (label === 'PREVIOUS BALANCE' && openingBalance === null) openingBalance = n
    if (label === 'ENDING BALANCE') closingBalance = n
  }

  const body = section.filter((p) => !NOISE_RE.test(p.text) && !HEADER_RE.test(p.text.trim()))

  const rows: JeniusRow[] = []
  let current: { date: string; time: string; details: string[]; type: string; amount: number | null } | null = null

  const push = () => {
    if (!current || current.amount === null) return
    rows.push({
      date: current.date,
      time: current.time,
      description: current.details.join(' ').trim(),
      type: current.type.trim(),
      amount: current.amount,
      balance: null,
    })
  }

  for (const p of body) {
    const text = p.text.trim()
    const m = p.x < 60 ? DATE_RE.exec(text) : null
    if (m) {
      push()
      const day = m[1].padStart(2, '0')
      const month = MONTHS[m[2].toLowerCase()] ?? '01'
      current = { date: day + '/' + month + '/' + m[3], time: '', details: [], type: '', amount: null }
      continue
    }
    if (!current) continue
    if (p.x < 60) {
      if (TIME_RE.test(text)) current.time = text
      continue
    }
    if (p.x < 260) {
      current.details.push(text)
      continue
    }
    if (p.x < 500) {
      current.type = current.type ? current.type + ' ' + text : text
      continue
    }
    const n = parseSignedAmount(text)
    if (n !== null && current.amount === null) current.amount = n
  }
  push()

  const year = rows.length ? Number(rows[0].date.slice(6)) : null

  return { accountNumber: null, year, rows, openingBalance, closingBalance }
}

export function jeniusRowsToRecords(statement: JeniusStatement): Record<string, string>[] {
  return statement.rows.map((r) => ({
    Tanggal: r.date,
    Keterangan: [r.description, r.type].filter(Boolean).join(' | '),
    Mutasi: String(r.amount),
    Saldo: r.balance === null ? '' : String(r.balance),
  }))
}