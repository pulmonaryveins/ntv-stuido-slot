import { describe, expect, it } from 'vitest'
import { deriveSlotView } from './slotState'
import { estimateWaits, slotFreeTime, OVERDUE_GRACE_MS } from './waitEstimate'
import { formatAgo, formatDuration, MINUTE, toIso } from './format'
import { buildViewer, queueGates, slotGates } from './availability'
import { createSeedState, SEED_IDS } from '../data/seed'
import type { QueueEntry, Slot } from '../data/types'

const NOW = Date.parse('2026-10-28T10:00:00Z')
const at = (min: number) => toIso(NOW + min * MINUTE)

const slot = (over: Partial<Slot> = {}): Slot => ({
  id: 1, account_id: 1, slot_number: 1, user_id: null, status: null, claimed_at: null,
  expected_until: null, render_eta: null, hold_user_id: null, hold_until: null,
  prev_status: null, break_until: null, device_name: null, ...over,
})
const seated = (over: Partial<Slot> = {}) =>
  slot({ user_id: 'u', status: 'editing', claimed_at: at(-30), expected_until: at(30), ...over })

describe('deriveSlotView', () => {
  it('free and reserved', () => {
    expect(deriveSlotView(slot(), NOW).kind).toBe('free')
    const v = deriveSlotView(slot({ hold_user_id: 'q', hold_until: at(4) }), NOW)
    expect(v.kind).toBe('reserved')
    expect(v.holdRemainingMs).toBe(4 * MINUTE)
  })

  it('in use with progress and remaining time', () => {
    const v = deriveSlotView(seated(), NOW)
    expect(v.kind).toBe('in_use')
    expect(v.progress).toBeCloseTo(0.5)
    expect(v.remainingMs).toBe(30 * MINUTE)
  })

  it('overdue past expected_until, rendering wins but keeps the flag', () => {
    expect(deriveSlotView(seated({ expected_until: at(-1) }), NOW).kind).toBe('overdue')
    const r = deriveSlotView(seated({ expected_until: at(-1), status: 'rendering', render_eta: at(10) }), NOW)
    expect(r.kind).toBe('rendering')
    expect(r.overdue).toBe(true)
    expect(r.renderRemainingMs).toBe(10 * MINUTE)
  })

  it('break, and break overrun counts as overdue', () => {
    expect(deriveSlotView(seated({ status: 'break', break_until: at(5) }), NOW).kind).toBe('break')
    expect(deriveSlotView(seated({ status: 'break', break_until: at(-1) }), NOW).kind).toBe('overdue')
  })
})

describe('wait estimate', () => {
  it('slot free times: rendering uses ETA, overdue = now + 5 min', () => {
    expect(slotFreeTime(slot(), NOW)).toBe(NOW)
    expect(slotFreeTime(seated(), NOW)).toBe(NOW + 30 * MINUTE)
    expect(slotFreeTime(seated({ status: 'rendering', render_eta: at(12) }), NOW)).toBe(NOW + 12 * MINUTE)
    expect(slotFreeTime(seated({ expected_until: at(-3) }), NOW)).toBe(NOW + OVERDUE_GRACE_MS)
  })

  it('assigns sorted free times in queue order; holders are ready now', () => {
    const slots = [
      seated({ id: 1, expected_until: at(50) }),
      seated({ id: 2, status: 'rendering', render_eta: at(28), expected_until: at(35) }),
      seated({ id: 3, expected_until: at(-12) }),
      slot({ id: 4, hold_user_id: 'h', hold_until: at(8) }),
    ]
    const queue: QueueEntry[] = [
      { id: 1, user_id: 'h', joined_at: at(-20) },
      { id: 2, user_id: 'a', joined_at: at(-15) },
      { id: 3, user_id: 'b', joined_at: at(-8) },
      { id: 4, user_id: 'c', joined_at: at(-2) },
    ]
    const w = estimateWaits(slots, queue, NOW)
    expect(w.get('h')).toBe(NOW)
    expect(w.get('a')).toBe(NOW + 5 * MINUTE)
    expect(w.get('b')).toBe(NOW + 28 * MINUTE)
    expect(w.get('c')).toBe(NOW + 50 * MINUTE)
  })
})

describe('format', () => {
  it('durations', () => {
    expect(formatDuration(30_000)).toBe('<1m')
    expect(formatDuration(12 * MINUTE)).toBe('12m')
    expect(formatDuration(125 * MINUTE)).toBe('2h 05m')
    expect(formatDuration(-7 * MINUTE)).toBe('7m')
  })
  it('ago', () => {
    expect(formatAgo(NOW - 10_000, NOW)).toBe('just now')
    expect(formatAgo(NOW - 4 * MINUTE, NOW)).toBe('4m ago')
    expect(formatAgo(NOW - 130 * MINUTE, NOW)).toBe('2h ago')
  })
})

describe('availability gates', () => {
  const snap = createSeedState(NOW)

  it('knock disabled while rendering, hidden on own/free slots', () => {
    const v = buildViewer(snap, SEED_IDS.lena)
    expect(slotGates(snap.slots[1]!, v, snap, NOW).knock).toMatch(/Render/)
    expect(slotGates(snap.slots[0]!, v, snap, NOW).knock).toBeNull()
    const maya = buildViewer(snap, SEED_IDS.maya)
    expect(slotGates(snap.slots[0]!, maya, snap, NOW).knock).toBe('hidden')
  })

  it('force release only for admins; claim blocked on taken slots', () => {
    const admin = buildViewer(snap, SEED_IDS.admin)
    expect(slotGates(snap.slots[0]!, admin, snap, NOW).forceRelease).toBeNull()
    const lena = buildViewer(snap, SEED_IDS.lena)
    expect(slotGates(snap.slots[0]!, lena, snap, NOW).forceRelease).toBe('hidden')
    expect(slotGates(snap.slots[0]!, lena, snap, NOW).claim).toBe('Slot in use')
  })

  it('queue join allowed only when full and not seated/queued', () => {
    expect(queueGates(buildViewer(snap, SEED_IDS.lena), snap).join).toBeNull()
    expect(queueGates(buildViewer(snap, SEED_IDS.maya), snap).join).toMatch(/already hold/)
    expect(queueGates(buildViewer(snap, SEED_IDS.theo), snap).join).toMatch(/waiting list/)
  })
})
