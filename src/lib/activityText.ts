import type { ActivityEntry, SlotStatus, Snapshot } from '../data/types'
import { nameOf } from './availability'
import type { IconName } from '../ui/PixelIcon'

type Meta = {
  target_user_id?: string
  status?: SlotStatus
  to?: SlotStatus
  minutes?: number
  device_name?: string | null
  from?: string | null
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
      return { icon: 'block', text: `${who} claimed ${where}${m.device_name ? ` on ${m.device_name}` : ''}` }
    case 'device_change':
      return { icon: 'clock', text: `${who} set ${target}'s device on ${where} to ${(e.meta as { to?: string }).to ?? '?'}` }
    case 'release':
      return { icon: 'door', text: `${who} ended their session on ${where}` }
    case 'force_release':
      return { icon: 'warn', text: `${who} ended ${target}'s session on ${where}${m.reason ? ` (${m.reason})` : ''}` }
    case 'extend':
      return { icon: 'clock', text: `${who} extended ${where} by ${m.minutes ?? '?'} min` }
    case 'status':
      return { icon: 'clock', text: `${who} updated ${where}` }
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
    case 'user_deleted':
      return { icon: 'warn', text: `${who} deleted ${(e.meta as { name?: string })?.name ?? 'a user'}` }
    case 'account_update':
      return { icon: 'shield', text: `${who} renamed an Adobe account to ${(e.meta as { label?: string })?.label ?? '?'}` }
    case 'settings_update':
      return { icon: 'shield', text: `${who} changed the session rules` }
    case 'overdue':
      return { icon: 'warn', text: `${target} is over time on ${where}` }
    default:
      return { icon: 'clock', text: `${who}: ${e.action.replace(/_/g, ' ')}` }
  }
}
