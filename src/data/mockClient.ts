import {
  KNOCK_COOLDOWN_MS,
  StudioError,
  type ActivityEntry,
  type Slot,
  type SlotStatus,
  type Snapshot,
  type StudioActions,
  type StudioClient,
  type StudioErrorCode,
} from './types'
import type { Json } from '../types/database'
import { createSeedState, SEED_IDS, type SeedState } from './seed'
import { MINUTE, toIso, toMs } from '../lib/format'


/** Mock time source. Speed multiplies how fast mock time runs vs. real time. */
export class MockClock {
  private baseReal: number
  private baseMock: number
  private _speed: number
  private readonly realNow: () => number

  constructor(speed = 1, realNow: () => number = Date.now) {
    this.realNow = realNow
    this.baseReal = realNow()
    this.baseMock = this.baseReal
    this._speed = speed
  }

  now(): number {
    return this.baseMock + (this.realNow() - this.baseReal) * this._speed
  }

  get speed() {
    return this._speed
  }

  setSpeed(speed: number) {
    this.baseMock = this.now()
    this.baseReal = this.realNow()
    this._speed = speed
  }
}

const fail = (code: StudioErrorCode): never => {
  throw new StudioError(code)
}

const ACTIVITY_CAP = 200

export interface MockClientOptions {
  clock?: { now(): number }
  /** Run the periodic job (pg_cron equivalent) on a real-time interval. */
  autoTick?: boolean
  actorId?: string | null
  seed?: (now: number) => SeedState
}

/**
 * In-memory StudioClient that follows the same rules as the SQL RPCs.
 * Every mutation is synchronous internally, so each call is atomic.
 */
export class MockStudioClient implements StudioClient {
  readonly kind = 'mock' as const
  readonly clock: { now(): number }
  private state: SeedState
  private actorId: string | null
  private listeners = new Set<(s: Snapshot) => void>()
  private nextActivityId: number
  private nextQueueId: number
  private overdueFlagged = new Set<string>()
  private timer: ReturnType<typeof setInterval> | null = null
  private version = 0

  constructor(opts: MockClientOptions = {}) {
    this.clock = opts.clock ?? new MockClock()
    this.state = (opts.seed ?? createSeedState)(this.clock.now())
    this.actorId = opts.actorId === undefined ? SEED_IDS.lena : opts.actorId
    this.nextActivityId = Math.max(0, ...this.state.activity.map((a) => a.id)) + 1
    this.nextQueueId = Math.max(0, ...this.state.queue.map((q) => q.id)) + 1
    for (const a of this.state.activity) {
      if (a.action === 'overdue' && a.slot_id !== null) {
        this.overdueFlagged.add(`${a.slot_id}|${(a.meta as { expected_until?: string }).expected_until}`)
      }
    }
    if (opts.autoTick) this.timer = setInterval(() => this.tick(), 500)
  }

  dispose() {
    if (this.timer) clearInterval(this.timer)
    this.listeners.clear()
  }

  // --- StudioClient ------------------------------------------------------

  now() {
    return this.clock.now()
  }

  currentUserId() {
    return this.actorId
  }

  setActor(userId: string | null) {
    this.actorId = userId
    this.emit()
  }

  async getSnapshot(): Promise<Snapshot> {
    return this.peek()
  }

  /** Synchronous snapshot copy (used by the demo simulator and tests). */
  peek(): Snapshot {
    return structuredClone({
      profiles: this.state.profiles,
      accounts: this.state.accounts,
      slots: this.state.slots,
      queue: this.state.queue,
      activity: this.state.activity,
      settings: this.state.settings,
    })
  }

