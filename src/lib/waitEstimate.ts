import type { QueueEntry, Slot } from '../data/types'
import { MINUTE, toMs } from './format'

export const OVERDUE_GRACE_MS = 5 * MINUTE

/**
 * When an occupied slot is expected to free up.
 * Rendering uses the render ETA; overdue slots are assumed to free in 5 minutes.
 */
export function slotFreeTime(slot: Slot, now: number): number {
  if (!slot.user_id) return now
  const expected = toMs(slot.expected_until) ?? now
  if (slot.status === 'rendering') {
    const eta = toMs(slot.render_eta)
    if (eta !== null) return Math.max(eta, now)
  }
  if (expected <= now) return now + OVERDUE_GRACE_MS
  return expected
}

/**
 * Estimated time each queued user gets a seat (ms timestamp).
 * Users already holding a reservation get `now`. The rest, in queue order,
 * take the sorted free-times of occupied slots (and any free unheld slot = now).
 */
export function estimateWaits(slots: Slot[], queue: QueueEntry[], now: number): Map<string, number> {
  const result = new Map<string, number>()
  const holders = new Set(slots.map((s) => s.hold_user_id).filter((u): u is string => !!u))

  const freeTimes = slots
    .filter((s) => !s.hold_user_id)
    .map((s) => slotFreeTime(s, now))
    .sort((a, b) => a - b)

  const ordered = [...queue].sort(
    (a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id,
  )
  let next = 0
  for (const entry of ordered) {
    if (holders.has(entry.user_id)) {
      result.set(entry.user_id, now)
      continue
    }
    // More people than seats: cycle around, assuming another full session after each free-up.
    const base = freeTimes[next % Math.max(freeTimes.length, 1)] ?? now
    const rounds = freeTimes.length ? Math.floor(next / freeTimes.length) : 0
    result.set(entry.user_id, base + rounds * 60 * MINUTE)
    next++
  }
  return result
}
