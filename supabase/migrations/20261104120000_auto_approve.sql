-- TEMPORARY: admin approval is switched off. New accounts start active (the first one is still
-- the admin). To turn approval back on, add a migration that restores the
-- 20261029150000_unique_device_names.sql version of private.handle_new_user (active = v_first).
-- Deactivation is unaffected: admins can still deactivate users, and they stay locked out.

-- 1. Users still waiting for approval (inactive and never touched by an admin) are let in now.
--    Users an admin deactivated keep active = false.
update public.profiles p
   set active = true
 where not p.active
   and not exists (
     select 1 from public.activity_log a
      where a.action = 'profile_update'
        and a.meta ->> 'target_user_id' = p.id::text
   );

-- 2. Sign-up trigger: same as before, but every new profile is active.
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
    true,
    v_device
  )
  on conflict (id) do nothing;

  if found then
    perform private.log(null, new.id, 'user_registered', jsonb_build_object('pending', false));
  end if;
  return new;
end;
$$;
