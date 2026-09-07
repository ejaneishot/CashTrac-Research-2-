import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { formatIDR } from '../../lib/money'
import { fmtDate } from '../../lib/dates'
import { categoryColor } from '../../lib/categories'
import type { Account } from '../../types'
import { ArrowUpRight, ArrowDownRight, MagnifyingGlass, LinkSimple } from '@phosphor-icons/react'

export function Transactions() {
  const { data, markTransaction } = useStore()
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [markedFilter, setMarkedFilter] = useState<'all' | 'marked' | 'unmarked'>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [draftCategory, setDraftCategory] = useState('')

  const accountById = useMemo(() => new Map<string, Account>(data.accounts.map((a) => [a.id, a])), [data.accounts])

  const filtered = useMemo(() => {
    return [...data.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((t) => {
        const acc = accountById.get(t.accountId)
        if (groupFilter !== 'all' && acc?.groupId !== groupFilter) return false
        if (markedFilter === 'marked' && !t.marked) return false
        if (markedFilter === 'unmarked' && t.marked) return false
        if (query) {
          const q = query.toLowerCase()
          const hay = `${t.description} ${t.category ?? ''} ${acc?.name ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
  }, [data.transactions, accountById, groupFilter, markedFilter, query])

  const unmarkedCount = data.transactions.filter((t) => !t.marked).length

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            {data.transactions.length} total ·{' '}
            <span className={unmarkedCount ? 'text-neg' : 'text-pos'}>
              {unmarkedCount} uncategorised
            </span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 md:max-w-xs">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions…"
            className="w-full rounded-xl border border-line bg-surface-raised py-2.5 pl-9 pr-3 text-[13.5px] placeholder:text-ink-faint focus:border-accent"
          />
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-[13px] focus:border-accent"
          aria-label="Filter by group"
        >
          <option value="all">All groups</option>
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <div className="flex rounded-xl border border-line bg-surface-raised p-1">
          {(['all', 'unmarked', 'marked'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMarkedFilter(v)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${
                markedFilter === v ? 'bg-surface-hover text-ink' : 'text-ink-faint hover:text-ink-muted'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger */}
      <div className="overflow-hidden rounded-[2rem] border border-line bg-surface-raised">
        <div className="hidden grid-cols-[110px_1fr_120px_100px_64px] gap-3 border-b border-line-soft px-5 py-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faint md:grid">
          <span>Date</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span>Category</span>
          <span />
        </div>
        <div className="divide-y divide-line-soft">
          {filtered.map((t) => {
            const acc = accountById.get(t.accountId)
            const isEditing = editing === t.id
            return (
              <div
                key={t.id}
                className={`grid grid-cols-1 gap-2 px-5 py-3.5 transition-colors md:grid-cols-[110px_1fr_120px_100px_64px] md:items-center md:gap-3 ${
                  t.marked ? '' : 'bg-pos-soft/20'
                }`}
              >
                <span className="tnum text-[12.5px] text-ink-muted">{fmtDate(t.date)}</span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">
                    {t.description}
                    {!t.marked && <span className="ml-2 rounded-md bg-neg-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neg">new</span>}
                  </p>
                  <p className="truncate text-[11.5px] text-ink-faint">
                    {acc?.name}
                    {t.sourceLink && (
                      <a href={t.sourceLink} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-ink-faint hover:text-accent" title="Open source statement">
                        <LinkSimple size={11} /> source
                      </a>
                    )}
                  </p>
                </div>
                <span className={`tnum text-[13.5px] font-semibold md:text-right ${t.amount < 0 ? 'text-neg' : 'text-pos'}`}>
                  {formatIDR(t.amount)}
                </span>
                {isEditing ? (
                  <input
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    onBlur={() => {
                      if (draftCategory.trim()) markTransaction(t, draftCategory.trim())
                      setEditing(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (draftCategory.trim()) markTransaction(t, draftCategory.trim())
                        setEditing(null)
                      }
                    }}
                    autoFocus
                    placeholder="Category…"
                    className="w-full rounded-lg border border-accent bg-surface px-2 py-1 text-[12.5px]"
                  />
                ) : (
                  <button
                    onClick={() => { setEditing(t.id); setDraftCategory(t.category ?? '') }}
                    className={`flex w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors ${
                      t.category ? 'text-ink' : 'text-ink-faint hover:text-ink-muted'
                    } ${t.marked ? '' : 'hover:bg-surface-hover'}`}
                  >
                    {t.category && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(t.category) }} />
                    )}
                    <span className="truncate">{t.category ?? 'Categorise…'}</span>
                  </button>
                )}
                <span className={`flex items-center justify-end ${t.amount < 0 ? 'text-neg' : 'text-pos'}`}>
                  {t.amount < 0 ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                </span>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-[13px] text-ink-faint">
              Nothing matches those filters.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
