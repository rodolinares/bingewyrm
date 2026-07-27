# Product Requirements Document: BingeWyrm (Group Watchlist)

> **Post-PRD additions (implemented beyond this spec):**
> - **Genre blacklist**: Per-group leader-managed blacklist (`group_genre_blacklist` table, RPCs in migration 00011). Items matching blacklisted genres excluded from session-eligible pools. UI in group settings.
> - **Client-side sort**: Watchlist detail items sortable by title, year, rating, added_at. Persisted in localStorage, not server-side.
> - **Batch remove**: `remove_items` RPC for multi-select delete in watchlist edit mode.
> - **Rating/genre storage**: `vote_average` and `genres` columns on `items` table, populated at add-time from source API. Used for sort and blacklist filtering.

> **PRD corrections:**
> - `docs/bingewyrm-theme.css` is a reference copy; actual tokens live in `src/index.css` under `@theme inline`.

## 1. Summary

BingeWyrm is a web app that lets a group of users maintain shared watchlists of movies, series, anime, and anime movies, then narrow a given watchlist down through a swipe-based voting session, producing a ranked result the group can commit to or discard. Each watchlist holds exactly one media type; a group may maintain several watchlists, one per type.

## 2. Goals

- Let any group member contribute candidates to a shared list with zero friction.
- Let a group leader convert that list into a fast, low-effort voting session.
- Produce a ranked, transparent result that resolves group indecision.
- Support repeated voting rounds on the same underlying watchlist.

## 3. Non-Goals

- Streaming availability lookup (where to watch).
- Individual (non-group) watchlists.
- Content recommendations or personalization.
- Real-time chat or discussion features.
- Mixed-type watchlists (a single watchlist combining, for example, movies and anime).

## 4. User Roles

A person creates a group and becomes its leader, then invites other people to join as members. Group creation prompts for a name at creation time — there's no default/placeholder name. Membership, and the leader role, exist at the group level only, not per watchlist; a group's members and permissions apply uniformly across all of that group's watchlists. A user can belong to multiple groups; a groups list/switcher shows all of them.

| Role | Permissions |
|---|---|
| Leader (group creator) | All member permissions, plus: start/end voting sessions, remove members, delete items, save/recycle/discard results, delete the group |
| Member | Add items to the watchlist, vote during sessions, view results, leave group |

Exactly one leader per group at creation. Group name is editable after creation, leader-only, consistent with the rest of group settings. Only the leader can delete a group, at any time — not just in the sole-member-leaving case. Deletion is a hard cascade delete (watchlists, items, sessions, and votes all removed with the group; no soft-delete or history retention, since no member remains to view it), gated by an explicit confirmation dialog given it's irreversible. A leader cannot simply leave the group: to leave, they must first designate an existing member as the new leader. This is a single combined action — selecting a successor and confirming both transfers the role and removes the outgoing leader from the group immediately, in the same step, rather than demoting them to a regular member who must then separately choose to leave. A leader who is the group's only member must delete the group instead of leaving, since there is no member to transfer to. The action is a "Transfer Leadership" screen (not an inline per-row action) with a member picker and confirmation, gated behind a confirmation dialog — a dedicated screen for this one because it's rare, irreversible, and combined with leaving, unlike lower-stakes settings actions.

A user can belong to any number of groups, with no cap.

## 5. Core Flows

### 5.1 Watchlist Creation and Media Type

- A watchlist belongs to a group and holds items of exactly one media type: **movie**, **series**, **anime**, or **anime movie**. *Modification: not in the original concept, added at the user's request. Anime movies are split out from both "anime" (series) and "movie" because they behave like a distinct voting pool: a group choosing between anime series episodes-per-week commitment and a group choosing a single two-hour anime film are different decisions, and lumping them with either general movies or ongoing anime series would blur that.*
- A group can have at most 4 watchlists, one per media type; a group cannot have two watchlists of the same type. *Modification: not in the original concept, added at the user's request. Membership and the leader role live at the group level (Section 4), so watchlists are scoped as sub-lists of a single group rather than independent lists with their own membership; capping at one per type keeps the set of a group's watchlists predictable (at most 4, always distinguishable by type) instead of open-ended.*
- The media type is set when the watchlist is created and cannot be changed afterward.
- Any member can create a watchlist for the group, for any type the group doesn't already have. This is available two ways: an explicit "Create watchlist" button on the group page, and an inline prompt when a member searches for an item under a type the group has no watchlist for yet (the search flow offers to create it on the spot).

