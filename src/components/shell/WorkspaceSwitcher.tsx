import { useStore } from '../../store'
import { CaretDown, Plus, FolderOpen } from '@phosphor-icons/react'

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { workspaces, activeWorkspaceId, setActiveWorkspace, connectWorkspace, mockMode } = useStore()
  const active = workspaces.find((w) => w.id === activeWorkspaceId)

  return (
    <div>
      <label className="mb-1.5 block px-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-faint">
        Workspace
      </label>
      <div className="relative">
        <select
          value={activeWorkspaceId ?? ''}
          onChange={(e) => e.target.value && setActiveWorkspace(e.target.value)}
          className="w-full appearance-none rounded-xl border border-line bg-surface-raised px-3 py-2.5 pr-8 text-[13px] font-medium text-ink transition-colors hover:border-line focus:border-accent"
          aria-label="Switch workspace"
        >
          {workspaces.length === 0 && <option value="">No workspaces</option>}
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <CaretDown size={14} weight="bold" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
      </div>

      <div className="mt-2 flex gap-1.5">
        <button
          onClick={() => {
            const link = window.prompt('Paste a Google Drive folder link to connect a workspace:')
            if (link) void connectWorkspace(link)
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-2 py-1.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:border-pos hover:text-pos active:scale-[0.98]"
        >
          <Plus size={13} weight="bold" />
          Connect
        </button>
        {active && !mockMode && (
          <a
            href={active.folderLink}
            target="_blank"
            rel="noreferrer"
            title="Open folder in Drive"
            className="flex items-center justify-center rounded-xl border border-line px-2.5 py-1.5 text-ink-muted transition-colors hover:border-line hover:text-ink"
          >
            <FolderOpen size={13} />
          </a>
        )}
      </div>

      {compact && workspaces.length > 1 && (
        <p className="mt-1 truncate text-[10px] text-ink-faint">
          {workspaces.length} workspaces
        </p>
      )}
    </div>
  )
}
