import type { Account, ActivityEntry, Profile, QueueEntry, Settings, Slot } from './types'
import { MINUTE, toIso } from '../lib/format'

// Same users as supabase/seed.sql.
export const SEED_IDS = {
  admin: '00000000-0000-4000-a000-000000000001',
  maya: '00000000-0000-4000-a000-000000000002',
  jun: '00000000-0000-4000-a000-000000000003',
  sam: '00000000-0000-4000-a000-000000000004',
  lena: '00000000-0000-4000-a000-000000000005',
  omar: '00000000-0000-4000-a000-000000000006',
  priya: '00000000-0000-4000-a000-000000000007',
  theo: '00000000-0000-4000-a000-000000000008',
  kai: '00000000-0000-4000-a000-000000000009',
  rosa: '00000000-0000-4000-a000-00000000000a',
  ivan: '00000000-0000-4000-a000-00000000000b',
} as const

const P = (
  id: string,
  name: string,
  role: Profile['role'],
  work_role: Profile['work_role'],
  avatar_color: string,
  device_name: string | null,
): Profile => ({ id, name, role, work_role, active: true, avatar_color, device_name, created_at: '2026-10-01T09:00:00.000Z' })

export const SEED_PROFILES: Profile[] = [
  // Device names (Windows hostnames) as Adobe's activated-devices page shows them.
  P(SEED_IDS.admin, 'Avery Admin', 'admin', 'designer', '#e07a5f', 'ADMIN-PC'),
  P(SEED_IDS.maya, 'Maya Ortiz', 'user', 'editor', '#3d9970', 'C1'),
  P(SEED_IDS.jun, 'Jun Park', 'user', 'designer', '#f2a541', 'D4'),
  P(SEED_IDS.sam, 'Sam Rivera', 'user', 'motion', '#5b8def', 'F3'),
  P(SEED_IDS.lena, 'Lena Novak', 'user', 'editor', '#c75b9b', 'H7'),
  P(SEED_IDS.omar, 'Omar Haddad', 'user', 'designer', '#2bb3a3', 'A2'),
  P(SEED_IDS.priya, 'Priya Shah', 'user', 'motion', '#8e6cd1', 'B3'),
  P(SEED_IDS.theo, 'Theo Laurent', 'user', 'editor', '#d9534f', 'E5'),
  P(SEED_IDS.kai, 'Kai Mendes', 'user', 'designer', '#6c9a3b', 'DESIGN-07'),
  P(SEED_IDS.rosa, 'Rosa Kim', 'user', 'editor', '#e8a87c', 'EDIT-02'),
  P(SEED_IDS.ivan, 'Ivan Petrov', 'user', 'motion', '#4a7c9b', 'MOTION-01'),
]

export const SEED_ACCOUNTS: Account[] = [
  { id: 1, label: 'Account 1' },
  { id: 2, label: 'Account 2' },
]

export const SEED_SETTINGS: Settings = {
  id: true,
  max_session_min: 240,
  hold_minutes: 10,
  break_minutes: 15,
}

export interface SeedState {
  profiles: Profile[]
  accounts: Account[]
  slots: Slot[]
  queue: QueueEntry[]
  activity: ActivityEntry[]
  settings: Settings
}

function emptySlot(id: number, account_id: number, slot_number: number): Slot {
  return {
    id,
    account_id,
    slot_number,
    user_id: null,
    status: null,
    claimed_at: null,
    expected_until: null,
    render_eta: null,
    hold_user_id: null,
    hold_until: null,
    prev_status: null,
    break_until: null,
    device_name: null,
  }
}

/**
 * Believable starting board relative to `now`: one editing, one rendering (ETA ~28m),
 * one overdue, one color grading, two people waiting.
 */
export function createSeedState(now: number): SeedState {
  const at = (min: number) => toIso(now + min * MINUTE)
  const seat = (s: Slot, user: string, status: Slot['status'], claimedMin: number, untilMin: number): Slot => ({
    ...s,
    user_id: user,
    status,
    claimed_at: at(claimedMin),
    expected_until: at(untilMin),
    device_name: SEED_PROFILES.find((p) => p.id === user)?.device_name ?? null,
  })

  const slots: Slot[] = [
    seat(emptySlot(1, 1, 1), SEED_IDS.maya, 'editing', -70, 50),
    { ...seat(emptySlot(2, 1, 2), SEED_IDS.jun, 'rendering', -115, 35), render_eta: at(28) },
    seat(emptySlot(3, 2, 1), SEED_IDS.omar, 'designing', -132, -12),
    seat(emptySlot(4, 2, 2), SEED_IDS.priya, 'color_grading', -40, 80),
  ]

  const queue: QueueEntry[] = [
    { id: 1, user_id: SEED_IDS.theo, joined_at: at(-15) },
    { id: 2, user_id: SEED_IDS.rosa, joined_at: at(-8) },
  ]

  let id = 0
  const log = (min: number, slot_id: number | null, user_id: string | null, action: string, meta = {}) =>
    ({ id: ++id, slot_id, user_id, action, meta, created_at: at(min) }) as ActivityEntry
  const activity: ActivityEntry[] = [
    log(-132, 3, SEED_IDS.omar, 'claim', { status: 'designing' }),
    log(-115, 2, SEED_IDS.jun, 'claim', { status: 'designing' }),
    log(-70, 1, SEED_IDS.maya, 'claim', { status: 'editing' }),
    log(-40, 4, SEED_IDS.priya, 'claim', { status: 'color_grading' }),
    log(-31, 2, SEED_IDS.jun, 'status', { from: 'designing', to: 'rendering', render_eta: at(28) }),
    log(-15, null, SEED_IDS.theo, 'queue_join'),
    log(-12, 3, null, 'overdue', { target_user_id: SEED_IDS.omar, expected_until: at(-12) }),
    log(-8, null, SEED_IDS.rosa, 'queue_join'),
  ].reverse()

  return {
    profiles: SEED_PROFILES.map((p) => ({ ...p })),
    accounts: SEED_ACCOUNTS.map((a) => ({ ...a })),
    slots,
    queue,
    activity,
    settings: { ...SEED_SETTINGS },
  }
}
