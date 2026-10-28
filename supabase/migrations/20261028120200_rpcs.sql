-- Studio Slots: board rules as atomic SECURITY DEFINER RPCs.
--
-- Concurrency: every mutating RPC takes one transaction-scoped advisory lock
-- (private.lock_board) so board operations are fully serialised, then row-locks
-- the slot it touches. Unique partial indexes on slots back this up.
--
-- Errors are raised with a stable snake_case MESSAGE the client maps to text:
--   not_authorized, slot_not_found, slot_taken, slot_held, already_seated,
--   already_queued, already_reserved, free_slot_available, not_your_slot,
--   invalid_minutes, invalid_status, invalid_render_eta, on_break, not_on_break,
--   render_locked, slot_free, cannot_knock_self, user_not_found, cannot_modify_self

-- ---------------------------------------------------------------------------
-- Internal helpers (private schema, not exposed to clients)
-- ---------------------------------------------------------------------------
create function private.fail(p_code text)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_code using errcode = 'P0001';
end;
$$;

create function private.require_active()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and active
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and active and role = 'admin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create function private.lock_board()
returns void
language sql
as $$
  select pg_advisory_xact_lock(74710001);
$$;

create function private.log(
  p_slot_id integer,
  p_actor uuid,
  p_action text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_log (slot_id, user_id, action, meta)
  values (p_slot_id, p_actor, p_action, coalesce(p_meta, '{}'::jsonb));
$$;

create function private.check_minutes(p_minutes integer)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_minutes is null or p_minutes < 1
     or p_minutes > (select max_session_min from public.settings where id) then
    perform private.fail('invalid_minutes');
  end if;
end;
$$;

-- Locks and returns a slot the caller is seated in.
create function private.own_slot(p_slot_id integer, p_uid uuid)
returns public.slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.slots;
begin
  select * into v from public.slots where id = p_slot_id for update;
  if not found then
    perform private.fail('slot_not_found');
  end if;
  if v.user_id is distinct from p_uid then
    perform private.fail('not_your_slot');
  end if;
  return v;
end;
$$;

-- Frees a seat (no hold assignment; caller runs reconcile).
create function private.free_slot(p_slot_id integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.slots
     set user_id = null, status = null, claimed_at = null, expected_until = null,
         render_eta = null, prev_status = null, break_until = null
   where id = p_slot_id;
$$;

-- Reserve a free, unheld slot for the first queued user who has no hold.
create function private.assign_hold(p_slot_id integer, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid;
  v_until timestamptz;
begin
  perform 1 from public.slots
   where id = p_slot_id and user_id is null and hold_user_id is null
   for update;
  if not found then
    return;
  end if;

  select q.user_id into v_user
    from public.queue q
   where not exists (select 1 from public.slots s where s.hold_user_id = q.user_id)
     and not exists (select 1 from public.slots s where s.user_id = q.user_id)
   order by q.joined_at, q.id
   limit 1;
  if v_user is null then
    return;
  end if;

  v_until := now() + make_interval(mins => (select hold_minutes from public.settings where id));
  update public.slots set hold_user_id = v_user, hold_until = v_until where id = p_slot_id;
  perform private.log(p_slot_id, p_actor, 'hold_granted',
    jsonb_build_object('target_user_id', v_user, 'hold_until', v_until));
end;
$$;

-- Expire stale holds (holder leaves the queue) and hand free seats to the queue.
-- Runs at the start and end of every mutating RPC and from cron, so holds are
-- exact even between cron ticks.
create function private.reconcile(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, hold_user_id from public.slots
     where hold_until is not null and hold_until <= now()
     order by id
     for update
  loop
    update public.slots set hold_user_id = null, hold_until = null where id = r.id;
    delete from public.queue where user_id = r.hold_user_id;
    perform private.log(r.id, null, 'hold_expired',
      jsonb_build_object('target_user_id', r.hold_user_id));
  end loop;

  for r in
    select id from public.slots
     where user_id is null and hold_user_id is null
     order by id
  loop
    perform private.assign_hold(r.id, p_actor);
  end loop;
end;
$$;

-- Remove a user from the board entirely (seat, hold, queue). Used on deactivation.
create function private.evict_user(p_user uuid, p_actor uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot integer;
begin
  select id into v_slot from public.slots where user_id = p_user for update;
  if v_slot is not null then
    perform private.free_slot(v_slot);
    perform private.log(v_slot, p_actor, 'force_release',
      jsonb_build_object('target_user_id', p_user, 'reason', p_reason));
  end if;
  update public.slots set hold_user_id = null, hold_until = null where hold_user_id = p_user;
  delete from public.queue where user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- User RPCs
-- ---------------------------------------------------------------------------
create function public.claim_slot(
  p_slot_id integer,
  p_status public.slot_status,
  p_minutes integer
)
returns public.slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active();
  v     public.slots;
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);

  if p_status is null or p_status in ('break', 'rendering') then
    perform private.fail('invalid_status');
  end if;
  perform private.check_minutes(p_minutes);

  select * into v from public.slots where id = p_slot_id for update;
  if not found then
    perform private.fail('slot_not_found');
  end if;
  if v.user_id is not null then
    perform private.fail('slot_taken');
  end if;
  if v.hold_user_id is not null and v.hold_user_id <> v_uid then
    perform private.fail('slot_held');
  end if;
  if exists (select 1 from public.slots where user_id = v_uid) then
    perform private.fail('already_seated');
  end if;

  -- Caller may have been holding a different slot; release that reservation.
  update public.slots set hold_user_id = null, hold_until = null
   where hold_user_id = v_uid and id <> p_slot_id;

  update public.slots
     set user_id = v_uid, status = p_status, claimed_at = now(),
         expected_until = now() + make_interval(mins => p_minutes),
         render_eta = null, prev_status = null, break_until = null,
         hold_user_id = null, hold_until = null
   where id = p_slot_id
  returning * into v;

  delete from public.queue where user_id = v_uid;
  perform private.log(p_slot_id, v_uid, 'claim',
    jsonb_build_object('status', p_status, 'expected_until', v.expected_until));

  perform private.reconcile(v_uid);
  return v;
end;
$$;

create function public.release_slot(p_slot_id integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active();
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);
  perform private.own_slot(p_slot_id, v_uid);
  perform private.free_slot(p_slot_id);
  perform private.log(p_slot_id, v_uid, 'release');
  perform private.reconcile(v_uid);
end;
$$;

create function public.extend_slot(p_slot_id integer, p_minutes integer)
returns public.slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_active();
  v       public.slots;
  v_max   timestamptz;
  v_until timestamptz;
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);
  perform private.check_minutes(p_minutes);
  v := private.own_slot(p_slot_id, v_uid);

  -- Extending an overdue slot counts from now. Never beyond now + max session.
  v_max   := now() + make_interval(mins => (select max_session_min from public.settings where id));
  v_until := least(greatest(v.expected_until, now()) + make_interval(mins => p_minutes), v_max);

  update public.slots set expected_until = v_until where id = p_slot_id returning * into v;
  perform private.log(p_slot_id, v_uid, 'extend',
    jsonb_build_object('minutes', p_minutes, 'expected_until', v_until));
  return v;
end;
$$;

create function public.set_status(
  p_slot_id integer,
  p_status public.slot_status,
  p_render_eta timestamptz default null
)
returns public.slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_active();
  v      public.slots;
  v_from public.slot_status;
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);

  if p_status is null or p_status = 'break' then
    perform private.fail('invalid_status');
  end if;
  v := private.own_slot(p_slot_id, v_uid);
  if v.status = 'break' then
    perform private.fail('on_break');
  end if;
  if p_status = 'rendering' and (
       p_render_eta is null
       or p_render_eta <= now()
       or p_render_eta > now() + interval '24 hours') then
    perform private.fail('invalid_render_eta');
  end if;

  v_from := v.status;
  update public.slots
     set status = p_status,
         render_eta = case when p_status = 'rendering' then p_render_eta end
   where id = p_slot_id
  returning * into v;

  perform private.log(p_slot_id, v_uid, 'status',
    jsonb_build_object('from', v_from, 'to', p_status, 'render_eta', v.render_eta));
  return v;
end;
$$;

create function public.start_break(p_slot_id integer)
returns public.slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active();
  v     public.slots;
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);
  v := private.own_slot(p_slot_id, v_uid);
  if v.status = 'break' then
    perform private.fail('on_break');
  end if;
  if v.status = 'rendering' then
    perform private.fail('render_locked');
  end if;

  update public.slots
     set prev_status = status,
         status = 'break',
         break_until = now() + make_interval(mins => (select break_minutes from public.settings where id))
   where id = p_slot_id
  returning * into v;

  perform private.log(p_slot_id, v_uid, 'break_start',
    jsonb_build_object('break_until', v.break_until));
  return v;
end;
$$;

create function public.end_break(p_slot_id integer)
returns public.slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active();
  v     public.slots;
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);
  v := private.own_slot(p_slot_id, v_uid);
  if v.status is distinct from 'break' then
    perform private.fail('not_on_break');
  end if;

  update public.slots
     set status = prev_status, prev_status = null, break_until = null
   where id = p_slot_id
  returning * into v;

  perform private.log(p_slot_id, v_uid, 'break_end', jsonb_build_object('status', v.status));
  return v;
