-- DEV ONLY sample users. Every account below shares the password
--   studio-slots-dev
-- Do not run this against a project real people use (see README).
-- Accounts/slots/settings come from migrations, not from here.

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@studio.test', 'Avery Admin',  'admin', 'designer', '#e07a5f'),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'maya@studio.test',  'Maya Ortiz',   'user',  'editor',   '#3d9970'),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'jun@studio.test',   'Jun Park',     'user',  'designer', '#f2a541'),
      ('00000000-0000-4000-a000-000000000004'::uuid, 'sam@studio.test',   'Sam Rivera',   'user',  'motion',   '#5b8def'),
      ('00000000-0000-4000-a000-000000000005'::uuid, 'lena@studio.test',  'Lena Novak',   'user',  'editor',   '#c75b9b'),
      ('00000000-0000-4000-a000-000000000006'::uuid, 'omar@studio.test',  'Omar Haddad',  'user',  'designer', '#2bb3a3'),
      ('00000000-0000-4000-a000-000000000007'::uuid, 'priya@studio.test', 'Priya Shah',   'user',  'motion',   '#8e6cd1'),
      ('00000000-0000-4000-a000-000000000008'::uuid, 'theo@studio.test',  'Theo Laurent', 'user',  'editor',   '#d9534f'),
      ('00000000-0000-4000-a000-000000000009'::uuid, 'kai@studio.test',   'Kai Mendes',   'user',  'designer', '#6c9a3b'),
      ('00000000-0000-4000-a000-00000000000a'::uuid, 'rosa@studio.test',  'Rosa Kim',     'user',  'editor',   '#e8a87c'),
      ('00000000-0000-4000-a000-00000000000b'::uuid, 'ivan@studio.test',  'Ivan Petrov',  'user',  'motion',   '#4a7c9b')
    ) as t(id, email, name, role, work_role, color)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('studio-slots-dev', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', u.name, 'work_role', u.work_role),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      now(), now(), now()
    ) on conflict (provider_id, provider) do nothing;

    -- Profile row was created by the on_auth_user_created trigger.
    update public.profiles
       set role = u.role::public.app_role,
           work_role = u.work_role::public.work_role,
           avatar_color = u.color,
           active = true
     where id = u.id;
  end loop;
end;
$$;
