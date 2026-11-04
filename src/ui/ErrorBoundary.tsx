import { Component, type ReactNode } from 'react'

/** Shows the error (instead of a blank page) if anything in the app throws while rendering. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: unknown) {
    console.error('[studio] render error', error)
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main className="grid h-full place-items-center p-6">
        <div className="px-panel max-w-lg p-5">
          <h1 className="text-lg">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted">The page hit an error while drawing. Reloading usually fixes it.</p>
          <pre className="mt-3 max-h-48 overflow-auto bg-surface-2 p-2 text-xs text-overdue">{error.message}</pre>
          <button type="button" onClick={() => location.reload()} className="px-btn mt-4 bg-accent px-3 py-1.5 text-sm text-accent-ink">
            Reload
          </button>
        </div>
      </main>
    )
  }
}
