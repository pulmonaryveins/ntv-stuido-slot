-- Studio Slots: row level security and grants.
-- Clients may only SELECT. Every write goes through SECURITY DEFINER RPCs.

create function private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and active and role = 'admin'
  );
$$;

alter table public.profiles     enable row level security;
alter table public.accounts     enable row level security;
alter table public.slots        enable row level security;
alter table public.queue        enable row level security;
alter table public.activity_log enable row level security;
alter table public.settings     enable row level security;

-- Inactive users see nothing; active non-admins never see inactive profiles.
create policy profiles_select on public.profiles for select to authenticated
  using (private.is_admin() or (private.is_active() and active));

create policy accounts_select on public.accounts for select to authenticated
  using (private.is_active());

create policy slots_select on public.slots for select to authenticated
  using (private.is_active());

create policy queue_select on public.queue for select to authenticated
  using (private.is_active());

create policy settings_select on public.settings for select to authenticated
  using (private.is_active());

-- Admins read the full log; users read the last 24h (enough for the live feed).
create policy activity_log_select on public.activity_log for select to authenticated
  using (
    private.is_admin()
    or (private.is_active() and created_at > now() - interval '24 hours')
  );

-- Grants: strip Supabase's default table privileges, then allow read only.
revoke all on all tables in schema public from anon, authenticated;
grant select on
  public.profiles, public.accounts, public.slots, public.queue,
  public.activity_log, public.settings
to authenticated;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active(), private.is_admin() to authenticated;
