import { describe, expect, it } from 'vitest'
import { adminStats, activityCategory } from './adminStats'
import { createSeedState, SEED_IDS } from '../data/seed'
import type { ActivityEntry } from '../data/types'

const NOW = Date.parse('2026-10-29T15:00:00Z')
let id = 0
const entry = (action: string, slot: number | null, user: string, minutesAgo: number): ActivityEntry => ({
  id: ++id,
  slot_id: slot,
  user_id: user,
  action,
  meta: {},
  created_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
})

describe('admin stats', () => {
  it('pairs claims with ends for session length and per-user seat time', () => {
    const snap = createSeedState(NOW)
    snap.slots = snap.slots.map((s) => ({ ...s, user_id: null, expected_until: null, hold_user_id: null, hold_until: null }))
    snap.slots[0]!.user_id = SEED_IDS.jun
    snap.activity = [
      entry('claim', 1, SEED_IDS.jun, 30), // still seated: 30 min so far
      entry('release', 2, SEED_IDS.maya, 60),
      entry('claim', 2, SEED_IDS.maya, 150), // 90 min session
      entry('force_release', 3, SEED_IDS.admin, 200),
      entry('claim', 3, SEED_IDS.sam, 230), // 30 min session
    ].reverse()
    const s = adminStats(snap, NOW)
    expect(s.seatsInUse).toBe(1)
    expect(s.avgSessionMin).toBe(60)
    expect(s.topUsers.map((u) => [u.userId, Math.round(u.minutes)])).toEqual([
      [SEED_IDS.maya, 90],
      [SEED_IDS.sam, 30],
      [SEED_IDS.jun, 30],
    ])
  })

  it('groups actions for the activity filter', () => {
    expect(activityCategory('claim')).toBe('sessions')
    expect(activityCategory('queue_join')).toBe('queue')
    expect(activityCategory('force_release')).toBe('admin')
    expect(activityCategory('user_deleted')).toBe('accounts')
  })
})
