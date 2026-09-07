import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { formatIDR, sumRevenue } from '../../lib/money'
import { fmtDate, todayISO } from '../../lib/dates'
import { Plus, X, Trash, LinkSimple } from '@phosphor-icons/react'

export function Revenue() {
  const { data, addRevenueRow, deleteRevenueRow } = useStore()
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState<'unearned' | 'unbilled'>('unearned')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const unearned = useMemo(() => data.revenue.filter((r) => r.type === 'unearned'), [data.revenue])
  const unbilled = useMemo(() => data.revenue.filter((r) => r.type === 'unbilled'), [data.revenue])

  const submit = () => {
    const amt = Math.round(Number(amount.replace(/[^\d]/g, '')))
    if (!description.trim() || !amt) return
    addRevenueRow({ date: todayISO(), type, description: description.trim(), amount: amt, note: note.trim() || undefined })
    setAdding(false)
    setDescription('')
    setAmount('')
    setNote('')
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Revenue</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Totals-only tracking — money received ahead of work, and work not yet billed.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-surface transition-all hover:bg-ink/90 active:scale-[0.98]"
        >
          <Plus size={16} weight="bold" />
          Add row
        </button>
      </div>

      {/* Totals */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] border border-line bg-surface-raised p-6">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">Unearned revenue</p>
          <p className="tnum mt-2 text-3xl font-semibold tracking-tight text-pos">{formatIDR(sumRevenue(unearned))}</p>
          <p className="mt-1 text-[12px] text-ink-faint">Paid in advance, work ongoing</p>
        </div>
        <div className="rounded-[2rem] border border-line bg-surface-raised p-6">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">Unbilled revenue</p>
          <p className="tnum mt-2 text-3xl font-semibold tracking-tight text-accent">{formatIDR(sumRevenue(unbilled))}</p>
          <p className="mt-1 text-[12px] text-ink-faint">Work done, invoice not sent</p>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {adding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={(e) => { e.preventDefault(); submit() }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-[2rem] border border-line bg-surface-raised p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">New revenue row</h2>
                <button type="button" onClick={() => setAdding(false)} className="rounded-lg p-1.5 text-ink-faint hover:text-ink">
                  <X size={16} />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Type</span>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'unearned' | 'unbilled')}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] focus:border-accent"
                  >
                    <option value="unearned">Unearned</option>
                    <option value="unbilled">Unbilled</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Amount (IDR)</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="25000000"
                    inputMode="numeric"
                    className="tnum w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-accent"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Description</span>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Arcitech advance — Q3"
                    autoFocus
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-accent"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Note</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional context"
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-accent"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="rounded-2xl bg-pos px-5 py-2.5 text-[13.5px] font-semibold text-surface transition-transform active:scale-[0.98]">
                  Add row
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Rows */}
      {(['unearned', 'unbilled'] as const).map((t) => {
        const rows = t === 'unearned' ? unearned : unbilled
        return (
          <section key={t}>
            <h2 className="mb-3 text-[15px] font-semibold tracking-tight capitalize">{t}</h2>
            <div className="divide-y divide-line-soft rounded-[2rem] border border-line bg-surface-raised">
              {rows.map((r) => (
                <div key={r.id} className="group flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{r.description}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-faint">
                      <span className="tnum">{fmtDate(r.date)}</span>
                      {r.note && <span className="truncate">· {r.note}</span>}
                      {r.driveLink && (
                        <a href={r.driveLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-ink-faint hover:text-accent">
                          <LinkSimple size={11} /> file
                        </a>
                      )}
                    </p>
                  </div>
                  <span className={`tnum text-[14px] font-semibold ${t === 'unearned' ? 'text-pos' : 'text-accent'}`}>
                    {formatIDR(r.amount)}
                  </span>
                  <button
                    onClick={() => deleteRevenueRow(r.id)}
                    className="rounded-lg p-2 text-ink-faint opacity-0 transition-opacity hover:bg-neg-soft hover:text-neg group-hover:opacity-100"
                    aria-label="Delete row"
                  >
                    <Trash size={15} />
                  </button>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="px-5 py-8 text-center text-[13px] text-ink-faint">
                  Nothing tracked yet.
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
