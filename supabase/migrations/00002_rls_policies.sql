-- BingeWyrm: Row Level Security policies
-- Helper functions first, then per-table policies.

-- ==================== HELPER FUNCTIONS ====================
-- These are SECURITY DEFINER to avoid recursive RLS checks.
-- search_path is locked to public to prevent search_path injection.

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_leader(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.groups
    where id = p_group_id
      and leader_id = auth.uid()
  );
$$;

create or replace function public.get_item_owner_group_id(p_item_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select w.group_id
  from public.items i
  join public.watchlists w on w.id = i.watchlist_id
  where i.id = p_item_id;
$$;

create or replace function public.get_watchlist_group_id(p_watchlist_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from public.watchlists where id = p_watchlist_id;
$$;

create or replace function public.get_session_group_id(p_session_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select w.group_id
  from public.sessions s
  join public.watchlists w on w.id = s.watchlist_id
  where s.id = p_session_id;
$$;

-- ==================== ENABLE RLS ====================
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.watchlists enable row level security;
alter table public.items enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.votes enable row level security;

-- ==================== USERS ====================
create policy "Users: anyone can read profiles"
  on public.users for select
  to authenticated
  using (true);

create policy "Users: update own profile"
  on public.users for update
  to authenticated
  using (id = auth.uid());

-- ==================== GROUPS ====================
create policy "Groups: members can read"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "Groups: authenticated can create"
  on public.groups for insert
  to authenticated
  with check (leader_id = auth.uid());

create policy "Groups: leader can update"
  on public.groups for update
  to authenticated
  using (public.is_group_leader(id));

create policy "Groups: leader can delete"
  on public.groups for delete
  to authenticated
  using (public.is_group_leader(id));

-- ==================== GROUP MEMBERS ====================
create policy "GroupMembers: members can read"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "GroupMembers: leader can manage"
  on public.group_members for all
  to authenticated
  using (public.is_group_leader(group_id))
  with check (public.is_group_leader(group_id));

-- ==================== WATCHLISTS ====================
create policy "Watchlists: members can read"
  on public.watchlists for select
  to authenticated
  using (public.is_group_member(public.get_watchlist_group_id(id)));

create policy "Watchlists: members can create"
  on public.watchlists for insert
  to authenticated
  with check (public.is_group_member(group_id));

-- ==================== ITEMS ====================
create policy "Items: members can read"
  on public.items for select
  to authenticated
  using (public.is_group_member(public.get_item_owner_group_id(id)));

create policy "Items: members can insert"
  on public.items for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and public.is_group_member(public.get_watchlist_group_id(watchlist_id))
  );

create policy "Items: owner can delete own (outside sessions)"
  on public.items for delete
  to authenticated
  using (added_by = auth.uid());

create policy "Items: leader can delete any"
  on public.items for delete
  to authenticated
  using (public.is_group_leader(public.get_item_owner_group_id(id)));

create policy "Items: members can update watched flag"
  on public.items for update
  to authenticated
  using (public.is_group_member(public.get_item_owner_group_id(id)));

-- ==================== SESSIONS ====================
create policy "Sessions: members can read"
  on public.sessions for select
  to authenticated
  using (public.is_group_member(public.get_session_group_id(id)));

create policy "Sessions: leader can insert"
  on public.sessions for insert
  to authenticated
  with check (public.is_group_leader(public.get_session_group_id(watchlist_id)));

create policy "Sessions: leader can update"
  on public.sessions for update
  to authenticated
  using (public.is_group_leader(public.get_session_group_id(id)));

-- ==================== SESSION PARTICIPANTS ====================
create policy "SessionParticipants: members can read"
  on public.session_participants for select
  to authenticated
  using (public.is_group_member(public.get_session_group_id(session_id)));

-- ==================== VOTES ====================
create policy "Votes: own votes readable during active session"
  on public.votes for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_group_member(public.get_session_group_id(session_id))
  );

create policy "Votes: all votes readable on ended session"
  on public.votes for select
  to authenticated
  using (
    exists (
      select 1 from public.sessions
      where id = session_id and status = 'ended'
    )
    and public.is_group_member(public.get_session_group_id(session_id))
  );

create policy "Votes: members can insert own votes"
  on public.votes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_auto = false
    and exists (
      select 1 from public.sessions
      where id = session_id and status = 'active'
    )
    and public.is_group_member(public.get_session_group_id(session_id))
  );
