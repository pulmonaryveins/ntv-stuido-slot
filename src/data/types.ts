import type { Enums, Tables } from '../types/database'

export type Profile = Tables<'profiles'>
export type Account = Tables<'accounts'>
export type Slot = Tables<'slots'>
export type QueueEntry = Tables<'queue'>
export type ActivityEntry = Tables<'activity_log'>
export type Settings = Tables<'settings'>
export type SlotStatus = Enums<'slot_status'>
export type WorkRole = Enums<'work_role'>

export interface Snapshot {
  profiles: Profile[]
  accounts: Account[]
  slots: Slot[]
  queue: QueueEntry[]
  /** Newest first. */
  activity: ActivityEntry[]
  settings: Settings
}

/** Error codes raised by the RPCs (see supabase/migrations/*_rpcs.sql). */
export type StudioErrorCode =
  | 'not_authorized'
  | 'slot_not_found'
  | 'slot_taken'
  | 'slot_held'
  | 'already_seated'
  | 'already_queued'
  | 'already_reserved'
  | 'free_slot_available'
  | 'not_your_slot'
  | 'invalid_minutes'
  | 'invalid_status'
  | 'invalid_render_eta'
  | 'on_break'
  | 'not_on_break'
  | 'render_locked'
  | 'slot_free'
  | 'cannot_knock_self'
  | 'knock_rate_limited'
  | 'device_required'
  | 'invalid_device'
  | 'device_in_use'
  | 'rate_limited'
  | 'user_not_found'
  | 'cannot_modify_self'
  | 'not_found'
  | 'device_taken'
  | 'invalid_input'
  | 'unknown'

export class StudioError extends Error {
  readonly code: StudioErrorCode
  constructor(code: StudioErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'StudioError'
    this.code = code
  }
}

/** The board RPCs, acting as the current user. */
export interface StudioActions {
  /** `deviceName` defaults to the user's remembered Adobe device name; a new one is remembered. */
  claimSlot(slotId: number, status: SlotStatus, minutes: number, deviceName?: string | null): Promise<Slot>
  /** Correct the Adobe device on an occupied seat (its user or an admin). */
  setSlotDevice(slotId: number, deviceName: string): Promise<Slot>
  /** Set the current user's remembered Adobe device name. */
  setMyDevice(deviceName: string): Promise<Profile>
  releaseSlot(slotId: number): Promise<void>
  adminForceRelease(slotId: number): Promise<void>
  adminRemoveFromQueue(userId: string): Promise<void>
  /** Approve/deactivate a user or change their role. Undefined fields stay unchanged. */
  adminUpdateProfile(userId: string, changes: { role?: Profile['role']; active?: boolean }): Promise<Profile>
  /** Permanently delete a user (frees their seat; activity history stays, unattributed). */
  adminDeleteUser(userId: string): Promise<void>
  adminUpdateAccount(accountId: number, label: string): Promise<Account>
  /** Undefined fields stay unchanged. */
  adminUpdateSettings(changes: { maxSessionMin?: number; holdMinutes?: number }): Promise<Settings>
  extendSlot(slotId: number, minutes: number): Promise<Slot>
  setStatus(slotId: number, status: SlotStatus, renderEta?: string | null): Promise<Slot>
  startBreak(slotId: number): Promise<Slot>
  endBreak(slotId: number): Promise<Slot>
  joinQueue(): Promise<void>
  leaveQueue(): Promise<void>
  knock(slotId: number): Promise<void>
}

export interface StudioClient extends StudioActions {
  readonly kind: 'mock' | 'supabase'
  getSnapshot(): Promise<Snapshot>
  /** Called with a fresh snapshot whenever the board changes. Returns unsubscribe. */
  subscribe(callback: (snapshot: Snapshot) => void): () => void
  /** Current time in ms. Mock clock for the mock client, wall clock otherwise. */
  now(): number
  currentUserId(): string | null
}

export const KNOCK_COOLDOWN_MS = 2 * 60_000
