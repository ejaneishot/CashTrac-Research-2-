import type { Icon } from '@phosphor-icons/react'
import type { ViewId } from './Shell'

interface Props {
  items: { id: ViewId; label: string; icon: Icon }[]
  active: ViewId
  onChange: (v: ViewId) => void
}

export function SidebarNav({ items, active, onChange }: Props) {
  return (
    <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
      {items.map((item) => {
        const IconCmp = item.icon
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all active:scale-[0.98] ${
              isActive
                ? 'bg-surface-hover text-ink'
                : 'text-ink-muted hover:bg-surface-hover/60 hover:text-ink'
            }`}
          >
            <IconCmp
              size={19}
              weight={isActive ? 'fill' : 'regular'}
              className={isActive ? 'text-pos' : 'text-ink-faint group-hover:text-ink-muted'}
            />
            {item.label}
            {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-pos" />}
          </button>
        )
      })}
    </nav>
  )
}
