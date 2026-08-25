import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { formatIDR } from '../../lib/money'
import { fmtDate } from '../../lib/dates'
import { DEFAULT_CATEGORIES, getCategoryByKey } from '../../lib/categories'
import type { Transaction, Account } from '../../types'
import { Check, X, Sparkle, HardDrive, ArrowRight } from '@phosphor-icons/react'

/**
 * Triage deck — inherited from legacy CashTrac's swipeable-triage.
 * Keyboard-first: 1-9 categorize, Enter approve, Backspace skip, I attach invoice.
 */

export function SwipeDeck() {
  const { data, markTransaction, pushToast } = useStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const unmarked = useMemo(
    () => data.transactions.filter((t) => !t.marked).sort((a, b) => a.date.localeCompare(b.date)),
    [data.transactions],
  )
  const accountById = useMemo(() => new Map<string, Account>(data.accounts.map((a) => [a.id, a])), [data.accounts])
  const done = data.transactions.filter((t) => t.marked).length

  const currentTx = unmarked[currentIndex] ?? null

  // Sync auto-detected category when the card changes
  useEffect(() => {
    if (currentTx) setSelectedCategory(currentTx.category ?? null)
  }, [currentTx])

  const approve = (tx: Transaction, category: string) => {
    markTransaction(tx, category)
    const cat = getCategoryByKey(category) ?? DEFAULT_CATEGORIES.find((c) => c.id === category)
    pushToast('success', `Categorized as ${cat?.name ?? category}`)
  }

  const handleApprove = () => {
    if (!currentTx) return
    approve(currentTx, selectedCategory ?? 'misc')
  }

  const handleCategorize = (categoryId: string) => {
    if (!currentTx) return
    approve(currentTx, categoryId)
  }

  const handleSkip = () => {
    if (!currentTx) return
    setCurrentIndex((i) => (i < unmarked.length - 1 ? i + 1 : 0))
    pushToast('info', 'Skipped for later')
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (['input', 'textarea', 'select'].includes(tag)) return
      if (!currentTx) return

      if (/^[1-9]$/.test(e.key)) {
        const cat = getCategoryByKey(e.key)
        if (cat) {
          e.preventDefault()
          handleCategorize(cat.id)
        }
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        handleApprove()
      } else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
        e.preventDefault()
        handleSkip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTx, currentIndex, unmarked.length, selectedCategory])

  // Inbox Zero celebration
  if (unmarked.length === 0) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-140px)] max-w-md flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full rounded-[2.5rem] border border-line bg-surface-raised p-10 text-center shadow-diffuse"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-pos-soft text-pos"
          >
            <Sparkle size={30} />
          </motion.div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">Inbox Zero</h2>
          <p className="mx-auto mt-2 max-w-[30ch] text-[13px] leading-relaxed text-ink-muted">
            Every transaction is categorised. Import a new statement and fresh cards will appear here.
          </p>
          <p className="tnum mt-4 text-[12px] text-ink-faint">{done} transactions reviewed</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] w-full max-w-xl flex-col items-center">
      {/* Header */}
      <div className="mb-5 flex w-full items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              Triage Mode
            </span>
            <span className="tnum text-[12px] text-ink-faint">
              {currentIndex + 1} of {unmarked.length}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Review &amp; Categorize</h1>
        </div>
        {/* Hotkey badge */}
        <div className="hidden items-center gap-1.5 text-[11px] text-ink-faint md:flex">
          {[['1-9', 'Category'], ['↵', 'Approve'], ['⌫', 'Skip']].map(([k, label]) => (
            <span key={label} className="flex items-center gap-1 rounded-lg border border-line bg-surface-raised px-2 py-1 font-mono">
              <kbd className="text-ink-muted">{k}</kbd>
              <span className="text-ink-faint">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="relative w-full">
        <AnimatePresence mode="wait">
          {currentTx && (
            <motion.div
              key={currentTx.id}
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              className="relative overflow-hidden rounded-[2.5rem] border border-line bg-surface-raised p-7 shadow-diffuse"
            >
              {/* Account & date pill row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-line bg-surface-hover px-2.5 py-1 text-[12px] font-medium text-ink">
                    {accountById.get(currentTx.accountId)?.name ?? 'Account'}
                  </span>
                  <span className="tnum text-[12px] text-ink-faint">{fmtDate(currentTx.date)}</span>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    currentTx.amount < 0
                      ? 'border-neg/20 bg-neg-soft text-neg'
                      : 'border-pos/20 bg-pos-soft text-pos'
                  }`}
                >
                  {currentTx.amount < 0 ? 'Expense' : 'Income'}
                </span>
              </div>

              {/* Amount + description */}
              <div className="mt-6">
                <p className={`tnum text-4xl font-bold tracking-tight ${currentTx.amount < 0 ? 'text-ink' : 'text-pos'}`}>
                  {formatIDR(currentTx.amount)}
                </p>
                <p className="mt-2 text-[15px] font-medium leading-relaxed text-ink">
                  {currentTx.description}
                </p>
                {currentTx.source && (
                  <p className="tnum mt-1 text-[11px] text-ink-faint">Source: {currentTx.source}</p>
                )}
              </div>

              {/* Attached invoice status */}
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-surface p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <HardDrive size={15} className="shrink-0 text-accent" />
                  <span className="truncate text-[12.5px] text-ink-muted">
                    {currentTx.invoiceLink ? 'Invoice attached' : 'No invoice attached'}
                  </span>
                </div>
                <button
                  onClick={() => pushToast('info', 'Invoice linking lands with Drive search')}
                  className="shrink-0 rounded-lg bg-surface-hover px-2.5 py-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  Attach [I]
                </button>
              </div>

              {/* Category pills (1-9) */}
              <div className="mt-5">
                <p className="mb-2 text-[12px] font-medium text-ink-muted">
                  Select category <span className="text-ink-faint">(press 1-9)</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorize(cat.id)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition-all ${
                        selectedCategory === cat.id
                          ? 'border-line bg-surface-hover ring-1 ring-line'
                          : 'border-line-soft bg-surface/60 hover:border-line hover:bg-surface-hover/60'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="truncate text-[11.5px] font-medium text-ink">{cat.name}</span>
                      </span>
                      <span className="tnum shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-faint">
                        {cat.key}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom controls */}
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={handleSkip}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-surface-hover py-3 text-[12.5px] font-semibold text-ink-muted transition-all hover:text-ink active:scale-[0.98]"
                >
                  <X size={15} />
                  Skip [⌫]
                </button>
                <button
                  onClick={handleApprove}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-pos py-3 text-[12.5px] font-semibold text-surface transition-all active:scale-[0.98]"
                >
                  <Check size={15} weight="bold" />
                  Approve [↵]
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom hint */}
      <p className="mt-6 flex items-center gap-1.5 text-[12px] text-ink-faint">
        <ArrowRight size={13} />
        Use your keyboard — it's faster than clicking.
      </p>
    </div>
  )
}
