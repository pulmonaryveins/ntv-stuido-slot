import type { MockStudioClient } from './mockClient'
import type { StudioActions } from './types'
import { DEFAULT_STATUS_FOR_ROLE } from '../lib/status'
import { MINUTE, toMs } from '../lib/format'

type Move = { weight: number; run: () => Promise<unknown> }

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)]!
const chance = (p: number) => Math.random() < p

/**
 * "Live demo": simulated teammates act through the same client API as the UI,
 * so every rule (holds, render lock, knock limit, ...) applies to them too.
 * Never acts as the user currently selected in the "Acting as" switcher.
 */
export function startDemo(client: MockStudioClient, getActorId: () => string | null, intervalMs = 1400) {
  const step = () => {
    const snap = client.peek()
    const now = client.now()
    const me = getActorId()
    const as = (uid: string): StudioActions => client.asUser(uid)
    const people = snap.profiles.filter((p) => p.active && p.role === 'user' && p.id !== me)
    const seated = new Set(snap.slots.map((s) => s.user_id).filter(Boolean))
    const queued = new Set(snap.queue.map((q) => q.user_id))
    const idle = people.filter((p) => !seated.has(p.id) && !queued.has(p.id))
    const moves: Move[] = []

    for (const s of snap.slots) {
      // Reserved: holder usually claims after a few minutes, sometimes lets it lapse.
      if (s.hold_user_id && s.hold_user_id !== me) {
        const holdLeft = (toMs(s.hold_until) ?? now) - now
        const holder = snap.profiles.find((p) => p.id === s.hold_user_id)
        if (holder && holdLeft < 7 * MINUTE && chance(0.85)) {
          moves.push({
            weight: 5,
            run: () => as(holder.id).claimSlot(s.id, DEFAULT_STATUS_FOR_ROLE[holder.work_role], pick([60, 90, 120])),
          })
        }
        continue
      }
      // Free: an idle teammate grabs it.
      if (!s.user_id) {
        const who = idle.length ? pick(idle) : null
        if (who) moves.push({ weight: 3, run: () => as(who.id).claimSlot(s.id, DEFAULT_STATUS_FOR_ROLE[who.work_role], pick([45, 60, 90, 120])) })
        continue
      }
      if (s.user_id === me) continue

      const owner = as(s.user_id)
      const left = (toMs(s.expected_until) ?? now) - now
      if (left <= 0) {
        moves.push({ weight: 1.5, run: () => owner.releaseSlot(s.id) })
        moves.push({ weight: 1, run: () => owner.extendSlot(s.id, 30) })
      } else if (left < 15 * MINUTE) {
        moves.push({ weight: 1, run: () => owner.extendSlot(s.id, 30) })
        moves.push({ weight: 0.8, run: () => owner.releaseSlot(s.id) })
      }
      if (s.status !== 'rendering') {
        // Someone waiting knocks on a long-running or overdue seat.
        const knocker = [...queued].filter((u) => u !== me)
        if (knocker.length && (left <= 0 || chance(0.2))) {
          moves.push({ weight: left <= 0 ? 1 : 0.2, run: () => as(pick(knocker)).knock(s.id) })
        }
      }
      moves.push({ weight: 0.1, run: () => owner.releaseSlot(s.id) })
    }

    const allTaken = snap.slots.every((s) => s.user_id || s.hold_user_id)
    if (allTaken && idle.length && snap.queue.length < 4) {
      moves.push({ weight: 0.6, run: () => as(pick(idle).id).joinQueue() })
    }
    const leavers = snap.queue.filter((q) => q.user_id !== me)
    if (leavers.length) moves.push({ weight: 0.05, run: () => as(pick(leavers).user_id).leaveQueue() })

    if (!moves.length) return
    let r = Math.random() * moves.reduce((sum, m) => sum + m.weight, 0)
    const move = moves.find((m) => (r -= m.weight) <= 0) ?? moves[moves.length - 1]!
    move.run().catch(() => {
      /* rule rejections are expected for simulated users */
    })
  }

  const timer = setInterval(step, intervalMs)
  return () => clearInterval(timer)
}
