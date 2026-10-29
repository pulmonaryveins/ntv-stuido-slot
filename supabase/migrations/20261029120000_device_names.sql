-- Adobe device names.
-- Adobe's "activated devices" page lists seats by the computer's device name (e.g. "C1",
-- "D4"), which the app could not map to a slot or a person. Each profile now remembers its
-- device name and each occupied slot records the device it is used on.
-- New error codes: device_required, invalid_device, device_in_use

-- 1. Columns ---------------------------------------------------------------
alter table public.profiles add column device_name text
  constraint profiles_device_name_format check (device_name ~ '^[[:alnum:]][[:alnum:] ._''’()-]{0,59}$');

alter table public.slots add column device_name text
  constraint slots_device_name_format check (device_name ~ '^[[:alnum:]][[:alnum:] ._''’()-]{0,59}$');
alter table public.slots add constraint slots_device_only_when_occupied
  check (user_id is not null or device_name is null);

-- One device holds at most one seat per Adobe account.
create unique index slots_one_seat_per_device
  on public.slots (account_id, lower(device_name)) where device_name is not null;

-- 2. Helpers ---------------------------------------------------------------
create or replace function private.free_slot(p_slot_id integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.slots
     set user_id = null, status = null, claimed_at = null, expected_until = null,
         render_eta = null, prev_status = null, break_until = null, device_name = null
   where id = p_slot_id;
$$;

/** Trimmed, validated device name or null when empty. */
create function private.clean_device(p_device text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v text := nullif(trim(p_device), '');
begin
  if v is not null and v !~ '^[[:alnum:]][[:alnum:] ._''’()-]{0,59}$' then
    perform private.fail('invalid_device');
  end if;
  return v;
end;
$$;

-- 3. claim_slot gains the device (falls back to the profile's remembered one) -
drop function public.claim_slot(integer, public.slot_status, integer);

create function public.claim_slot(
  p_slot_id integer,
  p_status public.slot_status,
  p_minutes integer,
  p_device_name text default null
)
returns public.slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_active();
  v        public.slots;
  v_given  text := private.clean_device(p_device_name);
  v_device text;
begin
  perform private.lock_board();
  perform private.reconcile(v_uid);

  if p_status is null or p_status in ('break', 'rendering') then
    perform private.fail('invalid_status');
  end if;
  perform private.check_minutes(p_minutes);

  v_device := coalesce(v_given, (select device_name from public.profiles where id = v_uid));
  if v_device is null then
    perform private.fail('device_required');
  end if;

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
  if exists (
    select 1 from public.slots
     where account_id = v.account_id and lower(device_name) = lower(v_device) and id <> p_slot_id
  ) then
    perform private.fail('device_in_use');
  end if;

  -- Remember a newly given device name on the profile for next time.
  if v_given is not null then
    update public.profiles set device_name = v_given where id = v_uid;
  end if;

  -- Caller may have been holding a different slot; release that reservation.
  update public.slots set hold_user_id = null, hold_until = null
   where hold_user_id = v_uid and id <> p_slot_id;

  update public.slots
     set user_id = v_uid, status = p_status, claimed_at = now(),
         expected_until = now() + make_interval(mins => p_minutes),
         render_eta = null, prev_status = null, break_until = null,
         hold_user_id = null, hold_until = null, device_name = v_device
   where id = p_slot_id
  returning * into v;

  delete from public.queue where user_id = v_uid;
  perform private.log(p_slot_id, v_uid, 'claim',
    jsonb_build_object('status', p_status, 'expected_until', v.expected_until, 'device_name', v_device));

  perform private.reconcile(v_uid);
  return v;
end;
$$;

-- 4. Correct the device on an occupied seat (the seat's user or an admin) ------
create function public.set_slot_device(p_slot_id integer, p_device_name text)
returns public.slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_active();
  v        public.slots;
  v_device text := private.clean_device(p_device_name);
  v_old    text;
begin
  perform private.lock_board();
  if v_device is null then
    perform private.fail('device_required');
  end if;
  select * into v from public.slots where id = p_slot_id for update;
  if not found then
    perform private.fail('slot_not_found');
  end if;
  if v.user_id is null then
    perform private.fail('slot_free');
  end if;
  if v.user_id <> v_uid and not private.is_admin() then
    perform private.fail('not_your_slot');
  end if;
  if exists (
    select 1 from public.slots
     where account_id = v.account_id and lower(device_name) = lower(v_device) and id <> p_slot_id
  ) then
    perform private.fail('device_in_use');
  end if;

  v_old := v.device_name;
  update public.slots set device_name = v_device where id = p_slot_id returning * into v;
  -- The seat's own user also remembers it for next time.
  update public.profiles set device_name = v_device where id = v.user_id and id = v_uid;
  perform private.log(p_slot_id, v_uid, 'device_change',
    jsonb_build_object('from', v_old, 'to', v_device, 'target_user_id', v.user_id));
  return v;
end;
$$;

-- 5. update_my_profile can set the remembered device ----------------------------
drop function public.update_my_profile(text, public.work_role, text);

create function public.update_my_profile(
  p_name text default null,
  p_work_role public.work_role default null,
  p_avatar_color text default null,
  p_device_name text default null
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
         avatar_color = coalesce(p_avatar_color, avatar_color),
         device_name = coalesce(private.clean_device(p_device_name), device_name)
   where id = v_uid
  returning * into v;
  return v;
end;
$$;

-- 6. Grants ------------------------------------------------------------------
revoke execute on function private.clean_device(text) from public, anon, authenticated;
revoke execute on function
  public.claim_slot(integer, public.slot_status, integer, text),
  public.set_slot_device(integer, text),
  public.update_my_profile(text, public.work_role, text, text)
from public, anon;
grant execute on function
  public.claim_slot(integer, public.slot_status, integer, text),
  public.set_slot_device(integer, text),
  public.update_my_profile(text, public.work_role, text, text)
to authenticated;
