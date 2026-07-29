-- Remove auto-vote loop from start_session.
-- All members now vote on every item, not just items they didn't add.
create or replace function public.start_session(
  p_watchlist_id uuid,
  p_item_ids     uuid[],
  p_duration     interval
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id    uuid;
  v_session     public.sessions;
begin
  select group_id into v_group_id
  from public.watchlists
  where id = p_watchlist_id;

  if v_group_id is null then
    raise exception 'Watchlist not found';
  end if;

  if not public.is_group_leader(v_group_id) then
    raise exception 'Only the leader can start a session';
  end if;

  if exists (
    select 1 from public.sessions
    where watchlist_id = p_watchlist_id and status = 'active'
  ) then
    raise exception 'An active session already exists for this watchlist';
  end if;

  if array_length(p_item_ids, 1) < 2 then
    raise exception 'At least 2 items required to start a session';
  end if;

  if (
    select count(*) from public.group_members
    where group_id = v_group_id
  ) < 2 then
    raise exception 'At least 2 members required to start a session';
  end if;

  if exists (
    select 1 from public.sessions
    where watchlist_id = p_watchlist_id
      and status = 'ended'
      and outcome is null
    order by created_at desc
    limit 1
  ) then
    raise exception 'Previous session outcome must be resolved before starting a new one';
  end if;

  insert into public.sessions (watchlist_id, item_ids, end_time)
  values (p_watchlist_id, p_item_ids, now() + p_duration)
  returning * into v_session;

  insert into public.session_participants (session_id, user_id)
  select v_session.id, gm.user_id
  from public.group_members gm
  where gm.group_id = v_group_id;

  return v_session;
end;
$$;