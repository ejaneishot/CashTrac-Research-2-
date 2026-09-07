import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../store'
import { groupPosition, formatIDR, sumRevenue } from '../../lib/money'
import { relativeDayLabel } from '../../lib/dates'
import { AnimatedNumber } from './AnimatedNumber'
import { AttentionPulse } from './AttentionPulse'
import { ArrowUpRight, ArrowDownRight, HandCoins, Clock } from '@phosphor-icons/react'

export function Dashboard() {
  const { data, loading } = useStore()

  const groups = useMemo(() => data.groups, [data.groups])
  const txs = useMemo(() => data.transactions, [data.transactions])

  const fastrac = groups.find((g) => g.id === 'fastrac') ?? groups[0]
  const personalGroups = groups.filter((g) => g.id !== 'fastrac')

  const fastracPosition = fastrac ? groupPosition(txs, fastrac.accountIds) : 0
  const personalPosition = personalGroups.reduce(
    (sum, g) => sum + groupPosition(txs, g.accountIds),
    0,
  )

  const unearned = sumRevenue(data.revenue.filter((r) => r.type === 'unearned'))
  const unbilled = sumRevenue(data.revenue.filter((r) => r.type === 'unbilled'))

  const unmarked = txs.filter((t) => !t.marked).length
  const staleAccounts = useMemo(() => {
    const now = Date.now()
    return data.accounts.filter((a) => {
      if (!a.lastUpdated || !a.cadenceDays) return false
      const days = (now - new Date(a.lastUpdated + 'T00:00:00').getTime()) / 86_400_000
      return days > a.cadenceDays
    })
  }, [data.accounts])

  const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const lastTransactionDate = txs.length ? [...txs].sort((a, b) => b.date.localeCompare(a.date))[0].date : undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            {lastTransactionDate ? `Last activity ${relativeDayLabel(lastTransactionDate)}` : 'No activity yet'}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Overview</h1>
        </div>
        <div className="hidden items-center gap-2 text-[12px] text-ink-faint md:flex">
          <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'animate-pulse bg-accent' : 'bg-pos'}`} />
          {loading ? 'Syncing…' : 'Synced'}
        </div>
      </div>

      {/* Hero positions */}
      <div className="grid gap-4 md:grid-cols-2">
        <PositionTile
          label={fastrac?.name ?? 'Company'}
          amount={fastracPosition}
          sub={`${fastrac?.accountIds.length ?? 0} accounts`}
          tone="pos"
        />
        <PositionTile
          label="Personal"
          amount={personalPosition}
          sub={`${personalGroups.length} private workspace${personalGroups.length === 1 ? '' : 's'}`}
          tone="neutral"
        />
      </div>

      {/* Bento grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <RevenueTile label="Unearned revenue" amount={unearned} />
        <RevenueTile label="Unbilled revenue" amount={unbilled} />
        <div className="flex flex-col justify-between rounded-[2rem] border border-line bg-surface-raised p-6">
          <div className="flex items-center gap-2 text-[12px] font-medium text-ink-muted">
            <AttentionPulse count={unmarked + staleAccounts.length} />
            <span>Needs attention</span>
          </div>
          <div className="mt-3">
            <p className="tnum text-4xl font-semibold tracking-tight text-ink">
              {unmarked + staleAccounts.length}
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">
              {unmarked} uncategorised transaction{unmarked === 1 ? '' : 's'} ·{' '}
              {staleAccounts.length} stale account{staleAccounts.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* Accounts strip */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Accounts</h2>
          <span className="text-[12px] text-ink-faint">Last statement</span>
        </div>
        <div className="divide-y divide-line-soft rounded-[2rem] border border-line bg-surface-raised">
          {data.accounts.map((a) => {
            const pos = data.transactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amount, 0)
            const stale = a.lastUpdated && a.cadenceDays
              ? (Date.now() - new Date(a.lastUpdated + 'T00:00:00').getTime()) / 86_400_000 > a.cadenceDays
              : false
            return (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className={`h-2 w-2 shrink-0 rounded-full ${stale ? 'bg-neg' : 'bg-pos'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{a.name}</p>
                  <p className="text-[11.5px] text-ink-faint">
                    {a.lastUpdated ? `Updated ${relativeDayLabel(a.lastUpdated)}` : 'Never imported'}
                  </p>
                </div>
                <span className={`tnum text-[14px] font-semibold ${pos < 0 ? 'text-neg' : 'text-ink'}`}>
                  {formatIDR(pos, { compact: true })}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Recent transactions */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Recent transactions</h2>
        <div className="divide-y divide-line-soft rounded-[2rem] border border-line bg-surface-raised">
          {recent.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${t.amount < 0 ? 'bg-neg-soft text-neg' : 'bg-pos-soft text-pos'}`}>
                {t.amount < 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{t.description}</p>
                <p className="text-[11.5px] text-ink-faint">
                  {t.category ?? 'Uncategorised'} · {data.accounts.find((a) => a.id === t.accountId)?.name}
                </p>
              </div>
              <span className={`tnum text-[13.5px] font-semibold ${t.amount < 0 ? 'text-neg' : 'text-pos'}`}>
                {formatIDR(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function PositionTile({ label, amount, sub, tone }: { label: string; amount: number; sub: string; tone: 'pos' | 'neutral' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="relative overflow-hidden rounded-[2.5rem] border border-line bg-surface-raised p-7"
    >
      <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${tone === 'pos' ? 'bg-pos-soft' : 'bg-surface-hover'}`} />
      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <AnimatedNumber value={amount} className="tnum mt-3 block text-4xl font-semibold tracking-tight md:text-5xl" />
      <p className="mt-2 text-[12.5px] text-ink-faint">{sub}</p>
    </motion.div>
  )
}

function RevenueTile({ label, amount }: { label: string; amount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="flex flex-col justify-between rounded-[2rem] border border-line bg-surface-raised p-6"
    >
      <div className="flex items-center gap-2 text-[12px] font-medium text-ink-muted">
        <HandCoins size={15} className="text-accent" />
        <span>{label}</span>
      </div>
      <div className="mt-3">
        <AnimatedNumber value={amount} className="tnum block text-3xl font-semibold tracking-tight" />
        <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-faint">
          <Clock size={12} /> Tracked as totals
        </p>
      </div>
    </motion.div>
  )
}
