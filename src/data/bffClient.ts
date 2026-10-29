import { ApiError, api } from '../lib/backend'
import {
  StudioError,
  type Account,
  type Profile,
  type Settings,
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
  private listeners = new Set<(s: Snapshot) => void>()
  private seq = 0
  private applied = 0

  /** Fetch the board and push it to subscribers; a slower, older response never overwrites a newer one. */
  private async pull(): Promise<void> {
    const mine = ++this.seq
    const snap = await this.getSnapshot()
    if (mine < this.applied) return
    this.applied = mine
    this.listeners.forEach((cb) => cb(snap))
  }

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
    this.listeners.add(callback)
    const refetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        this.pull().catch((e) => console.warn('[studio] refetch failed', e))
      }, 20)
    }

    const source = new EventSource('/api/stream', { withCredentials: true })
    source.addEventListener('ready', refetch)
    source.addEventListener('change', refetch)

    const onWake = () => document.visibilityState === 'visible' && refetch()
    window.addEventListener('online', refetch)
    document.addEventListener('visibilitychange', onWake)

    return () => {
      this.listeners.delete(callback)
      if (timer) clearTimeout(timer)
      source.close()
      window.removeEventListener('online', refetch)
      document.removeEventListener('visibilitychange', onWake)
    }
  }

  private async call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    try {
      const data = (await api<{ data: T }>(`rpc/${name}`, { body: args })).data
      // Show our own change right away; don't wait for the realtime event to come back round.
      this.pull().catch((e) => console.warn('[studio] refetch failed', e))
      return data
    } catch (e) {
      throw toStudioError(e)
    }
  }

  claimSlot(slotId: number, status: SlotStatus, minutes: number, deviceName?: string | null) {
    return this.call<Slot>('claim_slot', { p_slot_id: slotId, p_status: status, p_minutes: minutes, p_device_name: deviceName ?? null })
  }
  setSlotDevice(slotId: number, deviceName: string) {
    return this.call<Slot>('set_slot_device', { p_slot_id: slotId, p_device_name: deviceName })
  }
  setMyDevice(deviceName: string) {
    return this.call<Profile>('update_my_profile', { p_device_name: deviceName })
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
  adminDeleteUser(userId: string) {
    return this.call<void>('admin_delete_user', { p_user_id: userId })
  }
  adminUpdateAccount(accountId: number, label: string) {
    return this.call<Account>('admin_update_account', { p_account_id: accountId, p_label: label })
  }
  adminUpdateSettings(changes: { maxSessionMin?: number; holdMinutes?: number }) {
    return this.call<Settings>('admin_update_settings', {
      p_max_session_min: changes.maxSessionMin ?? null,
      p_hold_minutes: changes.holdMinutes ?? null,
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
