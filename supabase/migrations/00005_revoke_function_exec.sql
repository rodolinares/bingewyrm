-- Revoke EXECUTE on internal helper functions — they're used by RLS policies only,
-- not meant to be called via RPC.
revoke execute on function public.is_group_member(uuid) from anon, authenticated;
revoke execute on function public.is_group_leader(uuid) from anon, authenticated;
revoke execute on function public.get_item_owner_group_id(uuid) from anon, authenticated;
revoke execute on function public.get_watchlist_group_id(uuid) from anon, authenticated;
revoke execute on function public.get_session_group_id(uuid) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- close_expired_sessions is cron-only — revoke public exec
revoke execute on function public.close_expired_sessions() from anon, authenticated;
