-- BingeWyrm: client-side sort support + batch remove RPC

-- Add vote_average column for rating sort
alter table public.items add column if not exists vote_average numeric;

comment on column public.items.vote_average is 'Rating from source API (TMDb 0-10 / AniList 0-10) for client-side sort.';

-- Add genres column for blacklist (populated at add-time)
alter table public.items add column if not exists genres text[] not null default '{}';

comment on column public.items.genres is 'Genre tags from source API, used for group-level blacklist filtering.';

-- Update add_item to accept vote_average and genres
create or replace function public.add_item(
  p_watchlist_id uuid,
  p_title text,
  p_source text,
  p_source_id text,
  p_year integer,
  p_poster_path text,
  p_vote_average numeric default null,
  p_genres text[] default '{}'
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

  insert into public.items (watchlist_id, title, source, source_id, year, poster_path, vote_average, genres, added_by)
  values (p_watchlist_id, p_title, p_source, p_source_id, p_year, p_poster_path, p_vote_average, p_genres, auth.uid())
  returning * into v_item;

  return v_item;
end;
$$;

-- Batch remove items
create or replace function public.remove_items(p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.items set removed_at = now() where id = any(p_item_ids);
end;
$$;

-- Genre blacklist table
create table if not exists public.group_genre_blacklist (
  group_id uuid not null references public.groups(id) on delete cascade,
  genre    text not null,
  primary key (group_id, genre)
);

comment on table public.group_genre_blacklist is 'Per-group genre blacklist. Items with these genres are excluded from session-eligible items.';

create or replace function public.add_genre_blacklist(p_group_id uuid, p_genres text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_leader(p_group_id) then
    raise exception 'Only the leader can manage genre blacklist';
  end if;
  insert into public.group_genre_blacklist (group_id, genre)
  select p_group_id, unnest(p_genres)
  on conflict do nothing;
end;
$$;

create or replace function public.remove_genre_blacklist(p_group_id uuid, p_genres text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_leader(p_group_id) then
    raise exception 'Only the leader can manage genre blacklist';
  end if;
  delete from public.group_genre_blacklist
  where group_id = p_group_id
    and genre = any(p_genres);
end;
$$;

create or replace function public.get_genre_blacklist(p_group_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_genres text[];
begin
  select array_agg(genre) into v_genres
  from public.group_genre_blacklist
  where group_id = p_group_id;
  return coalesce(v_genres, '{}');
end;
$$;

create or replace function public.get_group_genres(p_group_id uuid)
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct g.genre order by g.genre), '{}')
  from public.items i
  join public.watchlists w on w.id = i.watchlist_id
  cross join lateral unnest(i.genres) as g(genre)
  where w.group_id = p_group_id
    and i.removed_at is null
    and i.genres is not null
    and array_length(i.genres, 1) > 0;
$$;
