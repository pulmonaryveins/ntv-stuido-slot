import { useEffect, useState } from 'react'
import type { Snapshot } from '../../data'
import { useStudio } from '../../store/studio'
import { AdminHeader, formatMinutes } from './AdminPage'
import { Spinner } from '../Loader'
import { PixelIcon, type IconName } from '../PixelIcon'

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
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <SettingCard
            icon="clock"
            title="Longest session"
            description="The most time someone can book in one go. They can still extend, up to this limit each time."
            value={maxSession}
            onChange={setMaxSession}
            ok={mOk}
            range={MAX_SESSION}
            step={15}
            presets={[60, 120, 240, 480]}
            current={max_session_min}
            preview={mOk ? formatMinutes(m) : null}
          />
          <SettingCard
            icon="ticket"
            title="Reservation hold"
            description="How long a freed seat is kept for the next person on the waiting list before it opens to everyone."
            value={hold}
            onChange={setHold}
            ok={hOk}
            range={HOLD}
            step={1}
            presets={[5, 10, 15, 30]}
            current={hold_minutes}
            preview={hOk ? formatMinutes(h) : null}
          />
        </div>

        {/* Save bar: shows when something changed */}
        <div
          className={`px-panel sticky bottom-4 mt-5 flex flex-wrap items-center gap-3 p-3 ${dirty ? 'border-accent' : ''}`}
        >
          <span className={`text-sm ${dirty ? 'text-ink' : 'text-muted'}`}>
            {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
          </span>
          <div className="ml-auto flex gap-2">
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
              className="px-btn inline-flex items-center gap-2 bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              Save changes
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

/** One rule: icon, explanation, number with steppers, quick presets and a preview. */
function SettingCard({
  icon,
  title,
  description,
  value,
  onChange,
  ok,
  range,
  step,
  presets,
  current,
  preview,
}: {
  icon: IconName
  title: string
  description: string
  value: string
  onChange: (v: string) => void
  ok: boolean
  range: { min: number; max: number }
  step: number
  presets: number[]
  current: number
  preview: string | null
}) {
  const n = Number(value)
  const bump = (d: number) => {
    const base = Number.isFinite(n) ? n : current
    onChange(String(Math.min(range.max, Math.max(range.min, base + d))))
  }
  const changed = ok && n !== current
  return (
    <section className="px-panel flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="px-btn grid size-10 shrink-0 place-items-center bg-surface-2">
          <PixelIcon name={icon} size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm normal-case">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" aria-label={`Decrease ${title}`} onClick={() => bump(-step)} className="px-btn grid size-10 place-items-center bg-surface-2 text-lg font-bold">
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label={`${title} in minutes`}
          min={range.min}
          max={range.max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!ok}
          className={`no-ring h-10 w-24 border bg-surface-2 px-2 text-center font-pixel text-lg tabular-nums focus:border-accent ${
            ok ? 'border-line' : 'border-overdue'
          }`}
        />
        <button type="button" aria-label={`Increase ${title}`} onClick={() => bump(step)} className="px-btn grid size-10 place-items-center bg-surface-2 text-lg font-bold">
          +
        </button>
        <span className="text-sm text-muted">minutes</span>
        {preview && <span className="ml-auto bg-surface-2 px-2 py-1 text-xs font-semibold">{preview}</span>}
      </div>
      {!ok && (
        <p className="mt-1.5 text-xs text-overdue">
          Between {range.min} and {range.max} minutes.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`${title} presets`}>
        {presets.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={n === v}
            onClick={() => onChange(String(v))}
            className={`border px-2.5 py-1 text-xs font-semibold ${n === v ? 'border-line bg-accent text-white' : 'border-line bg-surface-2 text-muted hover:text-ink'}`}
          >
            {formatMinutes(v)}
          </button>
        ))}
      </div>

      <p className="mt-auto pt-3 text-[11px] text-muted">
        Currently <strong className="text-ink">{formatMinutes(current)}</strong>
        {changed && (
          <>
            {' '}
            → <strong className="text-accent">{formatMinutes(n)}</strong>
          </>
        )}
      </p>
    </section>
  )
}
