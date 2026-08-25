import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { formatIDR } from '../../lib/money'
import { relativeDayLabel } from '../../lib/dates'
import type { AccountType, OwnerId } from '../../types'
import {
  Plus, X, UploadSimple, Building, DeviceMobile, Money, Globe,
  CheckCircle, Warning,
} from '@phosphor-icons/react'

const TYPE_META: Record<AccountType, { icon: typeof Building; label: string }> = {
  bank: { icon: Building, label: 'Bank' },
  ewallet: { icon: DeviceMobile, label: 'E-wallet' },
  cash: { icon: Money, label: 'Cash' },
  gateway: { icon: Globe, label: 'Gateway' },
}

export function Accounts() {
  const { data, addAccount, pushToast } = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [groupId, setGroupId] = useState(data.groups[0]?.id ?? '')
  const [owner, setOwner] = useState<OwnerId>('nirmal')
  const now = useMemo(() => Date.now(), [])

  const grouped = useMemo(() => {
    return data.groups.map((g) => ({
      group: g,
      accounts: data.accounts.filter((a) => a.groupId === g.id),
    }))
  }, [data.groups, data.accounts])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return pushToast('error', 'Give the account a name')
    addAccount({ name: trimmed, type, groupId, owner, currency: 'IDR', cadenceDays: 7 })
    setAdding(false)
    setName('')
  }

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Every account has its own ledger sheet in Drive.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-surface transition-all hover:bg-ink/90 active:scale-[0.98]"
        >
          <Plus size={16} weight="bold" />
          Add account
        </button>
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
                <h2 className="text-[15px] font-semibold">New account</h2>
                <button type="button" onClick={() => setAdding(false)} className="rounded-lg p-1.5 text-ink-faint hover:text-ink">
                  <X size={16} />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. BCA Fastrac"
                    autoFocus
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Type</span>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] focus:border-accent"
                  >
                    <option value="bank">Bank</option>
                    <option value="ewallet">E-wallet</option>
                    <option value="cash">Cash</option>
                    <option value="gateway">Gateway</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Group</span>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] focus:border-accent"
                  >
                    {data.groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Owner</span>
                  <select
                    value={owner}
                    onChange={(e) => setOwner(e.target.value as OwnerId)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] focus:border-accent"
                  >
                    <option value="nirmal">Nirmal</option>
                    <option value="shalfin">Shalfin</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="rounded-2xl bg-pos px-5 py-2.5 text-[13.5px] font-semibold text-surface transition-transform active:scale-[0.98]">
                  Create account
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Groups */}
      {grouped.map(({ group, accounts }) => (
        <section key={group.id}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">{group.name}</h2>
            <span className="text-[12px] text-ink-faint">{accounts.length} accounts</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => {
              const meta = TYPE_META[a.type]
              const IconCmp = meta.icon
              const pos = data.transactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amount, 0)
              const isCash = a.type === 'cash'
              const isStale = !isCash && a.lastUpdated && a.cadenceDays
                ? (now - new Date(a.lastUpdated + 'T00:00:00').getTime()) / 86_400_000 > a.cadenceDays
                : false
              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-line bg-surface-raised p-5 transition-colors hover:border-line"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-hover text-ink-muted">
                        <IconCmp size={19} />
                      </span>
                      <div>
                        <span className="rounded-full border border-line bg-surface-hover px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                          {meta.label}
                        </span>
                        <h4 className="mt-1 text-[13.5px] font-semibold text-ink transition-colors group-hover:text-pos">
                          {a.name}
                        </h4>
                      </div>
                    </div>

                    {/* Status pill */}
                    {isCash ? (
                      <span className="flex items-center gap-1 rounded-full border border-pos/20 bg-pos-soft px-2 py-0.5 text-[10px] font-semibold text-pos">
                        <Money size={11} /> Manual Vault
                      </span>
                    ) : isStale ? (
                      <span className="flex items-center gap-1 rounded-full border border-neg/20 bg-neg-soft px-2 py-0.5 text-[10px] font-semibold text-neg">
                        <Warning size={11} /> Sync Needed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-pos/20 bg-pos-soft px-2 py-0.5 text-[10px] font-semibold text-pos">
                        <CheckCircle size={11} /> Live
                      </span>
                    )}
                  </div>

                  <div className="mt-5">
                    <p className={`tnum text-2xl font-bold tracking-tight ${pos < 0 ? 'text-neg' : 'text-ink'}`}>
                      {formatIDR(pos)}
                    </p>
                    <p className="tnum mt-0.5 text-[11px] text-ink-faint">
                      {a.lastUpdated ? `Updated ${relativeDayLabel(a.lastUpdated)}` : 'No statement yet'}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3 text-[11.5px] text-ink-muted">
                    <span>{isCash ? 'Cash physical ledger' : `Last tx ${a.lastTransactionDate ? relativeDayLabel(a.lastTransactionDate) : '—'}`}</span>
                    <button
                      onClick={() => pushToast('info', 'Statement upload lands with the import pipeline')}
                      className="flex items-center gap-1 font-medium text-ink-muted transition-colors hover:text-pos"
                    >
                      <UploadSimple size={13} />
                      Statement
                    </button>
                  </div>
                </motion.div>
              )
            })}

            {accounts.length === 0 && (
              <div className="rounded-[2rem] border border-dashed border-line px-5 py-10 text-center text-[13px] text-ink-faint md:col-span-2 lg:col-span-3">
                No accounts in this group yet.
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
