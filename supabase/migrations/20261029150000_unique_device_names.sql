-- Unique device names (Windows hostnames) across accounts, case-insensitive.
-- Email is already unique in Supabase Auth; the BFF reports "email_taken" on sign-up.

-- 1. Existing duplicates: keep the name on the oldest profile, clear it on the others.
update public.profiles p
   set device_name = null
 where device_name is not null
   and exists (
     select 1 from public.profiles o
      where lower(o.device_name) = lower(p.device_name)
        and (o.created_at, o.id) < (p.created_at, p.id)
   );

create unique index profiles_device_name_key on public.profiles (lower(device_name))
  where device_name is not null;

-- 2. Who has registered this device name (null if nobody).
create function private.device_owner(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where lower(device_name) = lower(trim(p_name)) limit 1;
$$;

-- 3. Sign-up form check. Returns only true/false, so it reveals nothing else; the BFF rate-limits it.
create function public.device_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.device_owner(p_name) is null;
$$;

-- 4. Sign-up trigger: a name taken in a race is dropped rather than failing the sign-up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                                 split_part(new.email, '@', 1), 'user'), 60);
  v_work   text := new.raw_user_meta_data ->> 'work_role';
  v_device text := upper(nullif(trim(new.raw_user_meta_data ->> 'device_name'), ''));
  v_first  boolean;
begin
  if v_device is not null and v_device !~ '^[A-Z0-9-]{1,15}$' then
    v_device := null;
  end if;

  perform pg_advisory_xact_lock(74710002);
  if v_device is not null and private.device_owner(v_device) is not null then
    v_device := null;
  end if;
  v_first := not exists (select 1 from public.profiles);

  insert into public.profiles (id, name, role, work_role, active, device_name)
  values (
    new.id,
    v_name,
    case when v_first then 'admin'::public.app_role else 'user'::public.app_role end,
    case when v_work in ('editor', 'designer', 'motion')
         then v_work::public.work_role else 'designer' end,
    v_first,
    v_device
  )
  on conflict (id) do nothing;

  if found then
    perform private.log(null, new.id, 'user_registered', jsonb_build_object('pending', not v_first));
  end if;
  return new;
end;
$$;

-- 5. Saving your device: refuse a name registered to someone else.
create or replace function public.update_my_profile(
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
  v_uid    uuid := private.require_active();
  v_device text := private.clean_device(p_device_name);
  v        public.profiles;
begin
  if v_device is not null and coalesce(private.device_owner(v_device), v_uid) <> v_uid then
    perform private.fail('device_taken');
  end if;
  update public.profiles
     set name = coalesce(nullif(trim(p_name), ''), name),
         work_role = coalesce(p_work_role, work_role),
         avatar_color = coalesce(p_avatar_color, avatar_color),
         device_name = coalesce(v_device, device_name)
   where id = v_uid
  returning * into v;
  return v;
end;
$$;

-- 6. Claiming / correcting a seat's device on someone else's PC works, but is not saved as yours.
create or replace function public.claim_slot(
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

  -- Remember a newly given device name on the profile for next time, unless that PC is
  -- registered to someone else (working at a colleague's desk is fine; it is not theirs to keep).
  if v_given is not null and coalesce(private.device_owner(v_given), v_uid) = v_uid then
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

create or replace function public.set_slot_device(p_slot_id integer, p_device_name text)
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
  update public.profiles set device_name = v_device
   where id = v.user_id and id = v_uid
     and coalesce(private.device_owner(v_device), v_uid) = v_uid;
  perform private.log(p_slot_id, v_uid, 'device_change',
    jsonb_build_object('from', v_old, 'to', v_device, 'target_user_id', v.user_id));
  return v;
end;
$$;

revoke execute on function private.device_owner(text) from public, anon, authenticated;
revoke execute on function public.device_name_available(text) from public;
grant execute on function public.device_name_available(text) to anon, authenticated;