end;
$$;

create function public.join_queue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active();
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);

  if exists (select 1 from public.slots where user_id = v_uid) then
    perform private.fail('already_seated');
  end if;
  if exists (select 1 from public.slots where hold_user_id = v_uid) then
    perform private.fail('already_reserved');
  end if;
  if exists (select 1 from public.queue where user_id = v_uid) then
    perform private.fail('already_queued');
  end if;
  if exists (select 1 from public.slots where user_id is null and hold_user_id is null) then
    perform private.fail('free_slot_available');
  end if;

  insert into public.queue (user_id) values (v_uid);
  perform private.log(null, v_uid, 'queue_join');
end;
$$;

create function public.leave_queue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active();
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);

  delete from public.queue where user_id = v_uid;
  if found then
    -- Leaving while holding a reservation gives it up.
    update public.slots set hold_user_id = null, hold_until = null where hold_user_id = v_uid;
    perform private.log(null, v_uid, 'queue_leave');
  end if;

  perform private.reconcile(v_uid);
end;
$$;

create function public.knock(p_slot_id integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active();
  v     public.slots;
begin
  perform private.lock_board();

  select * into v from public.slots where id = p_slot_id;
  if not found then
    perform private.fail('slot_not_found');
  end if;
  if v.user_id is null then
    perform private.fail('slot_free');
  end if;
  if v.user_id = v_uid then
    perform private.fail('cannot_knock_self');
  end if;
  if v.status = 'rendering' then
    perform private.fail('render_locked');
  end if;

  perform private.log(p_slot_id, v_uid, 'knock', jsonb_build_object('target_user_id', v.user_id));
end;
$$;

create function public.update_my_profile(
  p_name text default null,
  p_work_role public.work_role default null,
  p_avatar_color text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_active();
  v     public.profiles;
begin
  update public.profiles
     set name = coalesce(nullif(trim(p_name), ''), name),
         work_role = coalesce(p_work_role, work_role),
         avatar_color = coalesce(p_avatar_color, avatar_color)
   where id = v_uid
  returning * into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
create function public.admin_force_release(p_slot_id integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v     public.slots;
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);

  select * into v from public.slots where id = p_slot_id for update;
  if not found then
    perform private.fail('slot_not_found');
  end if;
  if v.user_id is null then
    perform private.fail('slot_free');
  end if;

  perform private.free_slot(p_slot_id);
  perform private.log(p_slot_id, v_uid, 'force_release',
    jsonb_build_object('target_user_id', v.user_id, 'status', v.status));
  perform private.reconcile(v_uid);
end;
$$;

create function public.admin_remove_from_queue(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);

  delete from public.queue where user_id = p_user_id;
  if found then
    update public.slots set hold_user_id = null, hold_until = null where hold_user_id = p_user_id;
    perform private.log(null, v_uid, 'queue_remove', jsonb_build_object('target_user_id', p_user_id));
  end if;

  perform private.reconcile(v_uid);
end;
$$;

-- Null arguments mean "leave unchanged".
create function public.admin_update_profile(
  p_user_id uuid,
  p_role public.app_role default null,
  p_active boolean default null,
  p_work_role public.work_role default null,
  p_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v     public.profiles;
  v_old public.profiles;
begin
  perform private.lock_board();

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    perform private.fail('user_not_found');
  end if;
  -- Admins cannot lock themselves out.
  if p_user_id = v_uid and (p_active is false or p_role = 'user') then
    perform private.fail('cannot_modify_self');
  end if;

  update public.profiles
     set role = coalesce(p_role, role),
         active = coalesce(p_active, active),
         work_role = coalesce(p_work_role, work_role),
         name = coalesce(nullif(trim(p_name), ''), name)
   where id = p_user_id
  returning * into v;

  if v_old.active and not v.active then
    perform private.evict_user(p_user_id, v_uid, 'deactivated');
  end if;

  perform private.log(null, v_uid, 'profile_update', jsonb_build_object(
    'target_user_id', p_user_id,
    'role', v.role, 'active', v.active, 'work_role', v.work_role));
  perform private.reconcile(v_uid);
  return v;
end;
$$;

create function public.admin_update_account(p_account_id integer, p_label text)
returns public.accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v     public.accounts;
begin
  update public.accounts set label = trim(p_label) where id = p_account_id returning * into v;
  if not found then
    perform private.fail('not_found');
  end if;
  perform private.log(null, v_uid, 'account_update',
    jsonb_build_object('account_id', p_account_id, 'label', v.label));
  return v;
end;
$$;

create function public.admin_update_settings(
  p_max_session_min integer default null,
  p_hold_minutes integer default null,
  p_break_minutes integer default null
)
returns public.settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v     public.settings;
begin
  update public.settings
     set max_session_min = coalesce(p_max_session_min, max_session_min),
         hold_minutes = coalesce(p_hold_minutes, hold_minutes),
         break_minutes = coalesce(p_break_minutes, break_minutes)
   where id
  returning * into v;
  perform private.log(null, v_uid, 'settings_update', to_jsonb(v) - 'id');
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Periodic job (scheduled with pg_cron in phase 6): holds, renders, overdue.
-- ---------------------------------------------------------------------------
create function private.tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  perform private.lock_board();
  perform private.reconcile(null);

  -- Finished renders go back to editing.
  for r in
    select id, user_id from public.slots
     where status = 'rendering' and render_eta <= now()
     for update
  loop
    update public.slots set status = 'editing', render_eta = null where id = r.id;
    perform private.log(r.id, null, 'render_done', jsonb_build_object('target_user_id', r.user_id));
  end loop;

  -- Overdue is flagged once per expected_until value; seats are never auto-kicked.
  for r in
    select s.id, s.user_id, s.expected_until from public.slots s
     where s.user_id is not null
       and s.expected_until <= now()
       and not exists (
         select 1 from public.activity_log l
          where l.slot_id = s.id and l.action = 'overdue'
            and (l.meta ->> 'expected_until')::timestamptz = s.expected_until)
  loop
    perform private.log(r.id, null, 'overdue', jsonb_build_object(
      'target_user_id', r.user_id, 'expected_until', r.expected_until));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active(), private.is_admin() to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.claim_slot(integer, public.slot_status, integer),
  public.release_slot(integer),
  public.extend_slot(integer, integer),
  public.set_status(integer, public.slot_status, timestamptz),
  public.start_break(integer),
  public.end_break(integer),
  public.join_queue(),
  public.leave_queue(),
  public.knock(integer),
  public.update_my_profile(text, public.work_role, text),
  public.admin_force_release(integer),
  public.admin_remove_from_queue(uuid),
  public.admin_update_profile(uuid, public.app_role, boolean, public.work_role, text),
  public.admin_update_account(integer, text),
  public.admin_update_settings(integer, integer, integer)
to authenticated;
