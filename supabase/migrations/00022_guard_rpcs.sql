create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_group_leader(p_group_id) then
    raise exception 'Only the leader can delete the group';
  end if;
  delete from public.groups where id = p_group_id;
end;
$$;

create or replace function public.update_group_name(p_group_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_group_leader(p_group_id) then
    raise exception 'Only the leader can rename the group';
  end if;
  update public.groups set name = p_name where id = p_group_id;
end;
$$;

create or replace function public.end_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_group_leader(public.get_session_group_id(p_session_id)) then
    raise exception 'Only the leader can end a session';
  end if;
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
set search_path to 'public'
as $$
begin
  if not public.is_group_leader(public.get_session_group_id(p_session_id)) then
    raise exception 'Only the leader can resolve a session';
  end if;

  update public.sessions set outcome = p_outcome where id = p_session_id;

  if p_outcome = 'discarded' and p_discard_item_ids is not null and array_length(p_discard_item_ids, 1) > 0 then
    update public.items set removed_at = now()
    where id = any(p_discard_item_ids)
      and watchlist_id = (select watchlist_id from public.sessions where id = p_session_id);
  end if;
end;
$$;

create or replace function public.toggle_item_watched(p_item_id uuid, p_watched boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_group_member(public.get_item_owner_group_id(p_item_id)) then
    raise exception 'Not a member of this group';
  end if;
  update public.items set watched = p_watched where id = p_item_id;
end;
$$;

create or replace function public.remove_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_group_member(public.get_item_owner_group_id(p_item_id)) then
    raise exception 'Not a member of this group';
  end if;
  update public.items set removed_at = now() where id = p_item_id;
end;
$$;

create or replace function public.remove_items(p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from unnest(p_item_ids) as t(id)
    where not public.is_group_member(public.get_item_owner_group_id(t.id))
  ) then
    raise exception 'Not a member of this group';
  end if;
  update public.items set removed_at = now() where id = any(p_item_ids);
end;
$$;

create or replace function public.get_genre_blacklist(p_group_id uuid)
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_genres text[];
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;
  select array_agg(genre) into v_genres
  from public.group_genre_blacklist
  where group_id = p_group_id;
  return coalesce(v_genres, '{}');
end;
$$;

create or replace function public.get_group_genres(p_group_id uuid)
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_genres text[];
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;
  select coalesce(array_agg(distinct g.genre order by g.genre), '{}') into v_genres
  from public.items i
  join public.watchlists w on w.id = i.watchlist_id
  cross join lateral unnest(i.genres) as g(genre)
  where w.group_id = p_group_id
    and i.removed_at is null
    and i.genres is not null
    and array_length(i.genres, 1) > 0;
  return v_genres;
end;
$$;

drop function public.add_item(uuid, text, text, text, integer, text);
drop function public.add_item(uuid, text, text, text, integer, text, numeric, text[]);

revoke execute on function public.add_genre_blacklist(uuid, text[]) from public, anon;
revoke execute on function public.add_item(uuid, text, text, text, integer, text, numeric, text[], integer) from public, anon;
revoke execute on function public.cast_vote(uuid, uuid, boolean) from public, anon;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.create_watchlist(uuid, text) from public, anon;
revoke execute on function public.delete_group(uuid) from public, anon;
revoke execute on function public.delete_vote(uuid, uuid) from public, anon;
revoke execute on function public.end_session(uuid) from public, anon;
revoke execute on function public.get_genre_blacklist(uuid) from public, anon;
revoke execute on function public.get_group_genres(uuid) from public, anon;
revoke execute on function public.join_group(uuid) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
revoke execute on function public.remove_genre_blacklist(uuid, text[]) from public, anon;
revoke execute on function public.remove_item(uuid) from public, anon;
revoke execute on function public.remove_items(uuid[]) from public, anon;
revoke execute on function public.resolve_outcome(uuid, text, uuid[]) from public, anon;
revoke execute on function public.start_session(uuid, uuid[], interval) from public, anon;
revoke execute on function public.toggle_item_watched(uuid, boolean) from public, anon;
revoke execute on function public.transfer_leader(uuid, uuid) from public, anon;
revoke execute on function public.update_group_name(uuid, text) from public, anon;
revoke execute on function public.update_user_profile(text) from public, anon;

grant execute on function public.add_genre_blacklist(uuid, text[]) to authenticated;
grant execute on function public.add_item(uuid, text, text, text, integer, text, numeric, text[], integer) to authenticated;
grant execute on function public.cast_vote(uuid, uuid, boolean) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.create_watchlist(uuid, text) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.delete_vote(uuid, uuid) to authenticated;
grant execute on function public.end_session(uuid) to authenticated;
grant execute on function public.get_genre_blacklist(uuid) to authenticated;
grant execute on function public.get_group_genres(uuid) to authenticated;
grant execute on function public.join_group(uuid) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.remove_genre_blacklist(uuid, text[]) to authenticated;
grant execute on function public.remove_item(uuid) to authenticated;
grant execute on function public.remove_items(uuid[]) to authenticated;
grant execute on function public.resolve_outcome(uuid, text, uuid[]) to authenticated;
grant execute on function public.start_session(uuid, uuid[], interval) to authenticated;
grant execute on function public.toggle_item_watched(uuid, boolean) to authenticated;
grant execute on function public.transfer_leader(uuid, uuid) to authenticated;
grant execute on function public.update_group_name(uuid, text) to authenticated;
grant execute on function public.update_user_profile(text) to authenticated;

-- New functions would otherwise be callable by anon again through Supabase's default grants.
alter default privileges in schema public revoke execute on functions from public, anon;
