-- Security hardening:
--   1. Admin approval: new accounts start inactive (except the very first, who is admin).
--   2. Users can read their own profile even while inactive (for the "waiting" screen).
--   3. Per-user action rate limit on all user RPCs (new error code: rate_limited).
--   4. Registrations are logged so admins see pending users live.
--   5. Realtime: the board channel is private and only active users may join it.

-- 1 + 4. Signup trigger --------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                                split_part(new.email, '@', 1), 'user'), 60);
  v_work  text := new.raw_user_meta_data ->> 'work_role';
  v_first boolean;
begin
  perform pg_advisory_xact_lock(74710002);
  v_first := not exists (select 1 from public.profiles);

  insert into public.profiles (id, name, role, work_role, active)
  values (
    new.id,
    v_name,
    case when v_first then 'admin'::public.app_role else 'user'::public.app_role end,
    case when v_work in ('editor', 'designer', 'motion')
         then v_work::public.work_role else 'designer' end,
    v_first
  )
  on conflict (id) do nothing;

  if found then
    perform private.log(null, new.id, 'user_registered', jsonb_build_object('pending', not v_first));
  end if;
  return new;
end;
$$;

-- 2. Own profile always readable ---------------------------------------------
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or private.is_admin()
    or (private.is_active() and active)
  );

-- 3. Rate limit, enforced inside require_active (used by every user RPC) -----
create or replace function private.require_active()
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
  -- At most 30 logged actions per user per minute.
  if (
    select count(*) from public.activity_log
     where user_id = v_uid and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

revoke execute on function private.require_active() from public, anon, authenticated;

-- 5. Realtime authorization for the private board channel ---------------------
-- Clients join `studio-board` with { private: true }. Only active users may join.
-- Table changes delivered on the channel are still filtered by each table's RLS.
create policy studio_board_join on realtime.messages for select to authenticated
  using (realtime.topic() = 'studio-board' and private.is_active());
