/**
 * SQL rule + security tests. Applies every migration (and the dev seed) to an in-process
 * Postgres (PGlite) with minimal Supabase stubs (auth.users, auth.uid(), roles, realtime),
 * then calls the RPCs as different users through the `authenticated` role, so RLS and
 * grants apply exactly as they do through the Supabase API.
 *
 * Not covered here: true concurrency (PGlite has one connection). The claim race is
 * handled by the advisory lock + row locks + unique indexes in the RPC migration.
 */
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const MIGRATIONS = join(ROOT, 'supabase', 'migrations')

const U = (n: number) => `00000000-0000-4000-a000-0000000000${n.toString(16).padStart(2, '0')}`
const ADMIN = U(1), MAYA = U(2), JUN = U(3), SAM = U(4), LENA = U(5), OMAR = U(6), PRIYA = U(7), THEO = U(8)

const STUBS = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema extensions; create extension pgcrypto schema extensions;
  create schema auth;
  create table auth.users (
    instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
    email_change_token_new text, email_change text);
  create table auth.identities (id uuid, user_id uuid, provider_id text, provider text, identity_data jsonb,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, unique (provider_id, provider));
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
  create publication supabase_realtime;
  create schema realtime;
  create table realtime.messages (id bigserial primary key, topic text not null, payload jsonb);
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as
    $$ select current_setting('realtime.topic', true) $$;
  grant usage on schema realtime to authenticated;
  grant select on realtime.messages to authenticated;
`

async function freshDb(withSeed: boolean) {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(STUBS)
  for (const f of readdirSync(MIGRATIONS).sort()) await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  if (withSeed) await db.exec(readFileSync(join(ROOT, 'supabase', 'seed.sql'), 'utf8'))
  return db
}

function client(db: PGlite) {
  const as = async <T = Record<string, unknown>>(uid: string | null, sql: string, topic = '') => {
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false), set_config('realtime.topic', '${topic}', false); set role authenticated;`,
    )
    try {
      return (await db.query<T>(sql)).rows
    } finally {
      await db.exec('reset role')
    }
  }
  /** Error message of a call, or 'ok'. */
  const code = async (uid: string | null, sql: string) => {
    try {
      await as(uid, sql)
      return 'ok'
    } catch (e) {
      return (e as Error).message
    }
  }
  const su = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows
  return { as, code, su }
}

