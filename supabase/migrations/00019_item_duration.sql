-- BingeWyrm: item duration (minutes)
-- Per-episode minutes for series/anime, total runtime for movies. Null = unknown.

alter table public.items add column if not exists duration integer;

comment on column public.items.duration is 'Duration in minutes from source API (per-episode for series/anime, full runtime for movies). Null when unknown.';

-- Update add_item to accept duration
create or replace function public.add_item(
  p_watchlist_id uuid,
  p_title text,
  p_source text,
  p_source_id text,
  p_year integer,
  p_poster_path text,
  p_vote_average numeric default null,
  p_genres text[] default '{}',
  p_duration integer default null
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

  insert into public.items (watchlist_id, title, source, source_id, year, poster_path, vote_average, genres, duration, added_by)
  values (p_watchlist_id, p_title, p_source, p_source_id, p_year, p_poster_path, p_vote_average, p_genres, p_duration, auth.uid())
  returning * into v_item;

  return v_item;
end;
$$;
