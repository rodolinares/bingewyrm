-- 00005 and 00007 revoked from anon/authenticated, but the default PUBLIC grant kept them callable by everyone.
-- RLS policies call these helpers as the signed-in user, so authenticated must keep EXECUTE.
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_leader(uuid) to authenticated;
grant execute on function public.get_item_owner_group_id(uuid) to authenticated;
grant execute on function public.get_watchlist_group_id(uuid) to authenticated;
grant execute on function public.get_session_group_id(uuid) to authenticated;
grant execute on function public.get_member_count(uuid[]) to authenticated;

revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.is_group_leader(uuid) from public, anon;
revoke execute on function public.get_item_owner_group_id(uuid) from public, anon;
revoke execute on function public.get_watchlist_group_id(uuid) from public, anon;
revoke execute on function public.get_session_group_id(uuid) from public, anon;
revoke execute on function public.get_member_count(uuid[]) from public, anon;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.close_expired_sessions() from public, anon, authenticated;
revoke execute on function public.backfill_item_details(uuid, numeric, text[]) from public, anon, authenticated;
