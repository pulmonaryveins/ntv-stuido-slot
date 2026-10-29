-- Ask for the Windows device name (hostname) at sign-up.
-- The register form sends it as user metadata `device_name`; the signup trigger stores it on
-- the profile (pending users cannot call RPCs yet, so this is the only place to save it).
-- Windows device names: letters, digits and dashes, up to 15 characters, shown in capitals.

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
  -- Never fail a sign-up over a bad device name; the user can set it later.
  if v_device is not null and v_device !~ '^[A-Z0-9-]{1,15}$' then
    v_device := null;
  end if;

  perform pg_advisory_xact_lock(74710002);
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
