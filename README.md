# BingeWyrm

A group watchlist + swipe-vote web app. Add movies, series, or anime to shared
watchlists, then run timed voting sessions where members swipe to keep or discard.

## Features

- **Google OAuth** — sign in with Google, display name onboarding
- **Groups** — create groups, invite via UUID link, leader manages members
- **Watchlists** — per-group, per-media-type (Movies, Series, Anime, Anime Movies)
- **Search** — TMDb for movies/series (proxied via Supabase Edge Function), AniList for anime (direct GraphQL)
- **Voting sessions** — leader starts a session, members vote yes/no on each item, timed or manual end
- **Results** — save, recycle, or discard based on votes
- **Realtime** — live item additions + session-ended notifications via Supabase Realtime
- **Touch-first** — swipe gestures on mobile, responsive layout, bottom tab nav

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind v4, shadcn/ui (base-ui)
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions, pg_cron)
- **Routing:** React Router v8
- **State:** TanStack Query
- **Forms:** React Hook Form + Zod v4
- **Deploy:** Netlify

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A Supabase project ([supabase.com](https://supabase.com))

### Setup

```bash
git clone https://github.com/rodolinares/bingewyrm.git
cd bingewyrm
pnpm install
```

Create `.env` from the example:

```bash
cp .env.example .env
```

Fill in your Supabase URL and anon key:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database

Run all migrations in `supabase/migrations/` against your Supabase project
(in order). The migrations create:

- Tables: `users`, `groups`, `group_members`, `watchlists`, `items`, `sessions`, `session_participants`, `votes`
- RLS policies for all tables
- SECURITY DEFINER RPCs for all write operations (required — `auth.uid()` returns NULL in INSERT WITH CHECK context)
- pg_cron job to auto-close expired sessions

### Edge Functions

Deploy the TMDb search proxy:

```bash
supabase functions deploy tmdb-search
```

### Auth

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** your deployed URL (or `http://localhost:5173` for dev)
- **Redirect URLs:** add both your dev and production URLs

Enable Google provider in Authentication → Providers.

### Development

```bash
pnpm dev
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Type-check + build |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier (src only) |

## Project Structure

```
src/
  components/
    group/          create-group-dialog, create-watchlist-dialog
    ui/             button, dialog (shadcn/base-ui)
    watchlist/      add-item-dialog
  hooks/            use-user, use-realtime
  lib/              supabase client, anilist GraphQL, shuffle, utils
  pages/
    auth/           login, callback
    groups/         group list, group layout, settings
    watchlist/      detail, start-session, history
    session/        voting, results
    invite/         auto-join
    onboarding/     display name form
  queries/          groups, watchlists, sessions (TanStack Query hooks)
supabase/
  functions/        tmdb-search Edge Function
  migrations/       00001–00010 SQL migrations
```

## Architecture Notes

- **All writes go through SECURITY DEFINER RPCs.** Direct table inserts fail due to `auth.uid()` returning NULL in INSERT WITH CHECK context (known Supabase issue). Every mutation uses `supabase.rpc(...)` — never `.insert()`, `.update()`, or `.delete()`.
- **SECURITY INVOKER causes infinite recursion** on helper functions (`is_group_member`, `is_group_leader`, etc.) via RLS. These must remain SECURITY DEFINER.
- **Voting order is deterministic client-side**, seeded per-user per-session. Not stored server-side.
- **Session expiry** is handled by pg_cron (every minute). Client-side also checks lazily on page load.
- **Realtime** is scoped to item additions + session status changes only. Vote counts are not realtime.
- **TMDb requests are proxied** through a Supabase Edge Function to keep the API key server-side. AniList GraphQL is called directly from the client (no API key required).

## License

Private. All rights reserved.
