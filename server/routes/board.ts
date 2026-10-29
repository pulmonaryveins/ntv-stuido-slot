import type { PostgrestError } from '@supabase/supabase-js'
import { fail, json, readJson } from '../http.js'
import type { StoredSession } from '../session.js'
import { userClient } from '../supabase.js'

const ACTIVITY_LIMIT = 200

/** Codes the RPCs raise (see supabase/migrations/*_rpcs.sql). Anything else becomes `unknown`. */
const KNOWN_CODES = new Set([
  'not_authorized', 'slot_not_found', 'slot_taken', 'slot_held', 'already_seated',
  'already_queued', 'already_reserved', 'free_slot_available', 'not_your_slot',
  'invalid_minutes', 'invalid_status', 'invalid_render_eta', 'on_break', 'not_on_break',
  'render_locked', 'slot_free', 'cannot_knock_self', 'knock_rate_limited', 'rate_limited',
  'user_not_found', 'cannot_modify_self', 'device_required', 'invalid_device', 'device_in_use',
  'not_found', 'device_taken',
])

function dbError(error: PostgrestError): Response {
  // Check-constraint violations (e.g. settings out of range) are bad input, not server errors.
  if (error.code === '23514') return fail('invalid_input', 400)
  const code = KNOWN_CODES.has(error.message) ? error.message : 'unknown'
  if (code === 'unknown') console.error('[bff] database error', error.code, error.message)
  const status = code === 'not_authorized' ? 403 : code === 'rate_limited' || code === 'knock_rate_limited' ? 429 : code === 'unknown' ? 500 : 409
  return fail(code, status)
}

/** GET /api/board: the whole board for the signed-in user (RLS applies). */
export async function board(session: StoredSession): Promise<Response> {
  const db = userClient(session.access)
  const [profiles, accounts, slots, queue, activity, settings] = await Promise.all([
    db.from('profiles').select('*').order('name'),
    db.from('accounts').select('*').order('id'),
    db.from('slots').select('*').order('account_id').order('slot_number'),
    db.from('queue').select('*').order('joined_at').order('id'),
    db.from('activity_log').select('*').order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    db.from('settings').select('*').maybeSingle(),
  ])
  for (const r of [profiles, accounts, slots, queue, activity, settings]) if (r.error) return dbError(r.error)
  // Inactive / pending users get no settings row back under RLS.
  if (!settings.data) return fail('not_authorized', 403)
  return json({
    profiles: profiles.data,
    accounts: accounts.data,
    slots: slots.data,
    queue: queue.data,
    activity: activity.data,
    settings: settings.data,
  })
}

type ArgType = 'int' | 'int?' | 'str' | 'str?' | 'bool?'

/** The only RPCs the browser may call, with their exact argument shapes. */
const RPCS: Record<string, Record<string, ArgType>> = {
  claim_slot: { p_slot_id: 'int', p_status: 'str', p_minutes: 'int', p_device_name: 'str?' },
  set_slot_device: { p_slot_id: 'int', p_device_name: 'str' },
  release_slot: { p_slot_id: 'int' },
  extend_slot: { p_slot_id: 'int', p_minutes: 'int' },
  set_status: { p_slot_id: 'int', p_status: 'str', p_render_eta: 'str?' },
  start_break: { p_slot_id: 'int' },
  end_break: { p_slot_id: 'int' },
  join_queue: {},
  leave_queue: {},
  knock: { p_slot_id: 'int' },
  update_my_profile: { p_name: 'str?', p_work_role: 'str?', p_avatar_color: 'str?', p_device_name: 'str?' },
  admin_force_release: { p_slot_id: 'int' },
  admin_remove_from_queue: { p_user_id: 'str' },
  admin_update_profile: { p_user_id: 'str', p_role: 'str?', p_active: 'bool?' },
  admin_delete_user: { p_user_id: 'str' },
  admin_update_account: { p_account_id: 'int', p_label: 'str' },
  admin_update_settings: { p_max_session_min: 'int?', p_hold_minutes: 'int?' },
}

export function validateArgs(name: string, args: unknown): Record<string, unknown> | null {
  const spec = RPCS[name]
  if (!spec || typeof args !== 'object' || args === null || Array.isArray(args)) return null
  const input = args as Record<string, unknown>
  for (const k of Object.keys(input)) if (!(k in spec)) return null
  const out: Record<string, unknown> = {}
  for (const [k, t] of Object.entries(spec)) {
    const v = input[k]
    const optional = t.endsWith('?')
    if (v === undefined || v === null) {
      if (!optional) return null
      out[k] = null
      continue
    }
    if (t.startsWith('int') && !(Number.isInteger(v) && Math.abs(v as number) < 2 ** 31)) return null
    if (t.startsWith('str') && !(typeof v === 'string' && v.length <= 200)) return null
    if (t === 'bool?' && typeof v !== 'boolean') return null
    out[k] = v
  }
  return out
}

export function isKnownRpc(name: string): boolean {
  return Object.hasOwn(RPCS, name)
}

/** POST /api/rpc/:name with JSON args. */
export async function rpc(request: Request, session: StoredSession, name: string): Promise<Response> {
  const args = validateArgs(name, await readJson(request))
  if (!args) return fail('invalid_input', 400)
  // Name is checked against the allowlist above; the cast only satisfies the typed client.
  const { data, error } = await userClient(session.access).rpc(name as 'join_queue', args as never)
  if (error) return dbError(error)
  return json({ data: data ?? null })
}
