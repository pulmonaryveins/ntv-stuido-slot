import { useEffect, useState } from 'react'
import type { Snapshot } from '../../data'
import { useStudio } from '../../store/studio'
import { AdminHeader, formatMinutes } from './AdminPage'
import { Spinner } from '../Loader'

const MAX_SESSION = { min: 15, max: 1440 }
const HOLD = { min: 1, max: 120 }

export function SettingsPage({ snapshot }: { snapshot: Snapshot }) {
  const act = useStudio((s) => s.act)
  const pushToast = useStudio((s) => s.pushToast)
  const busy = useStudio((s) => s.busy > 0)
  const { max_session_min, hold_minutes } = snapshot.settings
  const [maxSession, setMaxSession] = useState(String(max_session_min))
  const [hold, setHold] = useState(String(hold_minutes))
  useEffect(() => setMaxSession(String(max_session_min)), [max_session_min])
  useEffect(() => setHold(String(hold_minutes)), [hold_minutes])

  const m = Number(maxSession)
  const h = Number(hold)
  const mOk = Number.isInteger(m) && m >= MAX_SESSION.min && m <= MAX_SESSION.max
  const hOk = Number.isInteger(h) && h >= HOLD.min && h <= HOLD.max
  const dirty = m !== max_session_min || h !== hold_minutes

  const save = async () => {
    if (!mOk || !hOk || !dirty) return
    const ok = await act((c) =>
      c.adminUpdateSettings({
        maxSessionMin: m !== max_session_min ? m : undefined,
        holdMinutes: h !== hold_minutes ? h : undefined,
      }),
    )
    if (ok) pushToast({ kind: 'info', title: 'Settings saved' })
  }

  return (
    <div>
      <AdminHeader title="Settings" description="Rules that apply to everyone on the board." />
      <form
        className="px-panel max-w-xl space-y-5 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="block">
          <span className="text-sm font-semibold">Longest session</span>
          <span className="block text-xs text-muted">The most time someone can book in one go. They can still extend, up to this limit each time.</span>
          <span className="mt-1.5 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={MAX_SESSION.min}
              max={MAX_SESSION.max}
              step={15}
              value={maxSession}
              onChange={(e) => setMaxSession(e.target.value)}
              aria-invalid={!mOk}
              className="w-28 border-2 border-line bg-surface-2 px-2 py-1.5 text-sm tabular-nums"
            />
            <span className="text-sm text-muted">minutes{mOk && ` (${formatMinutes(m)})`}</span>
          </span>
          {!mOk && <span className="mt-1 block text-xs text-overdue">Between {MAX_SESSION.min} and {MAX_SESSION.max} minutes.</span>}
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Reservation hold</span>
          <span className="block text-xs text-muted">How long a freed seat is kept for the next person on the waiting list before it opens to everyone.</span>
          <span className="mt-1.5 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={HOLD.min}
              max={HOLD.max}
              value={hold}
              onChange={(e) => setHold(e.target.value)}
              aria-invalid={!hOk}
              className="w-28 border-2 border-line bg-surface-2 px-2 py-1.5 text-sm tabular-nums"
            />
            <span className="text-sm text-muted">minutes</span>
          </span>
          {!hOk && <span className="mt-1 block text-xs text-overdue">Between {HOLD.min} and {HOLD.max} minutes.</span>}
        </label>

        <div className="flex justify-end gap-2 border-t-2 border-line pt-4">
          <button
            type="button"
            disabled={!dirty}
            onClick={() => {
              setMaxSession(String(max_session_min))
              setHold(String(hold_minutes))
            }}
            className="px-btn bg-surface-2 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={!dirty || !mOk || !hOk || busy}
            aria-busy={busy}
            className="px-btn inline-flex items-center gap-2 bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            Save changes
          </button>
        </div>
      </form>
    </div>
  )
}
