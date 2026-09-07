import { useEffect, useState } from 'react'

/**
 * A breathing status dot with an overshoot badge — isolated + memoizable
 * perpetual animation so the parent grid never re-renders.
 */
export function AttentionPulse({ count }: { count: number }) {
  const [bump, setBump] = useState(false)

  useEffect(() => {
    if (count === 0) return
    const raf = requestAnimationFrame(() => setBump(true))
    const t = setTimeout(() => setBump(false), 600)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [count])

  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos opacity-60" />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full transition-transform ${bump ? 'scale-150' : ''} ${count > 0 ? 'bg-pos' : 'bg-ink-faint'}`} />
    </span>
  )
}
