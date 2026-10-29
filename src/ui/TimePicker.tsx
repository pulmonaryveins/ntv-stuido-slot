import { useEffect, useRef } from 'react'

const MINUTE = 60_000
const pad = (n: number) => String(n).padStart(2, '0')

/** Minutes from `now` until today's h:m (can be <= 0 once it has passed). */
function until(h: number, m: number, now: number) {
  const end = new Date(now)
  end.setHours(h, m, 0, 0)
  return Math.ceil((end.getTime() - now) / MINUTE)
}

/** Hour and minute columns for choosing today's finish time; times outside now..now+max are disabled. */
export function TimePicker({
  value,
  onChange,
  now,
  maxMinutes,
}: {
  value: string
  onChange: (hhmm: string) => void
  now: number
  maxMinutes: number
}) {
  const [hh, mm] = /^(\d{2}):(\d{2})$/.test(value) ? value.split(':').map(Number) : [null, null]
  const ok = (h: number, m: number) => {
    const d = until(h, m, now)
    return d >= 1 && d <= maxMinutes
  }
  const hours = Array.from({ length: 24 }, (_, h) => h)
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5)
  const hourOk = (h: number) => minutes.some((m) => ok(h, m))

  const pickHour = (h: number) => {
    // Keep the minute if still valid, otherwise the first valid one.
    const m = mm !== null && ok(h, mm) ? mm : (minutes.find((x) => ok(h, x)) ?? 0)
    onChange(`${pad(h)}:${pad(m)}`)
  }
  const pickMinute = (m: number) => onChange(`${pad(hh ?? new Date(now).getHours())}:${pad(m)}`)

  return (
    <div role="group" aria-label="Pick the time you will finish" className="mt-2 flex items-stretch gap-3">
      <Column label="Hour" items={hours} selected={hh} format={(h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`} isOk={hourOk} onPick={pickHour} />
      <span aria-hidden className="self-center text-xl font-semibold">
        :
      </span>
      <Column
        label="Minute"
        items={minutes}
        selected={mm}
        format={(m) => pad(m)}
        isOk={(m) => hh !== null && ok(hh, m)}
        onPick={pickMinute}
      />
    </div>
  )
}

function Column({
  label,
  items,
  selected,
  format,
  isOk,
  onPick,
}: {
  label: string
  items: number[]
  selected: number | null
  format: (n: number) => string
  isOk: (n: number) => boolean
  onPick: (n: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Keep the chosen value in view (scroll only this column, not the page).
    const box = ref.current
    const el = box?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2
  }, [selected])
  return (
    <div className="flex-1">
      <div className="mb-1 text-center text-xs text-muted">{label}</div>
      <div
        ref={ref}
        role="radiogroup"
        aria-label={label}
        className="relative h-32 snap-y overflow-y-auto border-2 border-line bg-surface-2 p-1"
      >
        {items.map((n) => {
          const on = n === selected
          const enabled = isOk(n)
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!enabled}
              onClick={() => onPick(n)}
              className={`block w-full snap-center py-1 text-center font-mono text-sm ${
                on ? 'bg-accent font-semibold text-accent-ink' : enabled ? 'hover:bg-surface' : 'cursor-not-allowed opacity-30'
              }`}
            >
              {format(n)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
