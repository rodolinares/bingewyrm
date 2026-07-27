# Skipped Features

Track features deferred during implementation. Add back when needed.

## Phase 5 — Watchlists

- **Duplicate UX: scroll/highlight existing entry**: On duplicate insert, current UX shows "Added" badge + dimmed row in search results. PRD §5.2 says "scroll/highlight" — the badge covers the intent but doesn't scroll to it. Low priority, badge is sufficient for now.
- **Inline watchlist creation from search**: PRD §5.2 says "an inline prompt when a member searches for an item under a type the group doesn't have yet." Current: explicit "New Watchlist" button only. Fix: in AddItemDialog, if the group has no watchlist for the current media type, show "Create X watchlist?" prompt before searching.
