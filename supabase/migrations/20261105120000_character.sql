-- Character customization: each user picks a hero from the character pack or builds their own
-- blocky character. Stored as a short code so the database can validate it with one check:
--   'hero:N'  hero N (0-99) from the pack, by position
--   'c:XXXXXXX'  a custom character: seven palette indices (0-9, a-z), in this order:
--                skin, hair colour, hair style, shirt, pants, eyes, accessory
--   null      not chosen: a random-but-stable hero (or the role-based blocky avatar)
-- The client maps indices onto its palettes (src/lib/look.ts) and wraps unknown ones.

alter table public.profiles
  add column character text
  check (character ~ '^(hero:[0-9]{1,2}|c:[0-9a-z]{7})$');

-- p_character: null = leave unchanged, '' = clear (back to automatic), anything else = set.
-- The signature changes, so drop the old function first (create or replace would add an overload).
drop function public.update_my_profile(text, public.work_role, text, text);

create function public.update_my_profile(
  p_name text default null,
  p_work_role public.work_role default null,
  p_avatar_color text default null,
  p_device_name text default null,
  p_character text default null
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
         device_name = coalesce(v_device, device_name),
         character = case
           when p_character is null then character
           when p_character = '' then null
           else p_character
         end
   where id = v_uid
  returning * into v;
  -- Logged so the change reaches everyone live (profiles are not in the realtime publication,
  -- activity_log is) and counts toward the per-user action rate limit.
  if p_character is not null then
    perform private.log(null, v_uid, 'character_change', '{}'::jsonb);
  end if;
  return v;
end;
$$;

revoke execute on function public.update_my_profile(text, public.work_role, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, public.work_role, text, text, text) to authenticated;
