import { KNOCK_COOLDOWN_MS, type Slot, type Snapshot } from '../data/types'
import { formatDuration, toMs } from './format'

/** null = allowed, string = visible reason it is disabled. */
export type Gate = string | null

export interface Viewer {
  userId: string | null
  isAdmin: boolean
  mySlot: Slot | null
  myHold: Slot | null
  queued: boolean
}

export function buildViewer(snapshot: Snapshot, userId: string | null): Viewer {
  const me = snapshot.profiles.find((p) => p.id === userId)
  return {
    userId,
    isAdmin: me?.role === 'admin' && me.active,
    mySlot: snapshot.slots.find((s) => s.user_id === userId && userId !== null) ?? null,
    myHold: snapshot.slots.find((s) => s.hold_user_id === userId && userId !== null) ?? null,
    queued: snapshot.queue.some((q) => q.user_id === userId),
  }
}

export function nameOf(snapshot: Snapshot, userId: string | null | undefined): string {
  if (!userId) return 'Someone'
  return snapshot.profiles.find((p) => p.id === userId)?.name ?? 'Someone'
}

/** ms timestamp of the viewer's last knock on this slot within the cooldown, if any. */
export function lastKnockAt(snapshot: Snapshot, userId: string | null, slotId: number, now: number) {
  if (!userId) return null
  for (const e of snapshot.activity) {
    if (e.action !== 'knock' || e.user_id !== userId || e.slot_id !== slotId) continue
    const t = toMs(e.created_at)
    if (t !== null && now - t < KNOCK_COOLDOWN_MS) return t
  }
  return null
}

export interface SlotGates {
  /** Owner controls are only shown on your own slot. */
  isMine: boolean
  claim: Gate
  release: Gate
  extend: Gate
  status: Gate
  startBreak: Gate
  endBreak: Gate
  knock: Gate | 'hidden'
  forceRelease: Gate | 'hidden'
}

/** Client-side mirror of the server rules, used to show disabled states with reasons. */
export function slotGates(slot: Slot, viewer: Viewer, snapshot: Snapshot, now: number): SlotGates {
  const isMine = !!viewer.userId && slot.user_id === viewer.userId
  const occupied = !!slot.user_id
  const heldForOther = !!slot.hold_user_id && slot.hold_user_id !== viewer.userId
  const rendering = slot.status === 'rendering'
  const onBreak = slot.status === 'break'

  let claim: Gate = null
  if (!viewer.userId) claim = 'Pick a user first'
  else if (occupied) claim = isMine ? 'This is your slot' : 'Slot in use'
  else if (heldForOther) claim = `Reserved for ${nameOf(snapshot, slot.hold_user_id)}`
  else if (viewer.mySlot) claim = 'You already hold a slot'

  const notMine = isMine ? null : 'Not your slot'

  let knock: Gate | 'hidden' = 'hidden'
  if (occupied && !isMine && viewer.userId) {
    const last = lastKnockAt(snapshot, viewer.userId, slot.id, now)
    if (rendering) knock = 'Render in progress, knock disabled'
    else if (last !== null)
      knock = `Knocked recently, wait ${formatDuration(KNOCK_COOLDOWN_MS - (now - last))}`
    else knock = null
  }

  return {
    isMine,
    claim,
    release: notMine,
    extend: notMine,
    status: notMine ?? (onBreak ? 'End your break first' : null),
    startBreak: notMine ?? (rendering ? 'Render in progress' : onBreak ? 'Already on break' : null),
    endBreak: notMine ?? (onBreak ? null : 'Not on break'),
    knock,
    forceRelease: viewer.isAdmin && occupied ? null : 'hidden',
  }
}

export interface QueueGates {
  join: Gate
  leave: Gate
}

export function queueGates(viewer: Viewer, snapshot: Snapshot): QueueGates {
  let join: Gate = null
  if (!viewer.userId) join = 'Pick a user first'
  else if (viewer.mySlot) join = 'You already hold a slot'
  else if (viewer.myHold) join = 'A slot is reserved for you, claim it'
  else if (viewer.queued) join = 'You are in the waiting list'
  else if (snapshot.slots.some((s) => !s.user_id && !s.hold_user_id))
    join = 'A slot is free, claim it instead'
  return { join, leave: viewer.queued ? null : 'You are not in the waiting list' }
}
