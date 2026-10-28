import type { SlotStatus, WorkRole } from '../data/types'
import type { IconName } from '../ui/PixelIcon'

export const STATUS_META: Record<SlotStatus, { label: string; icon: IconName; color: string }> = {
  designing: { label: 'Designing', icon: 'brush', color: '#e58f4b' },
  editing: { label: 'Editing', icon: 'clapper', color: '#5b8def' },
  color_grading: { label: 'Color grading', icon: 'palette', color: '#c75b9b' },
  motion: { label: 'Motion', icon: 'sparkle', color: '#8e6cd1' },
  rendering: { label: 'Rendering', icon: 'hourglass', color: '#2bb3a3' },
  break: { label: 'On break', icon: 'mug', color: '#b08354' },
}

/** Statuses a user can pick directly (break has its own action). */
export const SELECTABLE_STATUSES: SlotStatus[] = [
  'designing',
  'editing',
  'color_grading',
  'motion',
  'rendering',
]

/** Statuses allowed when claiming (the server rejects break and rendering). */
export const CLAIM_STATUSES: SlotStatus[] = ['designing', 'editing', 'color_grading', 'motion']

export const DEFAULT_STATUS_FOR_ROLE: Record<WorkRole, SlotStatus> = {
  editor: 'editing',
  designer: 'designing',
  motion: 'motion',
}

export const STATE_COLORS = {
  free: '#4caf7a',
  reserved: '#e2b33c',
  rendering: '#2bb3a3',
  overdue: '#e0524f',
} as const

export const ERROR_TEXT: Record<string, string> = {
  not_authorized: 'You are not allowed to do that.',
  slot_not_found: 'That slot no longer exists.',
  slot_taken: 'Someone just took that slot.',
  slot_held: 'That slot is reserved for someone in the waiting list.',
  already_seated: 'You already hold a slot.',
  already_queued: 'You are already in the waiting list.',
  already_reserved: 'A slot is already reserved for you.',
  free_slot_available: 'A slot is free right now, claim it instead.',
  not_your_slot: 'That is not your slot.',
  invalid_minutes: 'That duration is not allowed.',
  invalid_status: 'That status is not allowed here.',
  invalid_render_eta: 'Render ETA must be in the future (max 24 h).',
  on_break: 'End your break first.',
  not_on_break: 'You are not on a break.',
  render_locked: 'Render in progress: this slot is locked.',
  slot_free: 'That slot is free.',
  cannot_knock_self: 'You cannot knock on your own slot.',
  knock_rate_limited: 'You knocked recently. Wait 2 minutes between knocks.',
  rate_limited: 'Too many actions in a minute. Slow down and try again shortly.',
  user_not_found: 'User not found.',
  cannot_modify_self: 'You cannot demote or deactivate yourself.',
  unknown: 'Something went wrong.',
}