  subscribe(callback: (s: Snapshot) => void) {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  /** Actions bound to an arbitrary user (simulated teammates, tests). */
  asUser(userId: string): StudioActions {
    const call = <T>(fn: () => T) => this.run(userId, fn)
    return {
      claimSlot: (id, status, minutes) => call(() => this.doClaim(userId, id, status, minutes)),
      releaseSlot: (id) => call(() => this.doRelease(userId, id)),
      adminForceRelease: (id) => call(() => this.doForceRelease(userId, id)),
      adminRemoveFromQueue: (uid) => call(() => this.doRemoveFromQueue(userId, uid)),
      extendSlot: (id, minutes) => call(() => this.doExtend(userId, id, minutes)),
      setStatus: (id, status, eta) => call(() => this.doSetStatus(userId, id, status, eta ?? null)),
      startBreak: (id) => call(() => this.doStartBreak(userId, id)),
      endBreak: (id) => call(() => this.doEndBreak(userId, id)),
      joinQueue: () => call(() => this.doJoinQueue(userId)),
      leaveQueue: () => call(() => this.doLeaveQueue(userId)),
      knock: (id) => call(() => this.doKnock(userId, id)),
    }
  }

  private me(): StudioActions {
    return this.asUser(this.actorId ?? '')
  }

  claimSlot(slotId: number, status: SlotStatus, minutes: number) {
    return this.me().claimSlot(slotId, status, minutes)
  }
  releaseSlot(slotId: number) {
    return this.me().releaseSlot(slotId)
  }
  adminForceRelease(slotId: number) {
    return this.me().adminForceRelease(slotId)
  }
  adminRemoveFromQueue(userId: string) {
    return this.me().adminRemoveFromQueue(userId)
  }
  extendSlot(slotId: number, minutes: number) {
    return this.me().extendSlot(slotId, minutes)
  }
  setStatus(slotId: number, status: SlotStatus, renderEta?: string | null) {
    return this.me().setStatus(slotId, status, renderEta)
  }
  startBreak(slotId: number) {
    return this.me().startBreak(slotId)
  }
  endBreak(slotId: number) {
    return this.me().endBreak(slotId)
  }
  joinQueue() {
    return this.me().joinQueue()
  }
  leaveQueue() {
    return this.me().leaveQueue()
  }
  knock(slotId: number) {
    return this.me().knock(slotId)
  }

  /** pg_cron equivalent: holds, finished renders, overdue flags. */
  tick() {
    const before = this.version
    const now = this.clock.now()
    this.reconcile(null)
    for (const s of this.state.slots) {
      const eta = toMs(s.render_eta)
      if (s.status === 'rendering' && eta !== null && eta <= now) {
        s.status = 'editing'
        s.render_eta = null
        this.log(s.id, null, 'render_done', { target_user_id: s.user_id })
      }
    }
    for (const s of this.state.slots) {
      const expected = toMs(s.expected_until)
      if (!s.user_id || expected === null || expected > now) continue
      const key = `${s.id}|${s.expected_until}`
      if (this.overdueFlagged.has(key)) continue
      this.overdueFlagged.add(key)
      this.log(s.id, null, 'overdue', { target_user_id: s.user_id, expected_until: s.expected_until })
    }
    if (this.version !== before) this.emit()
  }

  // --- internals ---------------------------------------------------------

  private run<T>(actor: string, fn: () => T): Promise<T> {
    const before = this.version
    try {
      this.requireActive(actor)
      this.reconcile(actor)
      const result = fn()
      this.reconcile(actor)
      this.emit()
      return Promise.resolve(structuredClone(result))
    } catch (e) {
      // SQL rolls a failed RPC back. Here every rule check runs before any mutation,
      // so only reconcile (idempotent, also run by tick) can have changed state.
      if (this.version !== before) this.emit()
      return Promise.reject(e instanceof StudioError ? e : new StudioError('unknown', String(e)))
    }
  }

  private emit() {
    const snap = this.peek()
    for (const l of this.listeners) l(snap)
  }

  private log(slotId: number | null, actor: string | null, action: string, meta: Record<string, Json | undefined> = {}) {
    const entry: ActivityEntry = {
      id: this.nextActivityId++,
      slot_id: slotId,
      user_id: actor,
      action,
      meta: meta as Json,
      created_at: toIso(this.clock.now()),
    }
    this.state.activity.unshift(entry)
    if (this.state.activity.length > ACTIVITY_CAP) this.state.activity.length = ACTIVITY_CAP
    this.version++
  }

  private profile(userId: string) {
    return this.state.profiles.find((p) => p.id === userId)
  }

  private requireActive(userId: string) {
    const p = this.profile(userId)
    if (!p || !p.active) fail('not_authorized')
  }

  private requireAdmin(userId: string) {
    const p = this.profile(userId)
    if (!p || !p.active || p.role !== 'admin') fail('not_authorized')
  }

  private slot(slotId: number): Slot {
    return this.state.slots.find((s) => s.id === slotId) ?? fail('slot_not_found')
  }

  private ownSlot(slotId: number, userId: string): Slot {
    const s = this.slot(slotId)
    if (s.user_id !== userId) fail('not_your_slot')
    return s
  }

  private checkMinutes(minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > this.state.settings.max_session_min) {
      fail('invalid_minutes')
    }
  }

