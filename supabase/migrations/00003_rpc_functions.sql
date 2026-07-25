-- BingeWyrm: RPC functions
-- Atomic multi-step operations to prevent partial/inconsistent state.

-- ==================== START SESSION ====================
-- Validates preconditions, locks item pool, snapshots participants,
-- inserts auto-votes for self-added items, sets end_time.
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
  v_participant record;
  v_item_id     uuid;
  v_item_owner  uuid;
begin
  -- Resolve group
  select group_id into v_group_id
  from public.watchlists
  where id = p_watchlist_id;

  if v_group_id is null then
    raise exception 'Watchlist not found';
  end if;

  -- Must be leader
  if not public.is_group_leader(v_group_id) then
    raise exception 'Only the leader can start a session';
  end if;

  -- No active session on this watchlist
  if exists (
    select 1 from public.sessions
    where watchlist_id = p_watchlist_id and status = 'active'
  ) then
    raise exception 'An active session already exists for this watchlist';
  end if;

  -- At least 2 items
  if array_length(p_item_ids, 1) < 2 then
    raise exception 'At least 2 items required to start a session';
  end if;

  -- At least 2 members
  if (
    select count(*) from public.group_members
    where group_id = v_group_id
  ) < 2 then
    raise exception 'At least 2 members required to start a session';
  end if;

  -- Most recent ended session on this watchlist must have an outcome resolved
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

  -- Create session
  insert into public.sessions (watchlist_id, item_ids, end_time)
  values (p_watchlist_id, p_item_ids, now() + p_duration)
  returning * into v_session;

  -- Snapshot participants (current group members)
  insert into public.session_participants (session_id, user_id)
  select v_session.id, gm.user_id
  from public.group_members gm
  where gm.group_id = v_group_id;

  -- Auto-votes: each member auto-votes yes on items they added
  for v_item_id, v_item_owner in
    select i.id, i.added_by
    from public.items i
    where i.id = any(p_item_ids)
  loop
    insert into public.votes (session_id, item_id, user_id, value, is_auto)
    select v_session.id, v_item_id, sp.user_id, true, true
    from public.session_participants sp
    where sp.session_id = v_session.id
      and sp.user_id = v_item_owner;
  end loop;

  return v_session;
end;
$$;

-- ==================== JOIN GROUP ====================
-- Validates invite code, checks not already a member, inserts membership.
create or replace function public.join_group(p_invite_code uuid)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
begin
  -- Find group by invite code
  select * into v_group
  from public.groups
  where invite_code = p_invite_code;

  if v_group.id is null then
    raise exception 'Invalid invite link';
  end if;

  -- Already a member?
  if exists (
    select 1 from public.group_members
    where group_id = v_group.id and user_id = auth.uid()
  ) then
    return v_group;
  end if;

  -- Join
  insert into public.group_members (group_id, user_id)
  values (v_group.id, auth.uid());

  return v_group;
end;
$$;

-- ==================== TRANSFER LEADER AND LEAVE ====================
-- Updates leader_id, removes outgoing leader from members, all in one transaction.
create or replace function public.transfer_leader(
  p_group_id      uuid,
  p_new_leader_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Must be current leader
  if not public.is_group_leader(p_group_id) then
    raise exception 'Only the leader can transfer leadership';
  end if;

  -- New leader must be a member
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_new_leader_id
  ) then
    raise exception 'New leader must be a group member';
  end if;

  -- Cannot transfer to self
  if p_new_leader_id = auth.uid() then
    raise exception 'Cannot transfer leadership to yourself';
  end if;

  -- Transfer leadership
  update public.groups
  set leader_id = p_new_leader_id
  where id = p_group_id;

  -- Remove outgoing leader from members
  delete from public.group_members
  where group_id = p_group_id
    and user_id = auth.uid();
end;
$$;

-- ==================== CLOSE EXPIRED SESSIONS ====================
-- Called by pg_cron every minute. Idempotent — safe to re-run on already-closed sessions.
create or replace function public.close_expired_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set status = 'ended',
      end_reason = 'time_limit'
  where status = 'active'
    and end_time <= now();
end;
$$;
