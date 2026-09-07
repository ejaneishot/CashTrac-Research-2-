import { useStore } from '../../store'
import { Logo } from './Logo'
import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck, FolderOpen, ArrowsClockwise } from '@phosphor-icons/react'

export function LoginScreen() {
  const { signIn, googleReady } = useStore()
  const ready = googleReady

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface px-4 py-10 text-ink">
      <div className="grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-16">
        {/* Left — pitch */}
        <div className="order-2 md:order-1">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          >
            <Logo />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.05 }}
            className="mt-8 text-4xl font-semibold leading-[1.05] tracking-tighter md:text-5xl"
          >
            Company finance,
            <br />
            <span className="text-pos">without the dread.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.1 }}
            className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-ink-muted"
          >
            CashTrac reads your Google Drive — your statements, your sheets, your
            invoices — and turns them into a clean, swipeable view of where the
            money is. Your data never leaves your Drive.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="mt-8 space-y-3"
          >
            {[
              { icon: FolderOpen, text: 'Statements live as raw files in your Drive' },
              { icon: ArrowsClockwise, text: 'Duplicate-safe imports — weekly + monthly just work' },
              { icon: ShieldCheck, text: 'Private workspaces stay private via Drive sharing' },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-[13.5px] text-ink-muted">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-hover text-pos">
                  <item.icon size={15} />
                </span>
                {item.text}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Right — sign in */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.12 }}
          className="order-1 md:order-2"
        >
          <div className="mx-auto w-full max-w-sm rounded-[2.5rem] border border-line bg-surface-raised p-8 shadow-diffuse">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
              Sign in to continue
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              Use your Google account — we only touch folders you connect.
            </p>

            <button
              onClick={() => void signIn()}
              disabled={!ready}
              className="group mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 py-3.5 text-[14.5px] font-semibold text-surface transition-all hover:bg-ink/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ready ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </>
              ) : (
                'Loading…'
              )}
            </button>

            <button
              onClick={() => void signIn()}
              disabled={!ready}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-line px-5 py-3 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-pos hover:text-pos active:scale-[0.98] disabled:opacity-50"
            >
              Continue to demo <ArrowRight size={15} />
            </button>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-faint">
              By continuing you agree to only connect folders you own or share.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
