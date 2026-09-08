import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Account, AppData, RevenueRow, Transaction, Workspace } from './types'
import { mockData, mockWorkspaces } from './lib/mock'
import { flushPending } from './lib/sync'
import {
  hasClientId,
  loadGoogleScripts,
  requestAccessToken,
  ensureToken,
} from './lib/gapi'

// added ts
import {
  loadAll,
  hydrateAll, 
  loadOrSeed,
  saveTransaction,
  saveAccount,
  saveGroup,
  saveRevenue,
  deleteRevenue,
  saveImportedTransactions,
} from './lib/repository'

import { getModifiedTime, findLedgersFolder, uploadStatement } from './lib/drive'
import { initWorkspaceStructure } from './lib/setup'
import { readStatementFile, buildImportReport, type ImportReport } from './lib/importer'
import { readMeta, readAllTransactions, appendRawRows } from './lib/sheets'
import { createLedgerSpreadsheet } from './lib/setup'
export interface Toast
 {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

interface StoreState {
  // auth
  signedIn: boolean
  userEmail?: string
  googleReady: boolean // scripts loaded + client id present
  hasClientId: boolean
  mockMode: boolean // no client id → run on fixtures
  signIn: () => Promise<void>
  signOut: () => void

  // workspaces
  workspaces: Workspace[]
  activeWorkspaceId?: string
  setActiveWorkspace: (id: string) => void
  connectWorkspace: (folderLink: string) => Promise<{ ok: boolean; error?: string }>
  disconnectWorkspace: (id: string) => void

  // data
  data: AppData
  loading: boolean
  refresh: () => Promise<void>

  // actions
  addAccount: (acc: Omit<Account, 'id' | 'sheetId'>) => Promise<void>
  markTransaction: (tx: Transaction, category?: string) => void
  skipTransaction: (tx: Transaction) => void
  addRevenueRow: (row: Omit<RevenueRow, 'id'>) => void
    deleteRevenueRow: (id: string) => void

  // statement import
  prepareImport: (file: File, accountId: string) => Promise<ImportReport>
  commitImport: (report: ImportReport) => Promise<number>
  recordPdfStatement: (file: File, accountId: string) => Promise<string>

  // toasts
  toasts: Toast[]
  pushToast: (kind: Toast['kind'], message: string) => void
  dismissToast: (id: number) => void
}

const StoreContext = createContext<StoreState | null>(null)

const WS_KEY = 'cashtrac.workspaces'
const ACTIVE_KEY = 'cashtrac.activeWorkspace'

function loadWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(WS_KEY)
    if (raw) return JSON.parse(raw) as Workspace[]
  } catch {
    /* ignore */
  }
  return []
}

let toastSeq = 1

