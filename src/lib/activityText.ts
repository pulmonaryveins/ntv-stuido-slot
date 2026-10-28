import type { ActivityEntry, SlotStatus, Snapshot } from '../data/types'
import { nameOf } from './availability'
import { STATUS_META } from './status'
import type { IconName } from '../ui/PixelIcon'

type Meta = {
  target_user_id?: string
  status?: SlotStatus
  to?: SlotStatus
  minutes?: number
  reason?: string
}

export function slotLabel(snapshot: Snapshot, slotId: number | null): string {
  const slot = snapshot.slots.find((s) => s.id === slotId)
  if (!slot) return 'a slot'
  const account = snapshot.accounts.find((a) => a.id === slot.account_id)
  return `${account?.label ?? 'Account'} · ${slot.slot_number}`
}

/** One-line human description of an activity entry. */
export function describeActivity(e: ActivityEntry, snapshot: Snapshot): { icon: IconName; text: string } {
  const m = (e.meta ?? {}) as Meta
  const who = e.user_id ? nameOf(snapshot, e.user_id) : 'System'
  const target = nameOf(snapshot, m.target_user_id)
  const where = slotLabel(snapshot, e.slot_id)
  switch (e.action) {
    case 'claim':
      return { icon: 'block', text: `${who} claimed ${where}${m.status ? ` (${STATUS_META[m.status].label})` : ''}` }
    case 'release':
      return { icon: 'door', text: `${who} released ${where}` }
    case 'force_release':
      return { icon: 'warn', text: `${who} force-released ${target} from ${where}${m.reason ? ` (${m.reason})` : ''}` }
    case 'extend':
      return { icon: 'clock', text: `${who} extended ${where} by ${m.minutes ?? '?'} min` }
    case 'status':
      return { icon: m.to ? STATUS_META[m.to].icon : 'clock', text: `${who} is now ${m.to ? STATUS_META[m.to].label.toLowerCase() : 'busy'} on ${where}` }
    case 'break_start':
      return { icon: 'mug', text: `${who} took a break` }
    case 'break_end':
      return { icon: 'sparkle', text: `${who} is back from break` }
    case 'queue_join':
      return { icon: 'ticket', text: `${who} joined the waiting list` }
    case 'queue_leave':
      return { icon: 'door', text: `${who} left the waiting list` }
    case 'queue_remove':
      return { icon: 'shield', text: `${who} removed ${target} from the waiting list` }
    case 'hold_granted':
      return { icon: 'ticket', text: `${where} reserved for ${target}` }
    case 'hold_expired':
      return { icon: 'hourglass', text: `${target}'s reservation on ${where} expired` }
    case 'knock':
      return { icon: 'door', text: `${who} knocked on ${target}'s door (${where})` }
    case 'render_done':
      return { icon: 'sparkle', text: `${target}'s render finished on ${where}` }
    case 'user_registered':
      return { icon: 'user', text: `${who === 'Someone' ? 'A new user' : who} registered${(e.meta as { pending?: boolean })?.pending ? ' (waiting for approval)' : ''}` }
    case 'profile_update':
      return { icon: 'shield', text: `${who} updated ${target}'s account` }
    case 'overdue':
      return { icon: 'warn', text: `${target} is over time on ${where}` }
    default:
      return { icon: 'clock', text: `${who}: ${e.action.replace(/_/g, ' ')}` }
  }
}
