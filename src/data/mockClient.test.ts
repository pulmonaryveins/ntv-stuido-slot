import { describe, expect, it } from 'vitest'
import { MockStudioClient } from './mockClient'
import { SEED_IDS, createSeedState } from './seed'
import { StudioError } from './types'
import { MINUTE, toIso } from '../lib/format'

class ManualClock {
  t = Date.parse('2026-10-28T10:00:00Z')
  now() {
    return this.t
  }
  advance(min: number) {
    this.t += min * MINUTE
  }
}

/** Seeded board with every slot freed and the queue emptied. */
function emptyBoard(withoutDevice: string[] = []) {
  const clock = new ManualClock()
  const client = new MockStudioClient({
    clock,
    actorId: SEED_IDS.lena,
    seed: (now) => {
      const s = createSeedState(now)
      s.slots = s.slots.map((x) => ({
        ...x, user_id: null, status: null, claimed_at: null, expected_until: null, render_eta: null, device_name: null,
      }))
      s.profiles = s.profiles.map((p) => (withoutDevice.includes(p.id) ? { ...p, device_name: null } : p))
      s.queue = []
      s.activity = []
      return s
    },
  })
  return { clock, client }
}

const code = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    return (e as StudioError).code
  }
}

describe('MockStudioClient rules', () => {
  it('seeds a believable board', () => {
    const client = new MockStudioClient({ clock: new ManualClock() })
    const { slots, queue, profiles } = client.peek()
    expect(profiles).toHaveLength(11)
    expect(slots.map((s) => s.status)).toEqual(['editing', 'rendering', 'designing', 'color_grading'])
    expect(queue).toHaveLength(2)
  })

  it('claim conflict: exactly one of two simultaneous claims succeeds', async () => {
    const { client } = emptyBoard()
    const results = await Promise.allSettled([
      client.asUser(SEED_IDS.maya).claimSlot(1, 'editing', 60),
      client.asUser(SEED_IDS.jun).claimSlot(1, 'designing', 60),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect((rejected.reason as StudioError).code).toBe('slot_taken')
  })

  it('one seat per user, no claiming break/rendering, minutes capped', async () => {
    const { client } = emptyBoard()
    const maya = client.asUser(SEED_IDS.maya)
    await maya.claimSlot(1, 'editing', 60)
    expect(await code(maya.claimSlot(2, 'editing', 60))).toBe('already_seated')
    expect(await code(client.asUser(SEED_IDS.jun).claimSlot(2, 'break', 60))).toBe('invalid_status')
    expect(await code(client.asUser(SEED_IDS.jun).claimSlot(2, 'rendering', 60))).toBe('invalid_status')
    expect(await code(client.asUser(SEED_IDS.jun).claimSlot(2, 'editing', 241))).toBe('invalid_minutes')
  })

  it('queue only when no unheld free slot; hold handoff #1 -> #2 after 10 min', async () => {
    const { client, clock } = emptyBoard()
    const [maya, jun, sam, lena, omar, priya, theo] = [
      SEED_IDS.maya, SEED_IDS.jun, SEED_IDS.sam, SEED_IDS.lena, SEED_IDS.omar, SEED_IDS.priya, SEED_IDS.theo,
    ].map((id) => client.asUser(id))
    expect(await code(omar!.joinQueue())).toBe('free_slot_available')
    await maya!.claimSlot(1, 'editing', 60)
    await jun!.claimSlot(2, 'designing', 60)
    await sam!.claimSlot(3, 'motion', 60)
    await lena!.claimSlot(4, 'editing', 60, 'L1')
    await omar!.joinQueue()
    clock.advance(1)
    await priya!.joinQueue()

    await maya!.releaseSlot(1)
    let slot1 = client.peek().slots[0]!
    expect(slot1.hold_user_id).toBe(SEED_IDS.omar)
    expect(Date.parse(slot1.hold_until!) - clock.now()).toBe(10 * MINUTE)
    expect(await code(theo!.claimSlot(1, 'editing', 30))).toBe('slot_held')

    clock.advance(10)
    client.tick()
    const snap = client.peek()
    slot1 = snap.slots[0]!
    expect(slot1.hold_user_id).toBe(SEED_IDS.priya)
    expect(snap.queue.map((q) => q.user_id)).toEqual([SEED_IDS.priya])
    expect(snap.activity.some((a) => a.action === 'hold_expired')).toBe(true)

    await priya!.claimSlot(1, 'motion', 45)
    expect(client.peek().queue).toHaveLength(0)
  })

  it('render lock: knock and break blocked; render completes to editing', async () => {
    const { client, clock } = emptyBoard()
    const jun = client.asUser(SEED_IDS.jun)
    await jun.claimSlot(2, 'designing', 120)
    expect(await code(jun.setStatus(2, 'rendering'))).toBe('invalid_render_eta')
    await jun.setStatus(2, 'rendering', toIso(clock.now() + 20 * MINUTE))
    expect(await code(client.asUser(SEED_IDS.sam).knock(2))).toBe('render_locked')
    expect(await code(jun.startBreak(2))).toBe('render_locked')
    clock.advance(21)
    client.tick()
    const slot = client.peek().slots[1]!
    expect(slot.status).toBe('editing')
    expect(slot.render_eta).toBeNull()
  })

  it('knock limit: 1 per user per slot every 2 minutes', async () => {
    const { client, clock } = emptyBoard()
    await client.asUser(SEED_IDS.maya).claimSlot(1, 'editing', 60)
    const sam = client.asUser(SEED_IDS.sam)
    expect(await code(sam.knock(1))).toBe('ok')
    expect(await code(sam.knock(1))).toBe('knock_rate_limited')
    expect(await code(client.asUser(SEED_IDS.jun).knock(1))).toBe('ok')
    clock.advance(2)
    expect(await code(sam.knock(1))).toBe('ok')
    expect(await code(client.asUser(SEED_IDS.maya).knock(1))).toBe('cannot_knock_self')
  })

  it('break keeps the seat; overdue never auto-kicks and is flagged once', async () => {
    const { client, clock } = emptyBoard()
    const maya = client.asUser(SEED_IDS.maya)
    await maya.claimSlot(1, 'editing', 30)
    await maya.startBreak(1)
    expect(await code(maya.setStatus(1, 'designing'))).toBe('on_break')
    clock.advance(40)
    client.tick()
    client.tick()
    let snap = client.peek()
    expect(snap.slots[0]!.user_id).toBe(SEED_IDS.maya)
    expect(snap.activity.filter((a) => a.action === 'overdue')).toHaveLength(1)
    await maya.endBreak(1)
    snap = client.peek()
    expect(snap.slots[0]!.status).toBe('editing')
  })

  it('only admins can force-release; releasing hands the seat to the queue', async () => {
    const client = new MockStudioClient({ clock: new ManualClock() })
    expect(await code(client.asUser(SEED_IDS.maya).adminForceRelease(3))).toBe('not_authorized')
    expect(await code(client.asUser(SEED_IDS.maya).releaseSlot(3))).toBe('not_your_slot')
    await client.asUser(SEED_IDS.admin).adminForceRelease(3)
    expect(client.peek().slots[2]!.hold_user_id).toBe(SEED_IDS.theo)
  })

  it("device names are unique: cannot save a colleague's, but can claim at their PC", async () => {
    const { client } = emptyBoard()
    const lena = client.asUser(SEED_IDS.lena)
    expect(await code(lena.setMyDevice('c1'))).toBe('device_taken') // Maya's C1
    await lena.claimSlot(1, 'editing', 60, 'C1')
    expect(client.peek().slots[0]!.device_name).toBe('C1')
    expect(client.peek().profiles.find((p) => p.id === SEED_IDS.lena)!.device_name).toBe('H7')
  })

  it('admin delete: frees the seat, keeps history unattributed; not self, not non-admins', async () => {
    const { client } = emptyBoard()
    const admin = client.asUser(SEED_IDS.admin)
    await client.asUser(SEED_IDS.maya).claimSlot(1, 'editing', 60)
    expect(await code(client.asUser(SEED_IDS.jun).adminDeleteUser(SEED_IDS.maya))).toBe('not_authorized')
    expect(await code(admin.adminDeleteUser(SEED_IDS.admin))).toBe('cannot_modify_self')
    await admin.adminDeleteUser(SEED_IDS.maya)
    const snap = client.peek()
    expect(snap.profiles.some((p) => p.id === SEED_IDS.maya)).toBe(false)
    expect(snap.slots[0]!.user_id).toBeNull()
    expect(snap.activity.some((a) => a.user_id === SEED_IDS.maya)).toBe(false)
    expect(snap.activity[0]!.action).toBe('user_deleted')
    expect(await code(admin.adminDeleteUser(SEED_IDS.maya))).toBe('user_not_found')
  })

  it('admin settings and account names are validated', async () => {
    const { client } = emptyBoard()
    const admin = client.asUser(SEED_IDS.admin)
    expect(await code(client.asUser(SEED_IDS.maya).adminUpdateSettings({ holdMinutes: 5 }))).toBe('not_authorized')
    expect(await code(admin.adminUpdateSettings({ maxSessionMin: 5 }))).toBe('invalid_input')
    await admin.adminUpdateSettings({ maxSessionMin: 120, holdMinutes: 15 })
    expect(client.peek().settings).toMatchObject({ max_session_min: 120, hold_minutes: 15 })
    expect(await code(admin.adminUpdateAccount(1, '   '))).toBe('invalid_input')
    await admin.adminUpdateAccount(1, 'Studio A')
    expect(client.peek().accounts[0]!.label).toBe('Studio A')
  })

  it('Adobe device names: required, remembered, unique per account, correctable by holder or admin', async () => {
    // An account from before device names existed (no device on the profile).
    const { client } = emptyBoard([SEED_IDS.lena])
    const lena = client.asUser(SEED_IDS.lena)
    expect(await code(lena.claimSlot(1, 'editing', 30))).toBe('device_required')
    expect(await code(lena.claimSlot(1, 'editing', 30, '<bad>'))).toBe('invalid_device')
    await lena.claimSlot(1, 'editing', 30, ' L1 ')
    let snap = client.peek()
    expect(snap.slots[0]!.device_name).toBe('L1')
    expect(snap.profiles.find((p) => p.id === SEED_IDS.lena)!.device_name).toBe('L1')

    // Maya's remembered device is used by default; the same device can't take two seats on one account
    await client.asUser(SEED_IDS.maya).claimSlot(2, 'editing', 30)
    expect(client.peek().slots[1]!.device_name).toBe('C1')
    expect(await code(client.asUser(SEED_IDS.jun).claimSlot(3, 'designing', 30, 'c1'))).toBe('ok') // account 2: fine
    expect(await code(lena.setSlotDevice(1, 'C1'))).toBe('device_in_use')

    expect(await code(client.asUser(SEED_IDS.sam).setSlotDevice(1, 'X9'))).toBe('not_your_slot')
    expect(await code(client.asUser(SEED_IDS.admin).setSlotDevice(1, 'X9'))).toBe('ok')
    await lena.releaseSlot(1)
    snap = client.peek()
    expect(snap.slots[0]!.device_name).toBeNull()
  })

  it('extending an overdue slot counts from now and is capped at max session', async () => {
    const { client, clock } = emptyBoard()
    const maya = client.asUser(SEED_IDS.maya)
    await maya.claimSlot(1, 'editing', 30)
    clock.advance(45)
    const s = await maya.extendSlot(1, 30)
    expect(Date.parse(s.expected_until!) - clock.now()).toBe(30 * MINUTE)
    const capped = await maya.extendSlot(1, 240)
    expect(Date.parse(capped.expected_until!) - clock.now()).toBe(240 * MINUTE)
  })
})