### 5.2 Watchlist Management

- Any member can add an item to a given watchlist via search against the media data source (Section 8) or manual entry. The item's type is fixed to the watchlist's media type; the add-item search is scoped accordingly (e.g., a search from within an anime-movie watchlist only returns anime films). Search is live-as-you-type with a debounce (~300ms), not submit-triggered.
- **Manual entry** fields are limited to title and year, both required — no poster field. Year is a plain number input (not a date/year picker), required specifically because duplicate detection for manual entries keys on title+year (Section 5.2); an optional year would break that check. A manually-entered item renders with a placeholder poster rather than asking the user to source an image.
- Each item stores: title, poster/thumbnail, year, source (`tmdb`/`anilist`/`manual`), source_id (external API id, null for manual entries), added-by user, added-at timestamp. `source` is kept as its own field even though it's inferable from the watchlist's media type in the TMDb/AniList cases, since it also needs to represent manual entries.
- **Duplicate detection**: enforced at the database level via two partial unique indexes, not an application-code check-before-insert (which would race if two members add the same item at nearly the same time). One index on `(watchlist_id, source_id)` covers TMDb/AniList entries; one on `(watchlist_id, lower(title), year)` covers manual entries. Both indexes are scoped `WHERE removed_at IS NULL`, so a soft-deleted (discarded or removed) item doesn't permanently block re-adding the same title later — only currently-active items count as duplicates. A duplicate insert is rejected by the database and the app shows the existing entry instead. *Modification: not in the original concept. Prevents the list from filling with redundant entries and avoids splitting votes for the same title across duplicate rows.*
- Any member can remove an item they personally added. Only the leader can remove items added by others. This "Remove item" action is available any time outside an active session (a locked session's pool can't be edited — Section 5.3), and it soft-deletes (`removed_at`), matching the discard mechanism, for the same reason: a hard delete would orphan the item's `item_ids[]` reference in any past session that included it, not just the current one.
- The **watched** flag (Section 5.6) is a toggle per item, shown in the saved watchlist view. Any member can toggle it, not just the leader.
- Item lists load in full, no pagination or virtualization — a group watchlist is expected to stay in the dozens of items at most.

### 5.3 Starting a Voting Session