async function signUp(db: PGlite, id: string, email: string, name: string, extra: Record<string, string> = {}) {
  await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, now(), now())`,
    [id, email, JSON.stringify({ name, work_role: 'editor', ...extra })],
  )
}

describe('board rules (seeded)', () => {
  let db: PGlite
  let c: ReturnType<typeof client>
  beforeAll(async () => {
    db = await freshDb(true)
    c = client(db)
  })

  it('seeds 2 accounts, 4 slots, 11 active profiles', async () => {
    expect(await c.su(`select count(*)::int n from slots`)).toEqual([{ n: 4 }])
    expect(await c.su(`select count(*)::int n from profiles where active`)).toEqual([{ n: 11 }])
  })

  it('claim: one seat per user, taken slots rejected, status + minutes validated', async () => {
    expect(await c.code(MAYA, `select claim_slot(1, 'editing', 60)`)).toBe('ok')
    expect(await c.code(MAYA, `select claim_slot(2, 'editing', 60)`)).toBe('already_seated')
    expect(await c.code(JUN, `select claim_slot(1, 'designing', 60)`)).toBe('slot_taken')
    expect(await c.code(JUN, `select claim_slot(2, 'break', 60)`)).toBe('invalid_status')
    expect(await c.code(JUN, `select claim_slot(2, 'designing', 9999)`)).toBe('invalid_minutes')
    expect(await c.code(OMAR, `select join_queue()`)).toBe('free_slot_available')
  })

  it('queue: hold for #1 for 10 min, then passes to #2', async () => {
    for (const [uid, slot] of [[JUN, 2], [SAM, 3], [LENA, 4]] as const)
      expect(await c.code(uid, `select claim_slot(${slot}, 'editing', 60)`)).toBe('ok')
    expect(await c.code(OMAR, `select join_queue()`)).toBe('ok')
    expect(await c.code(PRIYA, `select join_queue()`)).toBe('ok')
    expect(await c.code(OMAR, `select join_queue()`)).toBe('already_queued')
    expect(await c.code(MAYA, `select join_queue()`)).toBe('already_seated')

    expect(await c.code(MAYA, `select release_slot(1)`)).toBe('ok')
    const [hold] = await c.su<{ hold_user_id: string; mins: number }>(
      `select hold_user_id, round(extract(epoch from hold_until - now()) / 60)::int mins from slots where id = 1`,
    )
    expect(hold).toEqual({ hold_user_id: OMAR, mins: 10 })
    expect(await c.code(THEO, `select claim_slot(1, 'editing', 30)`)).toBe('slot_held')

    await c.su(`update slots set hold_until = now() - interval '1 second' where id = 1`)
    await c.su(`select private.tick()`)
    expect(await c.su(`select hold_user_id from slots where id = 1`)).toEqual([{ hold_user_id: PRIYA }])
    expect(await c.su(`select count(*)::int n from queue where user_id = '${OMAR}'`)).toEqual([{ n: 0 }])

    expect(await c.code(PRIYA, `select claim_slot(1, 'color_grading', 45)`)).toBe('ok')
    expect(await c.su(`select count(*)::int n from queue`)).toEqual([{ n: 0 }])
  })

  it('render lock, break, knock limit, render completion', async () => {
    expect(await c.code(JUN, `select set_status(2, 'rendering')`)).toBe('invalid_render_eta')
    expect(await c.code(JUN, `select set_status(2, 'rendering', now() + interval '20 minutes')`)).toBe('ok')
    expect(await c.code(SAM, `select knock(2)`)).toBe('render_locked')
    expect(await c.code(JUN, `select start_break(2)`)).toBe('render_locked')

    expect(await c.code(SAM, `select knock(4)`)).toBe('ok')
    expect(await c.code(SAM, `select knock(4)`)).toBe('knock_rate_limited')
    expect(await c.code(SAM, `select knock(3)`)).toBe('cannot_knock_self')

    expect(await c.code(SAM, `select start_break(3)`)).toBe('ok')
    expect(await c.code(SAM, `select set_status(3, 'editing')`)).toBe('on_break')
    expect(await c.code(SAM, `select end_break(3)`)).toBe('ok')

    await c.su(`update slots set render_eta = now() - interval '1 second' where id = 2`)
    await c.su(`select private.tick()`)
    expect(await c.su(`select status, render_eta from slots where id = 2`)).toEqual([{ status: 'editing', render_eta: null }])
  })

  it('overdue is flagged once and never auto-kicks', async () => {
    await c.su(`update slots set expected_until = now() - interval '1 minute' where id = 4`)
    await c.su(`select private.tick()`)
    await c.su(`select private.tick()`)
    expect(await c.su(`select count(*)::int n from activity_log where action = 'overdue' and slot_id = 4`)).toEqual([{ n: 1 }])
    expect(await c.su(`select user_id from slots where id = 4`)).toEqual([{ user_id: LENA }])
  })
})

describe('security (seeded)', () => {
  let db: PGlite
  let c: ReturnType<typeof client>
  beforeAll(async () => {
    db = await freshDb(true)
    c = client(db)
    await c.as(MAYA, `select claim_slot(1, 'editing', 60)`)
  })

  it('clients cannot write tables directly', async () => {
    expect(await c.code(MAYA, `update slots set user_id = null where id = 1`)).toMatch(/permission denied/)
    expect(await c.code(MAYA, `insert into queue (user_id) values ('${MAYA}')`)).toMatch(/permission denied/)
    expect(await c.code(MAYA, `update profiles set role = 'admin' where id = '${MAYA}'`)).toMatch(/permission denied/)
    expect(await c.code(MAYA, `delete from activity_log`)).toMatch(/permission denied/)
  })

  it('users cannot act on other users\' slots or call admin RPCs', async () => {
    expect(await c.code(JUN, `select release_slot(1)`)).toBe('not_your_slot')
    expect(await c.code(JUN, `select extend_slot(1, 30)`)).toBe('not_your_slot')
    expect(await c.code(JUN, `select admin_force_release(1)`)).toBe('not_authorized')
    expect(await c.code(JUN, `select admin_update_profile('${JUN}', p_role => 'admin')`)).toBe('not_authorized')
    expect(await c.code(JUN, `select admin_update_settings(p_hold_minutes => 1)`)).toBe('not_authorized')
  })

  it('internal functions are not callable by clients', async () => {
    expect(await c.code(MAYA, `select private.tick()`)).toMatch(/permission denied/)
    expect(await c.code(MAYA, `select private.free_slot(1)`)).toMatch(/permission denied/)
  })

  it('anonymous (no user) is rejected', async () => {
    expect(await c.code(null, `select claim_slot(2, 'editing', 10)`)).toBe('not_authorized')
    expect(await c.as(null, `select count(*)::int n from slots`)).toEqual([{ n: 0 }])
  })

  it('rate limit: 30 actions per user per minute', async () => {
    await c.su(`insert into activity_log (user_id, action) select '${THEO}', 'test' from generate_series(1, 30)`)
    expect(await c.code(THEO, `select join_queue()`)).toBe('rate_limited')
    await c.su(`update activity_log set created_at = now() - interval '2 minutes' where user_id = '${THEO}'`)
    expect(await c.code(THEO, `select join_queue()`)).not.toBe('rate_limited')
  })

  it('admin can force-release; deactivation evicts and hides data', async () => {
    expect(await c.code(ADMIN, `select admin_force_release(1)`)).toBe('ok')
    await c.as(SAM, `select claim_slot(3, 'motion', 60)`)
    expect(await c.code(ADMIN, `select admin_update_profile('${SAM}', p_active => false)`)).toBe('ok')
    expect(await c.su(`select user_id from slots where id = 3`)).toEqual([{ user_id: null }])
    expect(await c.as(SAM, `select count(*)::int n from slots`)).toEqual([{ n: 0 }])
    expect(await c.as(MAYA, `select count(*)::int n from profiles where id = '${SAM}'`)).toEqual([{ n: 0 }])
    expect(await c.code(SAM, `select claim_slot(3, 'motion', 10)`)).toBe('not_authorized')
    expect(await c.code(ADMIN, `select admin_update_profile('${ADMIN}', p_role => 'user')`)).toBe('cannot_modify_self')
  })

  it('admin can delete a user: seat freed, auth user + profile gone, history kept', async () => {
    await c.as(OMAR, `select claim_slot(2, 'editing', 60)`)
    expect(await c.code(JUN, `select admin_delete_user('${OMAR}')`)).toBe('not_authorized')
    expect(await c.code(ADMIN, `select admin_delete_user('${ADMIN}')`)).toBe('cannot_modify_self')
    expect(await c.code(ADMIN, `select admin_delete_user('${OMAR}')`)).toBe('ok')
    expect(await c.su(`select user_id from slots where id = 2`)).toEqual([{ user_id: null }])
    expect(await c.su(`select count(*)::int n from profiles where id = '${OMAR}'`)).toEqual([{ n: 0 }])
    expect(await c.su(`select count(*)::int n from auth.users where id = '${OMAR}'`)).toEqual([{ n: 0 }])
    expect(await c.su(`select count(*)::int n from activity_log where action = 'user_deleted'`)).toEqual([{ n: 1 }])
    expect(await c.code(ADMIN, `select admin_delete_user('${OMAR}')`)).toBe('user_not_found')
  })

  it('realtime: only active users can join the private board channel', async () => {
    // Realtime authorizes a join by checking that the policy lets the user see rows while
    // realtime.topic() is the requested channel.
    await c.su(`insert into realtime.messages (topic) values ('studio-board')`)
    const canJoin = async (uid: string, topic: string) =>
      ((await c.as<{ n: number }>(uid, `select count(*)::int n from realtime.messages`, topic))[0]?.n ?? 0) > 0
    expect(await canJoin(MAYA, 'studio-board')).toBe(true)
    expect(await canJoin(MAYA, 'some-other-channel')).toBe(false)
    expect(await canJoin(SAM, 'studio-board')).toBe(false) // deactivated above
  })
})

describe('registration + approval (empty project)', () => {
  let db: PGlite
  let c: ReturnType<typeof client>
  const FIRST = '10000000-0000-4000-a000-000000000001'
  const SECOND = '10000000-0000-4000-a000-000000000002'
  beforeAll(async () => {
    db = await freshDb(false)
    c = client(db)
  })

  it('first account is an active admin', async () => {
    await signUp(db, FIRST, 'boss@example.com', 'Boss')
    expect(await c.su(`select role, active from profiles where id = '${FIRST}'`)).toEqual([{ role: 'admin', active: true }])
  })

  it('later accounts start inactive and are logged for the admin', async () => {
    await signUp(db, SECOND, 'new@example.com', 'Newbie')
    expect(await c.su(`select role, active from profiles where id = '${SECOND}'`)).toEqual([{ role: 'user', active: false }])
    expect(await c.su(`select count(*)::int n from activity_log where action = 'user_registered' and user_id = '${SECOND}'`)).toEqual([{ n: 1 }])
  })

  it('sign-up stores the Windows PC name (upper-cased); a malformed one is ignored, not fatal', async () => {
    const PC_OK = '10000000-0000-4000-a000-000000000003'
    const PC_BAD = '10000000-0000-4000-a000-000000000004'
    await signUp(db, PC_OK, 'pc@example.com', 'Pc', { device_name: ' h7 ' })
    await signUp(db, PC_BAD, 'bad@example.com', 'Bad', { device_name: 'way too long pc name!' })
    expect(await c.su(`select device_name from profiles where id = '${PC_OK}'`)).toEqual([{ device_name: 'H7' }])
    expect(await c.su(`select device_name from profiles where id = '${PC_BAD}'`)).toEqual([{ device_name: null }])
  })

  it('pending user sees only their own profile, no board, cannot act', async () => {
    expect(await c.as(SECOND, `select id from profiles`)).toEqual([{ id: SECOND }])
    expect(await c.as(SECOND, `select count(*)::int n from slots`)).toEqual([{ n: 0 }])
    expect(await c.code(SECOND, `select claim_slot(1, 'editing', 30)`)).toBe('not_authorized')
    expect(await c.code(SECOND, `select admin_update_profile('${SECOND}', p_active => true)`)).toBe('not_authorized')
  })

  it('admin sees the pending user and approves them', async () => {
    expect(await c.as(FIRST, `select count(*)::int n from profiles where not active`)).toEqual([{ n: 3 }])
    expect(await c.code(FIRST, `select admin_update_profile('${SECOND}', p_active => true)`)).toBe('ok')
    expect(await c.as(SECOND, `select count(*)::int n from slots`)).toEqual([{ n: 4 }])
    // A brand-new user has no remembered device yet.
    expect(await c.code(SECOND, `select claim_slot(1, 'editing', 30)`)).toBe('device_required')
    expect(await c.code(SECOND, `select claim_slot(1, 'editing', 30, 'NEW-PC')`)).toBe('ok')
  })
})

describe('Adobe device names (seeded)', () => {
  let db: PGlite
  let c: ReturnType<typeof client>
  beforeAll(async () => {
    db = await freshDb(true)
    c = client(db)
  })

  it('device names are unique across accounts (case-insensitive)', async () => {
    expect(await c.as(null, `select device_name_available('pc-jun') ok`)).toEqual([{ ok: false }])
    expect(await c.as(null, `select device_name_available('FREE-PC') ok`)).toEqual([{ ok: true }])
    expect(await c.code(SAM, `select update_my_profile(p_device_name => 'pc-jun')`)).toBe('device_taken')
    expect(await c.code(SAM, `select update_my_profile(p_device_name => 'PC-SAM')`)).toBe('ok') // own name is fine
    expect(await c.code(null, `update profiles set device_name = 'PC-JUN' where id = '${SAM}'`)).toMatch(/permission denied/)
    await expect(db.query(`update profiles set device_name = 'pc-jun' where id = '${SAM}'`)).rejects.toThrow(/unique/)
  })

  it("claiming at a colleague's PC works but does not take their device name", async () => {
    expect(await c.code(PRIYA, `select claim_slot(3, 'editing', 60, 'PC-THEO')`)).toBe('ok')
    expect(await c.su(`select device_name from slots where id = 3`)).toEqual([{ device_name: 'PC-THEO' }])
    expect(await c.su(`select device_name from profiles where id = '${PRIYA}'`)).toEqual([{ device_name: 'PC-PRIYA' }])
    await c.as(PRIYA, `select release_slot(3)`)
  })

  it('claim records the device (remembered profile device by default)', async () => {
    expect(await c.code(MAYA, `select claim_slot(1, 'editing', 60)`)).toBe('ok')
    expect(await c.su(`select device_name from slots where id = 1`)).toEqual([{ device_name: 'PC-MAYA' }])
  })

  it('a newly given device is stored on the seat and remembered on the profile', async () => {
    expect(await c.code(JUN, `select claim_slot(2, 'designing', 60, '  D4  ')`)).toBe('ok')
    expect(await c.su(`select device_name from slots where id = 2`)).toEqual([{ device_name: 'D4' }])
    expect(await c.su(`select device_name from profiles where id = '${JUN}'`)).toEqual([{ device_name: 'D4' }])
  })

  it('one device holds at most one seat per account; other accounts are fine', async () => {
    expect(await c.code(SAM, `select claim_slot(3, 'motion', 60, 'd4')`)).toBe('ok') // account 2
    expect(await c.code(LENA, `select release_slot(4)`)).toBe('not_your_slot')
    await c.as(SAM, `select release_slot(3)`)
    // same account as Jun's D4 seat (account 1, slot 2): Maya's seat cannot switch to it
    expect(await c.code(MAYA, `select set_slot_device(1, 'D4')`)).toBe('device_in_use')
  })

  it('rejects malformed names', async () => {
    expect(await c.code(LENA, `select claim_slot(4, 'editing', 30, '<script>')`)).toBe('invalid_device')
    expect(await c.code(LENA, `select update_my_profile(p_device_name => repeat('x', 61))`)).toBe('invalid_device')
    // typical macOS name with an apostrophe is fine
    expect(await c.code(LENA, `select update_my_profile(p_device_name => 'Lena''s MacBook Pro')`)).toBe('ok')
  })

  it('only the seat holder or an admin can correct the device', async () => {
    expect(await c.code(LENA, `select set_slot_device(1, 'C1')`)).toBe('not_your_slot')
    expect(await c.code(MAYA, `select set_slot_device(1, 'C1')`)).toBe('ok')
    expect(await c.code(ADMIN, `select set_slot_device(1, 'C2')`)).toBe('ok')
    expect(await c.su(`select device_name from slots where id = 1`)).toEqual([{ device_name: 'C2' }])
    // the admin's correction does not overwrite Maya's remembered device
    expect(await c.su(`select device_name from profiles where id = '${MAYA}'`)).toEqual([{ device_name: 'C1' }])
  })

  it('releasing clears the seat device', async () => {
    expect(await c.code(MAYA, `select release_slot(1)`)).toBe('ok')
    expect(await c.su(`select device_name from slots where id = 1`)).toEqual([{ device_name: null }])
  })
})
