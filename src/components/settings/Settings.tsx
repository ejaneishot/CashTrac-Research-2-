import { useState } from 'react'
import { useStore } from '../../store'
import { SetupWizard } from './SetupWizard'
import { FolderOpen, SignOut, Trash, Info, Plus } from '@phosphor-icons/react'

export function Settings() {
  const { workspaces, activeWorkspaceId, disconnectWorkspace, signOut, mockMode, hasClientId } = useStore()
  const [showWizard, setShowWizard] = useState(false)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Workspaces, access, and account.
        </p>
      </div>

      {/* Workspaces */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Workspaces</h2>
        <div className="divide-y divide-line-soft rounded-[2rem] border border-line bg-surface-raised">
          {workspaces.map((w) => (
            <div key={w.id} className="flex items-center gap-4 px-5 py-4">
              <span className={`h-2 w-2 shrink-0 rounded-full ${w.id === activeWorkspaceId ? 'bg-pos' : 'bg-ink-faint'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">{w.name}</p>
                <p className="tnum truncate text-[11px] text-ink-faint">{w.folderId}</p>
              </div>
              <a
                href={w.folderLink}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors hover:border-line hover:text-ink"
                aria-label={`Open ${w.name} in Drive`}
              >
                <FolderOpen size={15} />
              </a>
              <button
                onClick={() => disconnectWorkspace(w.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink-faint transition-colors hover:border-neg/40 hover:bg-neg-soft hover:text-neg"
                aria-label={`Disconnect ${w.name}`}
              >
                <Trash size={15} />
              </button>
            </div>
          ))}
          {workspaces.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-ink-faint">
              No workspaces connected yet.
            </p>
          )}
        </div>
        <button
          onClick={() => setShowWizard((s) => !s)}
          className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-line px-3.5 py-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-pos hover:text-pos active:scale-[0.98]"
        >
          <Plus size={14} weight="bold" />
          {showWizard ? 'Close' : 'Connect another workspace'}
        </button>
        {showWizard && (
          <div className="mt-4">
            <SetupWizard />
          </div>
        )}
      </section>

      {/* App */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">App</h2>
        <div className="divide-y divide-line-soft rounded-[2rem] border border-line bg-surface-raised">
          <div className="flex items-center gap-4 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-hover text-ink-muted">
              <Info size={16} />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-medium">Mode</p>
              <p className="text-[12px] text-ink-faint">
                {mockMode ? 'Mock data — add VITE_GOOGLE_CLIENT_ID to go live' : 'Live — connected to Google'}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${mockMode ? 'bg-neg-soft text-neg' : 'bg-pos-soft text-pos'}`}>
              {mockMode ? 'mock' : 'live'}
            </span>
          </div>
          {!mockMode && !hasClientId && (
            <div className="px-5 py-4 text-[12.5px] leading-relaxed text-ink-faint">
              Google client id missing. Check the README for setup.
            </div>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-neg-soft/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-hover text-neg">
              <SignOut size={16} />
            </span>
            <div>
              <p className="text-[13.5px] font-medium">Sign out</p>
              <p className="text-[12px] text-ink-faint">End this session</p>
            </div>
          </button>
        </div>
      </section>
    </div>
  )
}
