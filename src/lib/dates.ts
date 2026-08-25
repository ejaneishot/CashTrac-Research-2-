/**
 * Date helpers — everything is YYYY-MM-DD (local, not UTC-shifted).
 */

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO with time. Returns YYYY-MM-DD or null. */
export function parseDate(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  let s = String(raw).trim()
  if (s === '') return null

  // Excel serial date (number) → Date
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
    if (!Number.isNaN(d.getTime())) return toISODate(d)
    return null
  }

  // Already ISO-ish
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const [, y, m, d] = iso
    const dt = new Date(Number(y), Number(m) - 1, Number(d))
    if (!Number.isNaN(dt.getTime())) return toISODate(dt)
    return null
  }

  // DD/MM/YYYY or DD-MM-YYYY (ID statements are day-first)
  const parts = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (parts) {
    const [, d, m, yRaw] = parts
    let y = Number(yRaw)
    if (y < 100) y += 2000
    const dt = new Date(y, Number(m) - 1, Number(d))
    // Validate the round-trip (rejects 31/02)
    if (dt.getFullYear() === y && dt.getMonth() === Number(m) - 1 && dt.getDate() === Number(d)) {
      return toISODate(dt)
    }
    return null
  }

  return null
}

/** "X days ago" style staleness labels. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const da = new Date(ay, am - 1, ad)
  const db = new Date(by, bm - 1, bd)
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

export function relativeDayLabel(iso: string): string {
  const days = daysBetween(iso, todayISO())
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.round(days / 7)}w ago`
  return `${Math.round(days / 30)}mo ago`
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[Number(m) - 1]} ${y}`
}
