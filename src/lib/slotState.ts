import type { Slot } from '../data/types'
import { toMs } from './format'

export type SlotKind = 'free' | 'reserved' | 'in_use' | 'rendering' | 'break' | 'overdue'

export interface SlotView {
  kind: SlotKind
  /** Past expected_until (or past break_until while on break). Never auto-kicked. */
  overdue: boolean
  elapsedMs: number
  /** Until expected_until. Negative when overdue. */
  remainingMs: number
  /** Session progress 0..1. */
  progress: number
  holdRemainingMs: number | null
  renderRemainingMs: number | null
  breakRemainingMs: number | null
}

/** Visual/logic state of a slot at `now`. Pure: derived only from timestamps. */
export function deriveSlotView(slot: Slot, now: number): SlotView {
  const claimed = toMs(slot.claimed_at)
  const expected = toMs(slot.expected_until)
  const holdUntil = toMs(slot.hold_until)
  const renderEta = toMs(slot.render_eta)
  const breakUntil = toMs(slot.break_until)

  if (!slot.user_id || claimed === null || expected === null) {
    const held = slot.hold_user_id !== null && holdUntil !== null && holdUntil > now
    return {
      kind: held ? 'reserved' : 'free',
      overdue: false,
      elapsedMs: 0,
      remainingMs: 0,
      progress: 0,
      holdRemainingMs: held ? holdUntil - now : null,
      renderRemainingMs: null,
      breakRemainingMs: null,
    }
  }

  const total = Math.max(expected - claimed, 1)
  const elapsedMs = Math.max(now - claimed, 0)
  const remainingMs = expected - now
  const breakOver = slot.status === 'break' && breakUntil !== null && now >= breakUntil
  const overdue = remainingMs <= 0 || breakOver

  let kind: SlotKind
  if (slot.status === 'rendering') kind = 'rendering'
  else if (overdue) kind = 'overdue'
  else if (slot.status === 'break') kind = 'break'
  else kind = 'in_use'

  return {
    kind,
    overdue,
    elapsedMs,
    remainingMs,
    progress: Math.min(Math.max(elapsedMs / total, 0), 1),
    holdRemainingMs: null,
    renderRemainingMs: renderEta !== null ? renderEta - now : null,
    breakRemainingMs: breakUntil !== null ? breakUntil - now : null,
  }
}
