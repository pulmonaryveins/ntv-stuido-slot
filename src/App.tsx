import { lazy, Suspense, useEffect, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { startStudio, useStudio } from './store/studio'
import { initAuth, useAuth } from './store/auth'
import { backendMode } from './lib/backend'
import { AuthScreen, InactiveScreen, LoadingScreen, NewPasswordScreen } from './ui/AuthScreen'
import { ActivityBar, Loader } from './ui/Loader'
import { TopBar } from './ui/TopBar'
import { Panel } from './ui/Panel'
import { ClaimDialog, DeviceNameDialog } from './ui/Dialogs'
import { Toasts } from './ui/Toasts'
import { AdminPage } from './ui/admin/AdminPage'

const Stage = lazy(() => import('./scene/Stage'))

/** Auth gate: with Supabase configured, the board only mounts for a signed-in user. */
export function App() {
  const status = useAuth((s) => s.status)
  const profileActive = useAuth((s) => s.profileActive)
  const theme = useStudio((s) => s.theme)

  useEffect(() => initAuth(), [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  if (backendMode !== 'bff') return <Board />
  if (status === 'signedIn') {
    if (profileActive === null) return <LoadingScreen />
    return profileActive ? <Board /> : <InactiveScreen />
  }
  if (status === 'loading') return <LoadingScreen />
  if (status === 'recovery') return <NewPasswordScreen />
  return <AuthScreen />
}

function Board() {
  const view = useStudio((s) => s.view)
  const page = useStudio((s) => s.page)
  const loadError = useStudio((s) => s.loadError)
  // Mount the 3D stage on first use, then keep it (paused) so switching back is instant.
  const [stageMounted, setStageMounted] = useState(view === '3d')

  const userId = useAuth((s) => s.userId)
  const snapshot = useStudio((s) => s.snapshot)

  useEffect(() => {
    if (backendMode === 'bff') useStudio.setState({ actorId: userId })
    startStudio()
  }, [userId])
  useEffect(() => {
    if (view === '3d') setStageMounted(true)
  }, [view])

  const show3d = view === '3d' && page === 'board'

  // Deactivated mid-session: RLS starts hiding the board. Re-check so the gate switches screens.
  const meInactive = !!snapshot && snapshot.profiles.find((p) => p.id === userId)?.active === false
  useEffect(() => {
    if (backendMode === 'bff' && (loadError || meInactive)) void useAuth.getState().checkProfile()
  }, [loadError, meInactive])

  return (
    <Tooltip.Provider>
      <div className="flex h-full flex-col">
        <a
          href="#panel"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to slots
        </a>
        <TopBar />
        <ActivityBar />
        {loadError && (
          <p role="alert" className="bg-overdue/15 px-4 py-2 text-sm text-overdue">
            Could not load the board: {loadError}
          </p>
        )}
        {page === 'admin' ? (
          <main className="min-h-0 flex-1 overflow-y-auto">
            <AdminPage />
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            {stageMounted && (
              <div
                className={show3d ? 'relative h-[48vh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1' : 'hidden'}
                aria-hidden={!show3d}
              >
                <Suspense fallback={<Loader label="Building the office…" className="h-full" />}>
                  <Stage active={show3d} />
                </Suspense>
              </div>
            )}
            <div
              id="panel"
              tabIndex={-1}
              className={
                show3d
                  ? 'border-line bg-bg lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-l'
                  : 'w-full lg:overflow-y-auto'
              }
            >
              <Panel wide={!show3d} />
            </div>
          </main>
        )}
        <footer className="on-dark flex flex-wrap items-center gap-x-3 border-t-2 border-black bg-black px-4 py-1.5 text-[11px] text-muted">
          <span>Studio Slots · never store Adobe credentials here</span>
        </footer>
      </div>
      <ClaimDialog />
      <DeviceNameDialog />
      <Toasts />
    </Tooltip.Provider>
  )
}
