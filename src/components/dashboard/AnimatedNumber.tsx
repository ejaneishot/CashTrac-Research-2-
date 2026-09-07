import { useEffect, useRef } from 'react'
import { formatIDR } from '../../lib/money'

/**
 * Counts up to a value with a spring-y ease, isolated in its own component
 * so re-renders never hit the parent layout. Numbers render in mono.
 */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const from = Number(el.dataset.value ?? '0')
    const to = value
    const start = performance.now()
    const duration = 700

    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
      const current = Math.round(from + (to - from) * eased)
      el.textContent = formatIDR(current)
      el.dataset.value = String(current)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span ref={ref} className={className} />
}
