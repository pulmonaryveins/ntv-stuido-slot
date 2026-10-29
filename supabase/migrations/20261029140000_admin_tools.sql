-- Admin tools: delete a user for good.
-- Deleting removes the auth user; the profile and queue entry cascade, their seat and holds are
-- freed first, and activity rows keep their history with user_id set to null.

create function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_admin();
  v_name text;
begin
  perform private.lock_board();
  if p_user_id = v_uid then
    perform private.fail('cannot_modify_self');
  end if;
  select name into v_name from public.profiles where id = p_user_id for update;
  if not found then
    perform private.fail('user_not_found');
  end if;

  perform private.evict_user(p_user_id, v_uid, 'deleted');
  perform private.log(null, v_uid, 'user_deleted', jsonb_build_object('target_user_id', p_user_id, 'name', v_name));
  delete from auth.users where id = p_user_id;
  perform private.reconcile(v_uid);
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
