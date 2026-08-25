import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { verifyWorkspaceFolder, initWorkspaceStructure } from '../../lib/setup'
import { CheckCircle, WarningCircle, Link, SpinnerGap } from '@phosphor-icons/react'

type Stage = 'idle' | 'verifying' | 'creating' | 'done' | 'error'

/**
 * Setup wizard — connects a workspace folder and bootstraps the `_cashtrac`
 * structure (meta spreadsheet, ledgers folder, statements folder, groups).
 */
export function SetupWizard() {
  const { connectWorkspace, pushToast, mockMode } = useStore()
  const [link, setLink] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')

  const run = async () => {
    setError('')
    const trimmed = link.trim()
    if (!trimmed) {
      setError('Paste a Google Drive folder link first.')
      return
    }

    if (mockMode) {
      const res = await connectWorkspace(trimmed)
      if (res.ok) {
        setStage('done')
        pushToast('success', 'Workspace connected (mock)')
      } else {
        setStage('error')
        setError(res.error ?? 'Something went wrong')
      }
      return
    }

    setStage('verifying')
    const verify = await verifyWorkspaceFolder(trimmed)
    if (!verify.ok) {
      setStage('error')
      setError(verify.error)
      return
    }

    setStage('creating')
    try {
      await initWorkspaceStructure(verify.folderId)
      const res = await connectWorkspace(trimmed)
      if (!res.ok) throw new Error(res.error ?? 'connect failed')
      setStage('done')
      pushToast('success', 'Workspace ready')
    } catch (err) {
      setStage('error')
      setError((err as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-[2.5rem] border border-line bg-surface-raised p-8 shadow-diffuse">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pos-soft text-pos">
            <Link size={19} />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Connect a workspace</h2>
            <p className="text-[12.5px] text-ink-muted">
              Paste the Drive folder link for a workspace.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="https://drive.google.com/drive/folders/…"
            className="tnum w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13.5px] placeholder:text-ink-faint focus:border-accent"
            aria-label="Workspace folder link"
          />

          <button
            onClick={() => void run()}
            disabled={stage === 'verifying' || stage === 'creating'}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pos px-5 py-3 text-[14px] font-semibold text-surface transition-all hover:bg-pos/90 active:scale-[0.98] disabled:opacity-60"
          >
            {(stage === 'verifying' || stage === 'creating') && <SpinnerGap size={17} className="animate-spin" />}
            {stage === 'verifying' ? 'Checking access…' : stage === 'creating' ? 'Setting up…' : 'Connect'}
          </button>
        </div>

        <AnimatePresence>
          {stage === 'error' && error && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2 rounded-xl bg-neg-soft px-3.5 py-2.5 text-[13px] text-neg"
            >
              <WarningCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </motion.p>
          )}
          {stage === 'done' && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 rounded-xl bg-pos-soft px-3.5 py-2.5 text-[13px] text-pos"
            >
              <CheckCircle size={16} />
              Workspace connected. Add accounts to start tracking.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-faint">
        The app creates a <code className="text-ink-muted">_cashtrac/</code> folder inside the
        workspace with a Meta spreadsheet, ledger folders, and a statements folder.
      </p>
    </div>
  )
}
