import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Account, AppData, RevenueRow, Transaction, Workspace } from './types'
import { mockData, mockWorkspaces } from './lib/mock'
import {
  hasClientId,
  loadGoogleScripts,
  requestAccessToken,
} from './lib/gapi'

export interface Toast {
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
  addAccount: (acc: Omit<Account, 'id' | 'sheetId'>) => void
  markTransaction: (tx: Transaction, category?: string) => void
  skipTransaction: (tx: Transaction) => void
  addRevenueRow: (row: Omit<RevenueRow, 'id'>) => void
  deleteRevenueRow: (id: string) => void

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
        // No client id configured → run in mock mode so the UI is fully usable.
        setMockMode(true)
        setSignedIn(true)
        setData(mockData)
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
      setData(mockData)
      setLoading(false)
      return
    }
    setLoading(true)
    // Real Google reads land here in Phase 3+; keep UI working meanwhile.
    setLoading(false)
  }, [mockMode])

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
    const ws: Workspace = { id, name, folderId: id, folderLink }
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

  const addAccount = useCallback((acc: Omit<Account, 'id' | 'sheetId'>) => {
    const id = acc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const account: Account = { ...acc, id, sheetId: `mock-${id}` }
    setData((d) => ({ ...d, accounts: [...d.accounts, account] }))
    // Keep the group's accountIds in sync
    setData((d) => ({
      ...d,
      groups: d.groups.map((g) =>
        g.id === acc.groupId ? { ...g, accountIds: [...g.accountIds, id] } : g,
      ),
    }))
    pushToast('success', `Account ${acc.name} added`)
  }, [pushToast])

  const markTransaction = useCallback((tx: Transaction, category?: string) => {
    setData((d) => ({
      ...d,
      transactions: d.transactions.map((t) =>
        t.id === tx.id ? { ...t, marked: true, category: category ?? t.category } : t,
      ),
    }))
  }, [])

  const skipTransaction = useCallback((tx: Transaction) => {
    setData((d) => ({
      ...d,
      transactions: d.transactions.map((t) =>
        t.id === tx.id ? { ...t, marked: true, notes: t.notes ? `${t.notes} · skipped` : 'skipped' } : t,
      ),
    }))
  }, [])

  const addRevenueRow = useCallback((row: Omit<RevenueRow, 'id'>) => {
    const id = `rev-${Date.now()}`
    setData((d) => ({ ...d, revenue: [...d.revenue, { ...row, id }] }))
    pushToast('success', 'Revenue row added')
  }, [pushToast])

  const deleteRevenueRow = useCallback((id: string) => {
    setData((d) => ({ ...d, revenue: d.revenue.filter((r) => r.id !== id) }))
  }, [])

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
    toasts,
    pushToast,
    dismissToast,
  }), [
    signedIn, userEmail, googleReady, mockMode, signIn, signOut,
    workspaces, activeWorkspaceId, setActiveWorkspace, connectWorkspace, disconnectWorkspace,
    data, loading, refresh, addAccount, markTransaction, skipTransaction,
    addRevenueRow, deleteRevenueRow, toasts, pushToast, dismissToast,
  ])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
