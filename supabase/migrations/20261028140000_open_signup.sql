-- Open registration: anyone can sign up with email + password.
-- The very first registered user becomes the admin; everyone after is a regular user.
-- Admins can deactivate users later (inactive users see nothing, RLS).

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

  insert into public.profiles (id, name, role, work_role)
  values (
    new.id,
    v_name,
    case when v_first then 'admin'::public.app_role else 'user'::public.app_role end,
    case when v_work in ('editor', 'designer', 'motion')
         then v_work::public.work_role else 'designer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
