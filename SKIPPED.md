# Skipped Features

Track features deferred during implementation. Add back when needed.

## Phase 5 — Watchlists

- **Duplicate UX: show existing entry**: PRD §5.2 says on duplicate insert, "the app shows the existing entry instead." Current: error string "This item is already in the watchlist." Fix: on 23505 error, query existing item by source_id (TMDb/AniList) or title+year (manual) and scroll/highlight it in the list.
- **Inline watchlist creation from search**: PRD §5.2 says "an inline prompt when a member searches for an item under a type the group doesn't have yet." Current: explicit "New Watchlist" button only. Fix: in AddItemDialog, if the group has no watchlist for the current media type, show "Create X watchlist?" prompt before searching.