- Only the leader can start a session, scoped to a single watchlist. Starting a session is a dedicated screen (not a modal) — a checkbox list of eligible items plus the time-limit setting, since the item list can be long and the swipe UI this leads into is mobile-first.
- At session start, the leader selects which items from that watchlist are included, via a checkbox list defaulting to all items not marked watched (deselectable). An item that lost a previous vote is still eligible again — only `watched` permanently excludes an item from future session pools. This item set is **locked** for the duration of the session: items added to the watchlist afterward join the pool for the *next* session, not the active one. Item deletion by the leader (Section 5.2) only ever applies at the watchlist level — a locked session's item pool cannot be edited once started.
- The group's member list at that moment is also **locked** as the session's participant set (a snapshot, separate from the group's live membership), so the "fraction of eligible voters" shown in results (Section 5.6) stays stable even if someone joins or leaves the group afterward.
- A watchlist can have **at most one active session** at a time.
- **A session requires a minimum of 2 items and 2 members to start.** *Modification: not in the original concept. Prevents degenerate sessions (e.g., a single-item or single-member "vote") that produce meaningless results.*

### 5.4 Voting

- Each member swipes through the included items one at a time, Tinder-style: swipe right (or tap yes) to vote for, swipe left (or tap no) to skip.
- A member cannot vote on an item they personally added. That item is excluded from their swipe stack. Its "yes" auto-vote is a real row in the votes table (`is_auto: true`, `user_id`: the item's adder), inserted when the session starts and the item pool locks — this keeps vote tallying uniform (count rows) instead of special-casing self-added items at query time.
- Each member's swipe order is randomized independently to avoid order bias. The order is generated client-side, deterministically, from the session's item set plus a per-user seed (e.g. user id + session id), rather than stored server-side. This keeps the order stable if a member reloads mid-session, without needing a database table for it.
- **A member can see their own progress (e.g., "6 of 14") but not other members' votes or progress while the session is active.** *Modification: not in the original concept. Prevents bandwagon or anti-bandwagon effects where later voters are influenced by seeing running totals, keeping votes independent.*

### 5.5 Session End Condition

The session ends when **either** of the following is met, whichever comes first:

- **All-voted**: every member has voted (or auto-voted, for self-added items) on every item in the session.
- **Time limit**: a configurable session duration expires (default 1 hour, leader-adjustable at session start, minimum 1 minute, maximum 24 hours). The control is preset buttons (1m / 15m / 1h / 6h / 24h) with a custom input as a fallback, rather than a slider or bare number field. Expiry is enforced by a **pg_cron** job (Supabase Postgres extension) running every minute, closing any session past its end_time. The client also performs a lazy expiry check on fetch, so a member doesn't see a stale "active" session in the UI while waiting for the next cron tick; the cron job remains the source of truth for actually closing it.

*Modification: the concept asked for one best-fit condition; a hybrid was chosen instead. An all-voted-only condition risks stalling indefinitely if one member goes inactive. A time-limit-only condition risks ending sessions before engaged members finish. Combining both guarantees the session always resolves while still rewarding full participation when it happens quickly.*

The leader can also manually end a session early at any time. A manual end is treated identically to the all-voted case: results are computed from whatever votes have been cast, and the leader proceeds to save/recycle/discard as normal.

### 5.6 Results

- On session end, items are ranked by vote count, descending.
- **Ties are broken by earliest added-at timestamp (older item ranks higher).** *Modification: not in the original concept. Avoids an unresolved tie state in the ranked results without requiring a manual leader decision or random tiebreak.*
- Each item's result view shows: rank, vote count, and vote count as a fraction of eligible voters (e.g., "4/5"). The denominator is fixed at session start via the participant snapshot (Section 5.3), not recalculated from current group membership — so a member leaving mid-session doesn't retroactively shift the percentages of votes already cast.
- The leader chooses one of three outcomes:
  - **Save**: recorded as `outcome: saved` on the session — there is no separate "to watch" table. The watchlist's current ranked list is simply its most recently saved session's results; items remain on the watchlist, and `watched` (toggleable any time, but only takes effect on future session pools — never on an already-locked active session) is the only removal mechanism. Items can be marked watched, which removes them from future session pools by default. *Modification: a "watched" flag was not in the original concept. Without it, a saved list has no way to shrink over time, and previously watched items would keep reappearing in future voting pools.*
  - **Recycle**: the session is marked ended with `outcome: recycled`; no explicit vote-clearing is needed, since votes are scoped to their session (Section 6) and a future new session simply starts with none. The watchlist and its items are untouched, and members can keep adding to it before the next session. *Modification: not in the original concept, added at the user's request. Lets a group re-vote or keep refining the same list over time without losing what's already been added.*
  - **Discard**: the session is marked ended with `outcome: discarded`, and the watchlist's items are **soft-deleted** — marked `removed_at`, not hard-deleted. Hard-deleting the rows would orphan `item_ids[]` references in any other session on the same watchlist (past `saved`/`recycled` sessions that included the same items, not just this one), breaking their history. The active watchlist view filters out removed items; the `Watchlist` row itself (and its media type) is kept, so the group's "one watchlist per type" slot isn't lost and doesn't need re-creating. If a discard leaves the watchlist with no items left, it behaves exactly like a brand-new watchlist — normal empty state, members add items normally — rather than needing special handling.

Every ended session's results remain queryable by session id, forming a history; the watchlist's "current" results view defaults to its most recently ended session, shown as a section on the watchlist's own page rather than a separate route. If no session has been saved yet, this section shows an empty state with a call to action into the start-session flow, rather than being hidden. Past sessions are reachable through a separate history view. The leader isn't forced to decide save/recycle/discard immediately and can revisit later — but a watchlist cannot start a new session while its most recent ended session still has no `outcome` set, since an unresolved outcome would make "the current list" ambiguous. That decision must be resolved before the next session can begin.

## 6. Data Model (high level)

- **User**: id, display_name, google_account_id
- **Group**: id, name, leader_id, members[], invite_code
- **Watchlist**: id, group_id, media_type (movie/series/anime/anime_movie), created_by, created_at
- **Item**: id, watchlist_id, title, source, source_id, year, poster_path, added_by, added_at, watched (bool), removed_at (nullable, set on discard). `year` and `poster_path` are direct columns (not a JSONB metadata blob) for simpler querying and indexing; a JSONB column can be added later if richer metadata is ever needed, but nothing calls for it now. `poster_path` stores the relative path returned by the source API (TMDb's own documented pattern — base URL + size + path), with the full image URL constructed at render time; this lets poster resolution change later (e.g. `w342` → `w500`) without a migration.
- **Session**: id, watchlist_id, item_ids[], status (active/ended), start_time, end_time, end_reason (all_voted/time_limit/manual), outcome (saved/recycled/discarded, null until the leader decides)
- **SessionParticipant**: id, session_id, user_id — snapshot of the group's members at session start, fixing the eligible-voter denominator regardless of later membership changes
- **Vote**: id, session_id, item_id, user_id, value (yes/no), is_auto (bool, true for self-added items)

## 7. Edge Cases

- A member joins the group after a session has started: excluded from that session, included in future ones.
- A member leaves the group mid-session: their unfinished votes are dropped; already-cast votes remain counted, and they still count in the eligible-voter denominator since that's fixed by the session's participant snapshot (Section 5.3) taken at session start, not live membership.
- All items in a session were added by the same single member: session still runs for other members' votes; if only one member exists, session cannot start (minimum 2 members required).
- An item has zero eligible voters (e.g., a 2-member group where both members added items and neither can vote on the other's): the item's vote count is decided entirely by auto-votes from additions.
- A group has no watchlists yet: the first member to add an item is prompted to create a watchlist and choose its media type.
- The leader attempts to leave with no other members in the group: leaving is blocked; they must delete the group instead.

## 8. Media Data Source

Two sources are needed to cover all four media types: one for movies/series, one for anime/anime movies. A single source does not cover both well.

### 8.1 Movies and Series — TMDb (The Movie Database)

- Free for non-commercial use with attribution; a free API key is issued instantly, no cost tier to start.
- Deep catalog: titles, posters, backdrops, cast/crew, release dates, multilingual metadata, and a REST v3 API that is well documented and actively maintained.
- Rate limit is generous enough for a group-sized app (effectively tens of requests per second).
- Attribution ("This product uses the TMDb API but is not endorsed or certified by TMDb") is required in the UI, placed once as a persistent app-wide footer credit rather than repeated per-page.
- OMDb is a viable fallback for a secondary poster/rating source but is narrower (movie-focused, thin TV data, 1,000 requests/day free cap) and is not needed as a primary source given TMDb's coverage.

### 8.2 Anime and Anime Movies — AniList

- Free, GraphQL-based, no API key required to start; rate limit is roughly 90 requests/minute, sufficient for this app's scale.
- Purpose-built anime/manga schema (titles in romaji/English/native, format, episode counts, scores, cover images, studios), which TMDb does not model well for anime-specific detail.
- AniList's `Media.format` field distinguishes `TV` (anime series) from `MOVIE` (anime movie), so the same source and a single format filter serve both watchlist types without a second integration. Confirmed mapping: the `anime` watchlist filters to `TV, ONA, OVA, SPECIAL`; the `anime_movie` watchlist filters to `MOVIE` only.
- Jikan (unofficial MyAnimeList REST API) is a comparable alternative if a REST-only stack is preferred over GraphQL; AniList is recommended here for its typed schema and official (non-scraped) status.

### 8.3 Integration Notes

- Item search on add queries TMDb (movie/series watchlists) through the Edge Function proxy, or AniList directly from the client with a format filter (anime/anime-movie watchlists), matching the watchlist's fixed media type. AniList needs no proxy — there's no key to protect, and its rate limit is well beyond this app's scale.
- The item's source and source_id are stored (Section 6) so metadata can be refreshed later without re-matching by title.

## 9. Visual Style

- Theme: cinema/theater marquee, evoking the feel of a movie premiere or theater lobby rather than a generic productivity app.
- Palette: warm amber, rust-orange, and deep maroon as the active/primary colors, set against a near-black base, with a cooler slate-teal/sage neutral as the resting/secondary tone so the UI isn't uniformly warm.
- Dark mode is the default theme; light mode is supported as a secondary option.
- Tokens are defined as shadcn/ui-compatible CSS variables in `bingewyrm-theme.css`, covering both light and dark mode plus two app-specific tokens: `vote-yes` / `vote-no` for the swipe-vote UI, and `marquee-highlight` for calling out the top-ranked result.
- Implementation must use these tokens as-is rather than a substitute or default shadcn palette.

## 10. Authentication and Onboarding

- **Sign-in method: Google OAuth only** for v1, via Supabase Auth. No email/password option. Removes password-reset flows and keeps the invite-link-to-join path low-friction (click link, sign in with Google, done).
- **First-time onboarding**: on account creation, the user is prompted to set a display name or nickname before they can access any group. This is enforced as a full-page redirect (e.g. `/onboarding`), not a modal, so it can't be dismissed or bypassed, and route access is gated on `display_name` being set. This name (not their Google account name) is what's shown to other members throughout the app. Constraints: 2–30 characters, Unicode letters, spaces, apostrophes, and hyphens allowed (not ASCII-only, to accommodate names like "José" or "O'Brien"); no uniqueness requirement, since members are distinguished by user id, not name.

## 11. Group Invites

- Each group has a single shareable invite link/code, visible to all members but only regenerable by the leader. Any member can view and copy/share the link; regeneration is leader-only. The code is a UUID (`gen_random_uuid()`), generated in Postgres with no extra dependency — length doesn't matter for UX since the link is always clicked, never typed.
- Regenerating the link invalidates the previous one, revoking access for anyone who hadn't used it yet.
- Anyone who opens a valid invite link and signs in with Google is automatically added to the group as a member; no leader approval step is required. The link resolves to a route like `/invite/:code`. If they aren't signed in yet, they sign in first, then are auto-joined immediately; if already signed in, the join is instant. There is no separate "join this group?" gate before joining, since opening the link is itself the intent signal. After joining, a brief confirmation ("You've joined `<Group Name>`") is shown so they know what happened.

## 12. Realtime Updates

Supabase Realtime is used narrowly, scoped to two things:

- **Session status changes**: when a session ends (any reason), subscribed clients are notified so results appear without polling.
- **Watchlist item changes**: when a member adds an item, other members see it appear live.

Realtime is **not** used for individual vote counts or in-progress voting activity — pushing that would undermine the hidden-progress rule in Section 5.4.

## 13. Infrastructure Setup

- The pg_cron job (Section 5.5) is defined in a versioned SQL migration file, not configured manually via the Supabase dashboard, so a fresh environment can be stood up reproducibly.
- **Profile creation**: a database trigger on `auth.users` insert creates the corresponding `User`/profile row (with `display_name` null) in the same transaction as sign-up, rather than a client-side Edge Function call after the OAuth callback. This does not require a service role key in the migration — the trigger function is `SECURITY DEFINER` (with an explicit `search_path` set) so it can write to the profile table entirely within Postgres. No Edge Function fallback is needed alongside it.
- **Atomic multi-step actions** are implemented as Postgres RPC functions (transactional), not sequences of separate client-side writes: starting a session (validate no active session exists, validate ≥2 items and ≥2 members, lock the item pool, snapshot participants, insert auto-votes, set end_time), joining via invite link (validate code, check not already a member, insert membership), and leader transfer-and-leave (update `leader_id`, remove the outgoing leader). Splitting any of these into multiple client-side writes risks a partial, inconsistent state if one step fails mid-sequence.
- The **TMDb proxy** (Section 8.3) runs as a standard Supabase Edge Function (Deno runtime) — not a Postgres function calling out via `pg_net`. Deno Edge Functions have better local dev and testing tooling and are the idiomatic Supabase path for this kind of proxy.
