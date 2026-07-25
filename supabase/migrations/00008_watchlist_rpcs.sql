-- BingeWyrm: watchlist RPCs

-- ==================== CREATE WATCHLIST ====================
-- Creates a watchlist for a group. Unique constraint on (group_id, media_type)
-- prevents duplicates at the DB level.
create or replace function public.create_watchlist(
  p_group_id   uuid,
  p_media_type text
)
returns public.watchlists
language plpgsql
security definer
set search_path = public
as $$
declare
  v_watchlist public.watchlists;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a group member';
  end if;

  insert into public.watchlists (group_id, media_type, created_by)
  values (p_group_id, p_media_type, auth.uid())
  returning * into v_watchlist;

  return v_watchlist;
end;
$$;