export function StoreProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false)
  const [userEmail, setUserEmail] = useState<string>()
  const [googleReady, setGoogleReady] = useState(false)
  const [mockMode, setMockMode] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>(loadWorkspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | undefined>(() => localStorage.getItem(ACTIVE_KEY) ?? undefined)
  const [data, setData] = useState<AppData>({ groups: [], accounts: [], transactions: [], revenue: [] })
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const lastMetaSync = useRef<string | undefined>(undefined)

  const pushToast = useCallback((kind: Toast['kind'], message: string) => {
    const id = toastSeq++
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const persistWorkspaces = useCallback((ws: Workspace[]) => {
    localStorage.setItem(WS_KEY, JSON.stringify(ws))
  }, [])

  // Initialize Google scripts once on mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ready = await loadGoogleScripts()
      if (cancelled) return
      setGoogleReady(ready)
      if (!ready) {
        // No client id configured so it run in mock mode so the UI is fully usable
        setMockMode(true)
        setSignedIn(true)
        setData(await loadOrSeed(mockData))
        setWorkspaces(mockWorkspaces)
        setActiveWorkspaceId((cur) => cur ?? mockWorkspaces[0]?.id)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

    const refresh = useCallback(async () => {
    if (mockMode) {
      setData(await loadAll())
      setLoading(false)
      return
    }

    const ws = workspaces.find((w) => w.id === activeWorkspaceId)
    if (!ws?.metaSpreadsheetId) {
      setData(await loadAll())
      return
    }

    setLoading(true)
    try {
      const remoteTime = await getModifiedTime(ws.metaSpreadsheetId)
      if (remoteTime && remoteTime === lastMetaSync.current) {
        setData(await loadAll())
        return
      }

      const meta = await readMeta(ws.metaSpreadsheetId)
      await flushPending(meta.accounts)
            const { transactions: remote, failedAccountIds } = await readAllTransactions(meta.accounts)
      const local = await loadAll()

      const failed = new Set(failedAccountIds)
      const remoteById = new Map(remote.map((t) => [t.id, t]))

      const keepLocal = local.transactions
        .filter((t) => t.syncState === 'pending' || failed.has(t.accountId))
        .map((t) => {
          const r = remoteById.get(t.id)
          if (!r || t.syncState !== 'pending') return t

          // Untouched remotely since our copy: our edit is safe to push.
          if (!r.updatedAt || !t.updatedAt || r.updatedAt <= t.updatedAt) return t

          // Remote is newer. Money fields differing needs a human.
          const financialMismatch =
            r.amount !== t.amount ||
            r.date !== t.date ||
            r.balance !== t.balance ||
            r.description !== t.description

          if (financialMismatch) return { ...t, syncState: 'conflict' as const }

          // Otherwise last write wins on the editable fields.
          return { ...r, syncState: 'synced' as const }
        })

      const keepIds = new Set(keepLocal.map((t) => t.id))
      const remoteIds = new Set(remote.map((t) => t.id))
      const localOnly = local.transactions.filter((t) => !remoteIds.has(t.id) && t.syncState === 'pending')
      const merged = [...remote.filter((t) => !keepIds.has(t.id)), ...keepLocal, ...localOnly]

      if (failedAccountIds.length > 0) {
        pushToast('error', `Could not read ${failedAccountIds.length} account ledger(s)`)
      }

      await hydrateAll({ ...local, ...meta, transactions: merged })
      lastMetaSync.current = remoteTime ?? undefined
      setData(await loadAll())
    } catch (err) {
      pushToast('error', `Refresh failed: ${(err as Error).message}`)
      setData(await loadAll())
    } finally {
      setLoading(false)
    }
  }, [mockMode, workspaces, activeWorkspaceId, pushToast])

  const signIn = useCallback(async () => {
    try {
      await requestAccessToken()
      setSignedIn(true)
      // Minimal profile — GIS doesn't expose profile without extra scope.
      setUserEmail('google-user')
      pushToast('success', 'Signed in')
      await refresh()
    } catch (err) {
      pushToast('error', `Sign-in failed: ${(err as Error).message}`)
    }
  }, [pushToast, refresh])

  const signOut = useCallback(() => {
    setSignedIn(false)
    setUserEmail(undefined)
  }, [])

  // Auto-refresh when the tab regains focus (catches other-user edits).
  useEffect(() => {
    const onFocus = () => {
      if (signedIn && !mockMode) refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [signedIn, mockMode, refresh])

  const setActiveWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id)
    localStorage.setItem(ACTIVE_KEY, id)
    refresh()
  }, [refresh])

    const connectWorkspace = useCallback(async (folderLink: string) => {
    const id = folderLink.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? folderLink.split('/').pop()
    if (!id) return { ok: false, error: 'Could not read a folder id from that link.' }
    const name = folderLink.split('/').pop() ?? 'Workspace'

        let metaSpreadsheetId: string
    try {
      await ensureToken()
      const result = await initWorkspaceStructure(id)
      metaSpreadsheetId = result.metaSpreadsheetId
    } catch (err) {
      return { ok: false, error: `Setup failed: ${(err as Error).message}` }
    }

    const ws: Workspace = { id, name, folderId: id, folderLink, metaSpreadsheetId }
    setWorkspaces((prev) => {
      const next = prev.some((w) => w.folderId === id) ? prev : [...prev, ws]
      persistWorkspaces(next)
      return next
    })
    setActiveWorkspace(id)
    return { ok: true }
  }, [persistWorkspaces, setActiveWorkspace])

  const disconnectWorkspace = useCallback((id: string) => {
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== id)
      persistWorkspaces(next)
      return next
    })
    if (activeWorkspaceId === id) setActiveWorkspaceId(undefined)
  }, [activeWorkspaceId, persistWorkspaces])

  
   const addAccount = useCallback(async (acc: Omit<Account, 'id' | 'sheetId'>) => {
    const id = acc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const ws = workspaces.find((w) => w.id === activeWorkspaceId)

    let sheetId = `mock-${id}`
    if (!mockMode && ws?.metaSpreadsheetId) {
      try {
        const ledgersFolderId = await findLedgersFolder(ws.folderId)
        sheetId = await createLedgerSpreadsheet(acc.name, ledgersFolderId)
      } catch (err) {
        pushToast('error', `Could not create ledger: ${(err as Error).message}`)
        return
      }
    }

    const account: Account = { ...acc, id, sheetId }
    const updatedGroups = data.groups.map((g) =>
      g.id === acc.groupId ? { ...g, accountIds: [...g.accountIds, id] } : g,
    )
    const updatedGroup = updatedGroups.find((g) => g.id === acc.groupId)
    setData((d) => ({ ...d, accounts: [...d.accounts, account], groups: updatedGroups }))
    void saveAccount(account)
    if (updatedGroup) void saveGroup(updatedGroup)

    if (!mockMode && ws?.metaSpreadsheetId) {
      try {
        await appendRawRows(ws.metaSpreadsheetId, 'Accounts', [[
          account.id, account.name, account.type, account.owner,
          account.groupId ?? '', account.sheetId, account.currency ?? 'IDR',
          '', '', account.cadenceDays ?? '',
        ]])
      } catch (err) {
        pushToast('error', `Saved locally, but Meta update failed: ${(err as Error).message}`)
      }
    }

    pushToast('success', `Account ${acc.name} added`)
  }, [data.groups, workspaces, activeWorkspaceId, mockMode, pushToast])

    const markTransaction = useCallback((tx: Transaction, category?: string) => {
    const updated: Transaction = { ...tx, marked: true, category: category ?? tx.category }
    setData((d) => ({
      ...d,
      transactions: d.transactions.map((t) => (t.id === tx.id ? updated : t)),
    }))
    void saveTransaction(updated) // persists to Dexie, stamps updatedAt + 'pending'
  }, [])

  const skipTransaction = useCallback((tx: Transaction) => {
    const updated: Transaction = { ...tx, marked: true, notes: tx.notes ? `${tx.notes} · skipped` : 'skipped' }
    setData((d) => ({
      ...d,
      transactions: d.transactions.map((t) => (t.id === tx.id ? updated : t)),
    }))
    void saveTransaction(updated)
  }, [])

    const addRevenueRow = useCallback((row: Omit<RevenueRow, 'id'>) => {
    const id = `rev-${Date.now()}`
    const created: RevenueRow = { ...row, id }
    setData((d) => ({ ...d, revenue: [...d.revenue, created] }))
    void saveRevenue(created)
    pushToast('success', 'Revenue row added')
  }, [pushToast])

    const deleteRevenueRow = useCallback((id: string) => {
    setData((d) => ({ ...d, revenue: d.revenue.filter((r) => r.id !== id) }))
    void deleteRevenue(id)
  }, [])
  
  // Save a PDF statement to Drive, then create a placeholder transaction for it. Returns the Drive link.
  const recordPdfStatement = useCallback(async (file: File, accountId: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId)
    if (!ws?.folderId) throw new Error('Connect a workspace before uploading a statement')

    const { webLink } = await uploadStatement(ws.folderId, file)
    const now = new Date().toISOString()

    await saveTransaction({
      id: `pdf-${accountId}-${Date.now()}`,
      accountId,
      date: now.slice(0, 10),
      description: `${file.name} — PDF statement, needs manual entry`,
      amount: 0,
      marked: false,
      source: file.name,
      sourceLink: webLink,
      importedAt: now,
      updatedAt: now,
      syncState: 'pending',
      deletedAt: null,
    })

    setData(await loadAll())
    pushToast('success', 'Statement saved to Drive, enter the rows by hand')
    return webLink
  }, [workspaces, activeWorkspaceId, pushToast])

    // Read the file and work out what it contains. Writes nothing.
  const prepareImport = useCallback(async (file: File, accountId: string): Promise<ImportReport> => {
    const { records, headerRow } = await readStatementFile(file)
    if (headerRow === -1) {
      throw new Error('Could not find a header row in that file. Is it a bank CSV?')
    }
    return buildImportReport({
      filename: file.name,
      accountId,
      records,
      existing: data.transactions,
    })
  }, [data.transactions])

  // Save the new rows, then reload from the local database so the screen catches up.
  const commitImport = useCallback(async (report: ImportReport): Promise<number> => {
    const written = await saveImportedTransactions(report.transactions)

    const account = data.accounts.find((a) => a.id === report.accountId)
    if (account && written > 0) {
      const latest = report.transactions.map((t) => t.date).sort().pop()
      await saveAccount({
        ...account,
        lastUpdated: new Date().toISOString().slice(0, 10),
        lastTransactionDate: latest ?? account.lastTransactionDate,
      })
    }

    const fresh = await loadAll()
    setData((d) => ({ ...d, ...fresh }))
    pushToast('success', written === 0 ? 'Nothing new to import' : `${written} rows imported`)
    return written
  }, [data.accounts, pushToast])

  const value = useMemo<StoreState>(() => ({
    signedIn,
    userEmail,
    googleReady,
    hasClientId: hasClientId(),
    mockMode,
    signIn,
    signOut,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    connectWorkspace,
    disconnectWorkspace,
    data,
    loading,
    refresh,
    addAccount,
    markTransaction,
    skipTransaction,
    addRevenueRow,
    deleteRevenueRow,
    prepareImport,
    commitImport,
    recordPdfStatement,
    toasts,
    pushToast,
    dismissToast,
  }), [
    signedIn, userEmail, googleReady, mockMode, signIn, signOut,
    workspaces, activeWorkspaceId, setActiveWorkspace, connectWorkspace, disconnectWorkspace,
    data, loading, refresh, addAccount, markTransaction, skipTransaction,
    addRevenueRow, deleteRevenueRow, prepareImport, commitImport, recordPdfStatement, toasts, pushToast, dismissToast,
  ])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
