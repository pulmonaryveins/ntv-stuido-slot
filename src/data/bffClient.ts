import { ApiError, api } from '../lib/backend'
import {
  StudioError,
  type Profile,
  type Slot,
  type SlotStatus,
  type Snapshot,
  type StudioClient,
  type StudioErrorCode,
} from './types'

/**
 * StudioClient backed by the app's own BFF (/api). The browser never sees Supabase URLs,
 * keys or tokens: the session lives in an httpOnly cookie and live updates arrive as
 * Server-Sent Events from /api/stream.
 */
export class BffStudioClient implements StudioClient {
  readonly kind = 'supabase' as const
  private userId: string | null = null

  setUserId(id: string | null) {
    this.userId = id
  }

  now() {
    return Date.now()
  }

  currentUserId() {
    return this.userId
  }

  async getSnapshot(): Promise<Snapshot> {
    try {
      return await api<Snapshot>('board')
    } catch (e) {
      throw toStudioError(e)
    }
  }

  /** SSE `change` events trigger a debounced refetch; (re)connects and tab wake-ups refetch too. */
  subscribe(callback: (s: Snapshot) => void) {
    let timer: ReturnType<typeof setTimeout> | null = null
    let disposed = false
    const refetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        this.getSnapshot()
          .then((s) => !disposed && callback(s))
          .catch((e) => console.warn('[studio] refetch failed', e))
      }, 80)
    }

    const source = new EventSource('/api/stream', { withCredentials: true })
    source.addEventListener('ready', refetch)
    source.addEventListener('change', refetch)

    const onWake = () => document.visibilityState === 'visible' && refetch()
    window.addEventListener('online', refetch)
    document.addEventListener('visibilitychange', onWake)

    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      source.close()
      window.removeEventListener('online', refetch)
      document.removeEventListener('visibilitychange', onWake)
    }
  }

  private async call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    try {
      return (await api<{ data: T }>(`rpc/${name}`, { body: args })).data
    } catch (e) {
      throw toStudioError(e)
    }
  }

  claimSlot(slotId: number, status: SlotStatus, minutes: number) {
    return this.call<Slot>('claim_slot', { p_slot_id: slotId, p_status: status, p_minutes: minutes })
  }
  releaseSlot(slotId: number) {
    return this.call<void>('release_slot', { p_slot_id: slotId })
  }
  adminForceRelease(slotId: number) {
    return this.call<void>('admin_force_release', { p_slot_id: slotId })
  }
  adminRemoveFromQueue(userId: string) {
    return this.call<void>('admin_remove_from_queue', { p_user_id: userId })
  }
  adminUpdateProfile(userId: string, changes: { role?: Profile['role']; active?: boolean }) {
    return this.call<Profile>('admin_update_profile', {
      p_user_id: userId,
      p_role: changes.role ?? null,
      p_active: changes.active ?? null,
    })
  }
  extendSlot(slotId: number, minutes: number) {
    return this.call<Slot>('extend_slot', { p_slot_id: slotId, p_minutes: minutes })
  }
  setStatus(slotId: number, status: SlotStatus, renderEta?: string | null) {
    return this.call<Slot>('set_status', { p_slot_id: slotId, p_status: status, p_render_eta: renderEta ?? null })
  }
  startBreak(slotId: number) {
    return this.call<Slot>('start_break', { p_slot_id: slotId })
  }
  endBreak(slotId: number) {
    return this.call<Slot>('end_break', { p_slot_id: slotId })
  }
  joinQueue() {
    return this.call<void>('join_queue')
  }
  leaveQueue() {
    return this.call<void>('leave_queue')
  }
  knock(slotId: number) {
    return this.call<void>('knock', { p_slot_id: slotId })
  }
}

function toStudioError(e: unknown): StudioError {
  if (e instanceof ApiError) return new StudioError(e.code as StudioErrorCode, e.message)
  return new StudioError('unknown', String(e))
}