  private freeSlot(s: Slot) {
    s.user_id = null
    s.status = null
    s.claimed_at = null
    s.expected_until = null
    s.render_eta = null
    s.prev_status = null
    s.break_until = null
    this.version++
  }

  private clearHold(s: Slot) {
    s.hold_user_id = null
    s.hold_until = null
    this.version++
  }

  private removeFromQueue(userId: string) {
    const before = this.state.queue.length
    this.state.queue = this.state.queue.filter((q) => q.user_id !== userId)
    if (this.state.queue.length !== before) this.version++
    return this.state.queue.length !== before
  }

  private orderedQueue() {
    return [...this.state.queue].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)
  }

  private assignHold(s: Slot, actor: string | null) {
    if (s.user_id || s.hold_user_id) return
    const next = this.orderedQueue().find(
      (q) => !this.state.slots.some((x) => x.hold_user_id === q.user_id || x.user_id === q.user_id),
    )
    if (!next) return
    const until = toIso(this.clock.now() + this.state.settings.hold_minutes * MINUTE)
    s.hold_user_id = next.user_id
    s.hold_until = until
    this.version++
    this.log(s.id, actor, 'hold_granted', { target_user_id: next.user_id, hold_until: until })
  }

  private reconcile(actor: string | null) {
    const now = this.clock.now()
    const slots = [...this.state.slots].sort((a, b) => a.id - b.id)
    for (const s of slots) {
      const until = toMs(s.hold_until)
      if (until === null || until > now) continue
      const holder = s.hold_user_id!
      this.clearHold(s)
      this.removeFromQueue(holder)
      this.log(s.id, null, 'hold_expired', { target_user_id: holder })
    }
    for (const s of slots) this.assignHold(s, actor)
  }

  private doClaim(uid: string, slotId: number, status: SlotStatus, minutes: number): Slot {
    if (!status || status === 'break' || status === 'rendering') fail('invalid_status')
    this.checkMinutes(minutes)
    const s = this.slot(slotId)
    if (s.user_id) fail('slot_taken')
    if (s.hold_user_id && s.hold_user_id !== uid) fail('slot_held')
    if (this.state.slots.some((x) => x.user_id === uid)) fail('already_seated')

    for (const x of this.state.slots) if (x.hold_user_id === uid && x.id !== slotId) this.clearHold(x)

    const now = this.clock.now()
    Object.assign(s, {
      user_id: uid,
      status,
      claimed_at: toIso(now),
      expected_until: toIso(now + minutes * MINUTE),
      render_eta: null,
      prev_status: null,
      break_until: null,
      hold_user_id: null,
      hold_until: null,
    })
    this.version++
    this.removeFromQueue(uid)
    this.log(slotId, uid, 'claim', { status, expected_until: s.expected_until })
    return s
  }

  private doRelease(uid: string, slotId: number) {
    this.freeSlot(this.ownSlot(slotId, uid))
    this.log(slotId, uid, 'release')
  }

  private doForceRelease(uid: string, slotId: number) {
    this.requireAdmin(uid)
    const s = this.slot(slotId)
    if (!s.user_id) fail('slot_free')
    const target = s.user_id
    const status = s.status
    this.freeSlot(s)
    this.log(slotId, uid, 'force_release', { target_user_id: target, status })
  }

  private doRemoveFromQueue(uid: string, target: string) {
    this.requireAdmin(uid)
    if (!this.removeFromQueue(target)) return
    for (const s of this.state.slots) if (s.hold_user_id === target) this.clearHold(s)
    this.log(null, uid, 'queue_remove', { target_user_id: target })
  }

  private doExtend(uid: string, slotId: number, minutes: number): Slot {
    this.checkMinutes(minutes)
    const s = this.ownSlot(slotId, uid)
    const now = this.clock.now()
    const max = now + this.state.settings.max_session_min * MINUTE
    const until = Math.min(Math.max(toMs(s.expected_until) ?? now, now) + minutes * MINUTE, max)
    s.expected_until = toIso(until)
    this.version++
    this.log(slotId, uid, 'extend', { minutes, expected_until: s.expected_until })
    return s
  }

  private doSetStatus(uid: string, slotId: number, status: SlotStatus, renderEta: string | null): Slot {
    if (!status || status === 'break') fail('invalid_status')
    const s = this.ownSlot(slotId, uid)
    if (s.status === 'break') fail('on_break')
    const now = this.clock.now()
    if (status === 'rendering') {
      const eta = toMs(renderEta)
      if (eta === null || eta <= now || eta > now + 24 * 60 * MINUTE) fail('invalid_render_eta')
    }
    const from = s.status
    s.status = status
    s.render_eta = status === 'rendering' ? toIso(toMs(renderEta)!) : null
    this.version++
    this.log(slotId, uid, 'status', { from, to: status, render_eta: s.render_eta })
    return s
  }

  private doStartBreak(uid: string, slotId: number): Slot {
    const s = this.ownSlot(slotId, uid)
    if (s.status === 'break') fail('on_break')
    if (s.status === 'rendering') fail('render_locked')
    s.prev_status = s.status
    s.status = 'break'
    s.break_until = toIso(this.clock.now() + this.state.settings.break_minutes * MINUTE)
    this.version++
    this.log(slotId, uid, 'break_start', { break_until: s.break_until })
    return s
  }

  private doEndBreak(uid: string, slotId: number): Slot {
    const s = this.ownSlot(slotId, uid)
    if (s.status !== 'break') fail('not_on_break')
    s.status = s.prev_status
    s.prev_status = null
    s.break_until = null
    this.version++
    this.log(slotId, uid, 'break_end', { status: s.status })
    return s
  }

  private doJoinQueue(uid: string) {
    if (this.state.slots.some((s) => s.user_id === uid)) fail('already_seated')
    if (this.state.slots.some((s) => s.hold_user_id === uid)) fail('already_reserved')
    if (this.state.queue.some((q) => q.user_id === uid)) fail('already_queued')
    if (this.state.slots.some((s) => !s.user_id && !s.hold_user_id)) fail('free_slot_available')
    this.state.queue.push({ id: this.nextQueueId++, user_id: uid, joined_at: toIso(this.clock.now()) })
    this.version++
    this.log(null, uid, 'queue_join')
  }

  private doLeaveQueue(uid: string) {
    if (!this.removeFromQueue(uid)) return
    for (const s of this.state.slots) if (s.hold_user_id === uid) this.clearHold(s)
    this.log(null, uid, 'queue_leave')
  }

  private doKnock(uid: string, slotId: number) {
    const s = this.slot(slotId)
    if (!s.user_id) fail('slot_free')
    if (s.user_id === uid) fail('cannot_knock_self')
    if (s.status === 'rendering') fail('render_locked')
    const now = this.clock.now()
    const recent = this.state.activity.some(
      (a) =>
        a.action === 'knock' &&
        a.user_id === uid &&
        a.slot_id === slotId &&
        now - (toMs(a.created_at) ?? 0) < KNOCK_COOLDOWN_MS,
    )
    if (recent) fail('knock_rate_limited')
    this.log(slotId, uid, 'knock', { target_user_id: s.user_id })
  }
}
