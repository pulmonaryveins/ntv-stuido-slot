import type { ActivityEntry, Snapshot } from '../data/types'
import { MINUTE, toMs } from './format'

export interface UserUsage {
  userId: string
  minutes: number
  sessions: number
}

export interface AdminStats {
  seatsTotal: number
  seatsInUse: number
  seatsReserved: number
  overdueNow: number
  waiting: number
  activeUsers: number
  inactiveUsers: number
  admins: number
  sessionsToday: number
  endedToday: number
  /** Average length of finished sessions in the loaded history; null when there are none. */
  avgSessionMin: number | null
  /** Seat time per user in the loaded history (ongoing sessions count up to now), most first. */
  topUsers: UserUsage[]
  /** Oldest activity timestamp loaded (stats only cover the loaded history). */
  since: number | null
}

const ENDS = new Set(['release', 'force_release'])

function startOfDay(now: number) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Pair each claim with the next end on the same slot to get session lengths. */
function sessions(activity: ActivityEntry[], snapshot: Snapshot, now: number) {
  const open = new Map<number, { userId: string | null; start: number }>()
  const out: { userId: string | null; start: number; end: number; finished: boolean }[] = []
  const chronological = [...activity].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
  for (const a of chronological) {
    if (a.slot_id === null) continue
    const at = toMs(a.created_at) ?? now
    if (a.action === 'claim') {
      open.set(a.slot_id, { userId: a.user_id, start: at })
    } else if (ENDS.has(a.action)) {
      const s = open.get(a.slot_id)
      if (s) out.push({ ...s, end: at, finished: true })
      open.delete(a.slot_id)
    }
  }
  // Claims still open: count up to now if the seat is still held by them.
  for (const [slotId, s] of open) {
    const slot = snapshot.slots.find((x) => x.id === slotId)
    if (slot?.user_id && slot.user_id === s.userId) out.push({ ...s, end: now, finished: false })
  }
  return out
}

export function adminStats(snapshot: Snapshot, now: number): AdminStats {
  const today = startOfDay(now)
  const all = sessions(snapshot.activity, snapshot, now)
  const finished = all.filter((s) => s.finished)
  const usage = new Map<string, UserUsage>()
  for (const s of all) {
    if (!s.userId) continue
    const u = usage.get(s.userId) ?? { userId: s.userId, minutes: 0, sessions: 0 }
    u.minutes += Math.max(0, (s.end - s.start) / MINUTE)
    u.sessions += 1
    usage.set(s.userId, u)
  }
  const times = snapshot.activity.map((a) => toMs(a.created_at)).filter((t): t is number => t !== null)
  return {
    seatsTotal: snapshot.slots.length,
    seatsInUse: snapshot.slots.filter((s) => s.user_id).length,
    seatsReserved: snapshot.slots.filter((s) => !s.user_id && s.hold_user_id).length,
    overdueNow: snapshot.slots.filter((s) => s.user_id && (toMs(s.expected_until) ?? Infinity) <= now).length,
    waiting: snapshot.queue.length,
    activeUsers: snapshot.profiles.filter((p) => p.active).length,
    inactiveUsers: snapshot.profiles.filter((p) => !p.active).length,
    admins: snapshot.profiles.filter((p) => p.role === 'admin').length,
    sessionsToday: snapshot.activity.filter((a) => a.action === 'claim' && (toMs(a.created_at) ?? 0) >= today).length,
    endedToday: snapshot.activity.filter((a) => ENDS.has(a.action) && (toMs(a.created_at) ?? 0) >= today).length,
    avgSessionMin: finished.length
      ? Math.round(finished.reduce((n, s) => n + (s.end - s.start), 0) / finished.length / MINUTE)
      : null,
    topUsers: [...usage.values()].sort((a, b) => b.minutes - a.minutes),
    since: times.length ? Math.min(...times) : null,
  }
}

export type ActivityCategory = 'all' | 'sessions' | 'queue' | 'admin' | 'accounts'

const CATEGORY: Record<string, Exclude<ActivityCategory, 'all'>> = {
  claim: 'sessions',
  release: 'sessions',
  extend: 'sessions',
  overdue: 'sessions',
  knock: 'sessions',
  device_change: 'sessions',
  status: 'sessions',
  queue_join: 'queue',
  queue_leave: 'queue',
  queue_remove: 'queue',
  hold_granted: 'queue',
  hold_expired: 'queue',
  force_release: 'admin',
  settings_update: 'admin',
  account_update: 'admin',
  profile_update: 'accounts',
  user_registered: 'accounts',
  user_deleted: 'accounts',
}

export function activityCategory(action: string): Exclude<ActivityCategory, 'all'> {
  return CATEGORY[action] ?? 'sessions'
}
