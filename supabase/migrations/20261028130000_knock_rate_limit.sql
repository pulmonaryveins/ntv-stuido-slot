-- Knock rate limit: 1 knock per user per slot every 2 minutes.
-- New error code: knock_rate_limited

create or replace function public.knock(p_slot_id integer)
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
  if exists (
    select 1 from public.activity_log
     where user_id = v_uid and slot_id = p_slot_id and action = 'knock'
       and created_at > now() - interval '2 minutes'
  ) then
    perform private.fail('knock_rate_limited');
  end if;

  perform private.log(p_slot_id, v_uid, 'knock', jsonb_build_object('target_user_id', v.user_id));
end;
$$;

revoke execute on function public.knock(integer) from public, anon;
grant execute on function public.knock(integer) to authenticated;
