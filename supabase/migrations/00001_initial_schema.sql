-- BingeWyrm: initial schema
-- Tables, indexes, and auth user trigger.

-- ==================== EXTENSIONS ====================
create extension if not exists "pgcrypto";

-- ==================== USERS ====================
create table public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  google_account_id text unique not null,
  created_at        timestamptz not null default now()
);

comment on table public.users is 'App profile row, auto-created on auth.users insert via trigger.';

-- ==================== GROUPS ====================
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  leader_id   uuid not null references public.users(id) on delete restrict,
  invite_code uuid unique not null default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

comment on table public.groups is 'A group of users who share watchlists and vote together.';

-- ==================== GROUP MEMBERS ====================
create table public.group_members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

comment on table public.group_members is 'Membership junction. Leader role lives on groups.leader_id, not here.';

-- ==================== WATCHLISTS ====================
create table public.watchlists (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  media_type  text not null check (media_type in ('movie', 'series', 'anime', 'anime_movie')),
  created_by  uuid not null references public.users(id),
  created_at  timestamptz not null default now(),
  unique (group_id, media_type)
);

comment on table public.watchlists is 'One per media type per group, max 4.';

-- ==================== ITEMS ====================
create table public.items (
  id           uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  title        text not null,
  source       text not null check (source in ('tmdb', 'anilist', 'manual')),
  source_id    text,
  year         integer not null,
  poster_path  text,
  added_by     uuid not null references public.users(id),
  added_at     timestamptz not null default now(),
  watched      boolean not null default false,
  removed_at   timestamptz
);

comment on column public.items.removed_at is 'Soft-delete on discard; null means active.';
comment on column public.items.poster_path is 'Relative path from source API (e.g. TMDb pattern). Full URL constructed at render time.';

-- Duplicate detection: TMDb/AniList by source_id (only active items)
create unique index idx_items_source_id
  on public.items (watchlist_id, source_id)
  where source_id is not null and removed_at is null;

-- Duplicate detection: manual by title+year (only active items)
create unique index idx_items_manual
  on public.items (watchlist_id, lower(title), year)
  where source = 'manual' and removed_at is null;

-- ==================== SESSIONS ====================
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  item_ids     uuid[] not null,
  status       text not null default 'active' check (status in ('active', 'ended')),
  start_time   timestamptz not null default now(),
  end_time     timestamptz not null,
  end_reason   text check (end_reason in ('all_voted', 'time_limit', 'manual')),
  outcome      text check (outcome in ('saved', 'recycled', 'discarded')),
  created_at   timestamptz not null default now()
);

comment on column public.sessions.item_ids is 'Locked snapshot of item pool at session start.';
comment on column public.sessions.outcome is 'Null until leader decides save/recycle/discard after session ends.';

-- Only one active session per watchlist
create unique index idx_sessions_one_active
  on public.sessions (watchlist_id)
  where status = 'active';

-- ==================== SESSION PARTICIPANTS ====================
create table public.session_participants (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  unique (session_id, user_id)
);

comment on table public.session_participants is 'Snapshot of group members at session start. Fixes eligible-voter denominator.';

-- ==================== VOTES ====================
create table public.votes (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  item_id    uuid not null references public.items(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  value      boolean not null,
  is_auto    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, item_id, user_id)
);

comment on column public.votes.is_auto is 'True for self-added items (auto-voted yes by the adder at session start).';

-- ==================== AUTH TRIGGER ====================
-- Auto-create profile row on signup. SECURITY DEFINER so it can write
-- to public.users within the same transaction as the auth.users insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, google_account_id)
  values (new.id, new.raw_user_meta_data ->> 'sub');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
