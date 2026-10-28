import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import {
  StudioError,
  type Slot,
  type SlotStatus,
  type Snapshot,
  type StudioClient,
  type StudioErrorCode,
} from './types'

const ACTIVITY_LIMIT = 50
const KNOWN_CODES = new Set<string>([
  'not_authorized', 'slot_not_found', 'slot_taken', 'slot_held', 'already_seated',
  'already_queued', 'already_reserved', 'free_slot_available', 'not_your_slot',
  'invalid_minutes', 'invalid_status', 'invalid_render_eta', 'on_break', 'not_on_break',
  'render_locked', 'slot_free', 'cannot_knock_self', 'knock_rate_limited',
  'user_not_found', 'cannot_modify_self',
])

function toStudioError(error: PostgrestError): StudioError {
  const code = KNOWN_CODES.has(error.message) ? (error.message as StudioErrorCode) : 'unknown'
  return new StudioError(code, error.message)
}

/** StudioClient backed by the phase 1 RPCs and Supabase Realtime. */
export class SupabaseStudioClient implements StudioClient {
  readonly kind = 'supabase' as const
  private readonly db: SupabaseClient<Database>
  private userId: string | null = null

  constructor(db: SupabaseClient<Database>) {
    this.db = db
    void db.auth.getSession().then(({ data }) => {
      this.userId = data.session?.user.id ?? null
    })
    db.auth.onAuthStateChange((_event, session) => {
      this.userId = session?.user.id ?? null
    })
  }

  now() {
    return Date.now()
  }

  currentUserId() {
    return this.userId
  }

  async getSnapshot(): Promise<Snapshot> {
    const [profiles, accounts, slots, queue, activity, settings] = await Promise.all([
      this.db.from('profiles').select('*').order('name'),
      this.db.from('accounts').select('*').order('id'),
      this.db.from('slots').select('*').order('account_id').order('slot_number'),
      this.db.from('queue').select('*').order('joined_at').order('id'),
      this.db.from('activity_log').select('*').order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
      this.db.from('settings').select('*').single(),
    ])
    for (const r of [profiles, accounts, slots, queue, activity, settings]) {
      if (r.error) throw toStudioError(r.error)
    }
    return {
      profiles: profiles.data ?? [],
      accounts: accounts.data ?? [],
      slots: slots.data ?? [],
      queue: queue.data ?? [],
      activity: activity.data ?? [],
      settings: settings.data!,
    }
  }

  /**
   * Any change to slots/queue/activity triggers a debounced refetch of the whole
   * board (it is tiny). Reconnects and tab wake-ups also refetch.
   */
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

    const channel = this.db
      .channel('studio-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, refetch)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetch()
      })

    const onWake = () => document.visibilityState === 'visible' && refetch()
    window.addEventListener('online', refetch)
    document.addEventListener('visibilitychange', onWake)

    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      window.removeEventListener('online', refetch)
      document.removeEventListener('visibilitychange', onWake)
      void this.db.removeChannel(channel)
    }
  }

  private async rpc<T>(promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>): Promise<T> {
    const { data, error } = await promise
    if (error) throw toStudioError(error)
    return data as T
  }

  claimSlot(slotId: number, status: SlotStatus, minutes: number) {
    return this.rpc<Slot>(this.db.rpc('claim_slot', { p_slot_id: slotId, p_status: status, p_minutes: minutes }))
  }
  releaseSlot(slotId: number) {
    return this.rpc<void>(this.db.rpc('release_slot', { p_slot_id: slotId }))
  }
  adminForceRelease(slotId: number) {
    return this.rpc<void>(this.db.rpc('admin_force_release', { p_slot_id: slotId }))
  }
  extendSlot(slotId: number, minutes: number) {
    return this.rpc<Slot>(this.db.rpc('extend_slot', { p_slot_id: slotId, p_minutes: minutes }))
  }
  setStatus(slotId: number, status: SlotStatus, renderEta?: string | null) {
    return this.rpc<Slot>(
      this.db.rpc('set_status', { p_slot_id: slotId, p_status: status, p_render_eta: renderEta ?? null }),
    )
  }
  startBreak(slotId: number) {
    return this.rpc<Slot>(this.db.rpc('start_break', { p_slot_id: slotId }))
  }
  endBreak(slotId: number) {
    return this.rpc<Slot>(this.db.rpc('end_break', { p_slot_id: slotId }))
  }
  joinQueue() {
    return this.rpc<void>(this.db.rpc('join_queue'))
  }
  leaveQueue() {
    return this.rpc<void>(this.db.rpc('leave_queue'))
  }
  knock(slotId: number) {
    return this.rpc<void>(this.db.rpc('knock', { p_slot_id: slotId }))
  }
}
