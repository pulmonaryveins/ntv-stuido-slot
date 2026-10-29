export const MINUTE = 60_000
export const HOUR = 60 * MINUTE

export function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

/** "2h 05m", "12m", "<1m". Negative durations are formatted by absolute value. */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms)
  if (abs < MINUTE) return '<1m'
  const totalMin = Math.floor(abs / MINUTE)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** "14:05" in local time. */
/** 12-hour clock: "4:10 PM". */
export function formatClock(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours()
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "just now", "4m ago", "2h ago", "3d ago". */
export function formatAgo(ms: number, now: number): string {
  const diff = now - ms
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < 24 * HOUR) return `${Math.floor(diff / HOUR)}h ago`
  return `${Math.floor(diff / (24 * HOUR))}d ago`
}
