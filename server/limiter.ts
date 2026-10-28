/**
 * Best-effort in-memory attempt limiter (per server instance) for unauthenticated auth
 * endpoints. Board actions are rate-limited in the database instead.
 */
const WINDOW_MS = 15 * 60_000
const buckets = new Map<string, { count: number; resetAt: number }>()

export function allowAttempt(key: string, max: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  b.count++
  return b.count <= max
}

export function clearAttempts(key: string) {
  buckets.delete(key)
}
