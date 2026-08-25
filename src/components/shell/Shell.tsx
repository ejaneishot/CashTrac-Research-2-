import { useState } from 'react'
import { useStore } from '../../store'
import { Logo } from './Logo'
import { SidebarNav } from './SidebarNav'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { Toasts } from './Toasts'
import { LoginScreen } from './LoginScreen'
import { SetupWizard } from '../settings/SetupWizard'
import { Dashboard } from '../dashboard/Dashboard'
import { Accounts } from '../accounts/Accounts'
import { Transactions } from '../transactions/Transactions'
import { SwipeDeck } from '../deck/SwipeDeck'
import { Revenue } from '../revenue/Revenue'
import { Settings } from '../settings/Settings'
import {
  House,
  CreditCard,
  ArrowsLeftRight,
  Stack,
  HandCoins,
  GearSix,
  type Icon,
} from '@phosphor-icons/react'

export type ViewId = 'dashboard' | 'accounts' | 'transactions' | 'swipe' | 'revenue' | 'settings'

const NAV: { id: ViewId; label: string; icon: Icon }[] = [
  { id: 'dashboard', label: 'Overview', icon: House },
  { id: 'accounts', label: 'Accounts', icon: CreditCard },
  { id: 'transactions', label: 'Transactions', icon: ArrowsLeftRight },
  { id: 'swipe', label: 'Swipe', icon: Stack },
  { id: 'revenue', label: 'Revenue', icon: HandCoins },
  { id: 'settings', label: 'Settings', icon: GearSix },
]

export function Shell() {
  const { signedIn, mockMode, activeWorkspaceId } = useStore()
  const [view, setView] = useState<ViewId>('dashboard')

  if (!signedIn) {
    return (
      <div className="grain">
        <LoginScreen />
      </div>
    )
  }

  // No workspace connected yet → guide through setup
  if (!activeWorkspaceId) {
    return (
      <div className="grain min-h-[100dvh] bg-surface text-ink">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px]">
          <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r border-line-soft px-4 py-6 md:flex">
            <div className="px-2">
              <Logo />
            </div>
            <div className="mt-6">
              <WorkspaceSwitcher />
            </div>
          </aside>
          <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
            <div className="mb-8 flex w-full max-w-lg items-center justify-between">
              <Logo />
              <WorkspaceSwitcher compact />
            </div>
            <SetupWizard />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="grain min-h-[100dvh] bg-surface text-ink">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r border-line-soft px-4 py-6 md:flex">
          <div className="px-2">
            <Logo />
          </div>
          <div className="mt-6">
            <WorkspaceSwitcher />
          </div>
          <SidebarNav active={view} onChange={setView} items={NAV} />
          <div className="mt-auto px-2">
            {mockMode && (
              <p className="mb-3 rounded-xl border border-dashed border-line px-3 py-2 text-[11px] leading-snug text-ink-faint">
                Mock mode — no Google client id configured. Add{' '}
                <code className="text-ink-muted">VITE_GOOGLE_CLIENT_ID</code> to go live.
              </p>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line-soft bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
            <Logo />
            <WorkspaceSwitcher compact />
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:px-10 md:pt-10">
            {view === 'dashboard' && <Dashboard />}
            {view === 'accounts' && <Accounts />}
            {view === 'transactions' && <Transactions />}
            {view === 'swipe' && <SwipeDeck />}
            {view === 'revenue' && <Revenue />}
            {view === 'settings' && <Settings />}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-surface/95 backdrop-blur md:hidden">
        <div className="flex justify-around px-2 py-2">
          {NAV.slice(0, 5).map((item) => {
            const IconCmp = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                aria-label={item.label}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] transition-colors active:scale-[0.98] ${
                  view === item.id ? 'text-pos' : 'text-ink-faint'
                }`}
              >
                <IconCmp size={20} weight={view === item.id ? 'fill' : 'regular'} />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <Toasts />
    </div>
  )
}
