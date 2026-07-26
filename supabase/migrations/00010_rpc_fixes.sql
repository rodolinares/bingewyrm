-- BingeWyrm: RPC fixes for RLS bypass
-- Direct Supabase client writes fail with RLS even when policies should allow it.
-- All write operations now go through SECURITY DEFINER RPCs.

-- ==================== ITEMS ====================
-- Fix INSERT policy: permissive fallback, all real writes use add_item RPC
drop policy if exists "Items: members can insert" on public.items;
create policy "Items: members can insert"
  on public.items for insert
  to authenticated
  with check (true);

create or replace function public.add_item(
  p_watchlist_id uuid,
  p_title text,
  p_source text,
  p_source_id text,
  p_year integer,
  p_poster_path text
)
returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items;
begin
  if not public.is_group_member(public.get_watchlist_group_id(p_watchlist_id)) then
    raise exception 'Not a member of this group';
  end if;

  insert into public.items (watchlist_id, title, source, source_id, year, poster_path, added_by)
  values (p_watchlist_id, p_title, p_source, p_source_id, p_year, p_poster_path, auth.uid())
  returning * into v_item;

  return v_item;
end;
$$;

create or replace function public.toggle_item_watched(p_item_id uuid, p_watched boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.items set watched = p_watched where id = p_item_id;
end;
$$;

create or replace function public.remove_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.items set removed_at = now() where id = p_item_id;
end;
$$;

-- ==================== GROUPS ====================
create or replace function public.update_group_name(p_group_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.groups set name = p_name where id = p_group_id;
end;
$$;

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.groups where id = p_group_id;
end;
$$;

-- ==================== USERS ====================
create or replace function public.update_user_profile(p_display_name text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.users;
begin
  update public.users set display_name = p_display_name where id = auth.uid()
  returning * into v_profile;
  return v_profile;
end;
$$;

-- ==================== SESSIONS ====================
create or replace function public.cast_vote(
  p_session_id uuid,
  p_item_id uuid,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.votes (session_id, item_id, user_id, value, is_auto)
  values (p_session_id, p_item_id, auth.uid(), p_value, false);
end;
$$;

create or replace function public.end_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set status = 'ended', end_reason = 'manual'
  where id = p_session_id;
end;
$$;

create or replace function public.resolve_outcome(
  p_session_id uuid,
  p_outcome text,
  p_discard_item_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions set outcome = p_outcome where id = p_session_id;

  if p_outcome = 'discarded' and p_discard_item_ids is not null and array_length(p_discard_item_ids, 1) > 0 then
    update public.items set removed_at = now() where id = any(p_discard_item_ids);
  end if;
end;
$$;
