import { lazy, Suspense, useEffect, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { startStudio, useStudio } from './store/studio'
import { TopBar } from './ui/TopBar'
import { Panel } from './ui/Panel'
import { ClaimDialog, RenderEtaDialog } from './ui/Dialogs'
import { Toasts } from './ui/Toasts'
import { AdminStub } from './ui/AdminStub'

const Stage = lazy(() => import('./scene/Stage'))

export function App() {
  const view = useStudio((s) => s.view)
  const page = useStudio((s) => s.page)
  const theme = useStudio((s) => s.theme)
  const loadError = useStudio((s) => s.loadError)
  // Mount the 3D stage on first use, then keep it (paused) so switching back is instant.
  const [stageMounted, setStageMounted] = useState(view === '3d')

  useEffect(() => startStudio(), [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    if (view === '3d') setStageMounted(true)
  }, [view])

  const show3d = view === '3d' && page === 'board'

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
        {loadError && (
          <p role="alert" className="bg-overdue/15 px-4 py-2 text-sm text-overdue">
            Could not load the board: {loadError}
          </p>
        )}
        {page === 'admin' ? (
          <main className="min-h-0 flex-1 overflow-y-auto">
            <AdminStub />
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            {stageMounted && (
              <div
                className={show3d ? 'relative h-[48vh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1' : 'hidden'}
                aria-hidden={!show3d}
              >
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading 3D studio…</div>}>
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
                  : 'mx-auto w-full max-w-6xl lg:overflow-y-auto'
              }
            >
              <Panel wide={!show3d} />
            </div>
          </main>
        )}
        <footer className="flex flex-wrap items-center gap-x-3 border-t border-line bg-surface px-4 py-1.5 text-[11px] text-muted">
          <span>Studio Slots · never store Adobe credentials here</span>
        </footer>
      </div>
      <ClaimDialog />
      <RenderEtaDialog />
      <Toasts />
    </Tooltip.Provider>
  )
}
