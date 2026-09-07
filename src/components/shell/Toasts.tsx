import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../../store'
import { CheckCircle, WarningCircle, Info } from '@phosphor-icons/react'

const ICONS = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
}

export function Toasts() {
  const { toasts, dismissToast } = useStore()

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => {
          const IconCmp = ICONS[t.kind]
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              onClick={() => dismissToast(t.id)}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-[13px] font-medium shadow-diffuse backdrop-blur ${
                t.kind === 'success'
                  ? 'border-pos/25 bg-surface-raised text-ink'
                  : t.kind === 'error'
                    ? 'border-neg/30 bg-surface-raised text-ink'
                    : 'border-line bg-surface-raised text-ink'
              }`}
            >
              <IconCmp
                size={17}
                weight="fill"
                className={t.kind === 'success' ? 'text-pos' : t.kind === 'error' ? 'text-neg' : 'text-accent'}
              />
              {t.message}
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
