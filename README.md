# BingeWyrm

A group watchlist + swipe-vote web app. Add movies, series, or anime to shared
watchlists, then run timed voting sessions where members swipe to keep or discard.

## Features

- **Google OAuth** — sign in with Google, display name onboarding
- **Groups** — create groups, invite via UUID link, leader manages members
- **Watchlists** — per-group, per-media-type (Movies, Series, Anime, Anime Movies)
- **Search, batch add & manual entry** — search TMDb/AniList, select multiple items, add in batch, or enter title+year manually
- **Item details** — info panel with overview, rating, genres, runtime before adding
- **Already-added badges** — items already in watchlist shown dimmed with "Added" badge
- **Client-side sort** — sort by title, year, rating, or date added (persisted in localStorage)
- **Genre blacklist** — leader can blacklist genres to exclude items from session pools
- **Voting sessions** — leader starts, members vote yes/no, timed or manual end
- **All members see sessions** — active session / results links visible to everyone
- **Results** — save or discard based on votes
- **Where to watch** — streaming/rent/buy providers in the detail panel, with a region picker
- **User settings** — display name, email, light/dark theme
- **Realtime** — live item additions + session-ended notifications via Supabase Realtime
- **Touch-first** — swipe gestures on mobile, responsive layout, bottom tab nav
- **Invite flow** — new users join group → onboarding → redirected to invited group

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind v4, shadcn/ui (base-ui)
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions, pg_cron)
- **Routing:** React Router v8
- **State:** TanStack Query
- **Forms:** React Hook Form + Zod v4
- **Deploy:** Cloudflare Workers (static assets in `wrangler.toml`)

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

- Tables: `users`, `groups`, `group_members`, `watchlists`, `items`, `sessions`, `session_participants`, `votes`, `group_genre_blacklist`
- RLS policies for all tables
- SECURITY DEFINER RPCs for all write operations (required — `auth.uid()` returns NULL in INSERT WITH CHECK context)
- pg_cron job to auto-close expired sessions

### Edge Functions

Deploy the TMDb search proxy (search + detail endpoints):

```bash
supabase functions deploy tmdb-search
```

The Edge Function provides:

- `GET /tmdb-search?q=...&type=movie|tv` — search with rating + overview
- `GET /tmdb-search/detail/{id}?type=movie|tv&region=XX` — full details (genres, runtime, backdrop) plus watch providers for `region` (default `US`)

### Auth

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** your deployed URL (or `http://localhost:5173` for dev)
- **Redirect URLs:** add both your dev and production URLs

Enable Google provider in Authentication → Providers.

### Deployment

Cloudflare Workers — push to deploy. `wrangler.toml` serves `dist/` as static assets with SPA fallback (`not_found_handling`).

Set env vars in Cloudflare dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Commands

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `pnpm dev`           | Start dev server               |
| `pnpm build`         | Type-check + build             |
| `pnpm lint`          | ESLint                         |
| `pnpm format`        | Prettier (src only)            |
| `pnpm format:check`  | Prettier check without writing |
| `pnpm test`          | Vitest single run              |
| `pnpm test:watch`    | Vitest watch mode              |
| `pnpm test:coverage` | Vitest with coverage report    |

### Git Workflow

- `main` — stable, deployed to production
- `develop` — active development, all work happens here
- Merge `develop` → `main` when ready to release (ask user before merging)

## Project Structure

```
src/
  components/         error-boundary, icons (inline SVG), outcome-badge
    group/            create-group-dialog, create-watchlist-dialog
    ui/               button, dialog, skeleton, spinner, switch (shadcn/base-ui)
    watchlist/        add-item-dialog (search + manual entry, batch add, detail panel),
                      item-detail-panel (overlay with description, rating, genres, where to watch)
  hooks/              use-user, use-realtime, use-theme
  lib/                supabase client, anilist GraphQL, media (TMDb images, providers, region),
                      shuffle, utils (cn helper)
  pages/
    auth/             login, callback
    groups/           group list, group layout (sidebar + bottom nav), settings
    watchlist/        detail (with client-side sort), start-session, history
    session/          voting (swipe), results
    invite/           auto-join
    settings/         user settings (display name, email, theme)
    onboarding.tsx    display name form
  queries/            groups, watchlists, sessions, profile (TanStack Query hooks)
supabase/
  functions/          tmdb-search Edge Function (search + detail + watch providers)
  migrations/         00001–00022 SQL migrations
docs/
  (design tokens live in src/index.css @theme inline)
  bingewyrm-skipped.md     Deferred features tracker
```

## Architecture Notes

- **All writes go through SECURITY DEFINER RPCs.** Direct table inserts fail due to `auth.uid()` returning NULL in INSERT WITH CHECK context (known Supabase issue). Every mutation uses `supabase.rpc(...)` — never `.insert()`, `.update()`, or `.delete()`.
- **SECURITY INVOKER causes infinite recursion** on helper functions (`is_group_member`, `is_group_leader`, etc.) via RLS. These must remain SECURITY DEFINER.
- **Voting order is deterministic client-side**, seeded per-user per-session. Not stored server-side.
- **Session expiry** is handled by pg_cron (every minute). Client-side also checks lazily on page load.
- **Realtime** is scoped to item additions + session status changes only. Vote counts are not realtime.
- **TMDb requests are proxied** through a Supabase Edge Function to keep the API key server-side. AniList GraphQL is called directly from the client (no API key required).
- **Batch item add** uses multi-select with pinned selections across searches. Existing items show "Added" badge. Detail panel fetched lazily on info tap. Manual entry (title + year) available for items not found via API.
- **Client-side sort** on watchlist detail (title, year, rating, date added) persisted in localStorage — no server-side sort state.
- **Genre blacklist** per-group, leader-managed. Items with blacklisted genres are excluded from session-eligible items. Genre data stored at add-time from source API.
- **Invite flow** preserves redirect: `requireOnboarding` passes `?next=` param so new users land on the invited group after onboarding.

## License

Private. All rights reserved.
