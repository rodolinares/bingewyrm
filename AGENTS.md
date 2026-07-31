# Agents — BingeWyrm

Instructions for AI agents working on this codebase.

## Commands

```bash
pnpm dev          # dev server
pnpm build        # tsc + vite build
pnpm lint         # eslint
pnpm format       # prettier (src/**/*.{ts,tsx})
pnpm format:check # check without writing
```

Always run `pnpm build` after changes to verify type-check + build pass.

## Conventions

### Writes: always RPCs

Never use `.insert()`, `.update()`, or `.delete()` on Supabase tables. All
writes go through SECURITY DEFINER RPCs via `supabase.rpc(...)`. This is
required because `auth.uid()` returns NULL in INSERT WITH CHECK context.

Available RPCs:
- `create_group`, `update_group_name`, `delete_group`, `regenerate_invite_code`
- `join_group`, `transfer_leader`
- `create_watchlist`
- `add_item`, `toggle_item_watched`, `remove_item`
- `start_session`, `cast_vote`, `end_session`, `resolve_outcome`
- `update_user_profile`
- `get_member_count`
- `remove_items`
- `get_group_genres`, `get_genre_blacklist`, `add_genre_blacklist`, `remove_genre_blacklist`

### SECURITY DEFINER stays

Helper functions (`is_group_member`, `is_group_leader`, `get_watchlist_group_id`,
`get_item_owner_group_id`, `get_session_group_id`) must remain SECURITY
DEFINER. Changing to SECURITY INVOKER causes infinite recursion via RLS.

### Queries: TanStack Query

All data fetching uses `useQuery` / `useMutation` from `@tanstack/react-query`.
Query keys are arrays: `['groups']`, `['items', watchlistId]`, etc.
Mutations invalidate relevant query keys in `onSuccess`.

### Forms: React Hook Form + Zod v4

Validation schemas use `zod/v4`. Forms use `useForm` with `zodResolver`.
Keep schemas co-located with the form component.

### Comments: minimal

Only add comments when "why" isn't obvious from the code. No "what" comments.

### Commits

Format: `feat(scope): message` / `fix(scope): message` / `refactor(scope): message`
One line. No body unless asked.

### Prettier

Exact config (no trailing commas, no semis, single quotes):
```
semi: false
singleQuote: true
trailingComma: "none"
printWidth: 120
arrowParens: "avoid"
```

Targets `src/**/*.{ts,tsx}` only. Skips `dist/`, `docs/`, `src/components/ui/`, `src/index.css`.

### No eslint-disable

Fix root causes. Typed interfaces for Supabase responses, `useRef` for
effect gating, etc.

### No setState in useEffect

React Compiler lint warns against this. Restructure to event handlers or
derived state.

### UI Components

- `Button` does NOT support `asChild` — use `Link` with button styling instead
- Dialog components live in `src/components/ui/dialog.tsx` (shadcn/base-ui)
- Theme tokens in `src/index.css` (`@theme inline`), reference copy was `docs/bingewyrm-theme.css`

## File Map

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Routes, AppLayout, auth loaders (`requireAuth`, `requireOnboarding`) |
| `src/lib/supabase.ts` | Supabase client, `supabaseUrl$` |
| `src/lib/anilist.ts` | AniList GraphQL search (enriched: description, averageScore, genres) |
| `src/lib/shuffle.ts` | Deterministic mulberry32 PRNG shuffle |
| `src/lib/utils.ts` | `cn()` helper (clsx + tailwind-merge) |
| `src/hooks/use-user.ts` | Session + profile (TanStack Query) |
| `src/hooks/use-realtime.ts` | `useRealtimeSession`, `useRealtimeItems` (shared `useRealtime` helper) |
| `src/queries/groups.ts` | Group CRUD hooks (all RPCs) |
| `src/queries/watchlists.ts` | Watchlist/item hooks (all RPCs) |
| `src/queries/sessions.ts` | Session/vote hooks (all RPCs), `useLastSessionByOutcome` |
| `src/components/watchlist/add-item-dialog.tsx` | Batch add, multi-select, detail panel, existing badges, manual entry |
| `src/components/watchlist/item-detail-panel.tsx` | Item detail panel (overlay with description, rating, genres) |
| `supabase/migrations/` | SQL migrations 00001–00011 |
| `supabase/functions/tmdb-search/` | TMDb proxy Edge Function (search + detail endpoints) |
| `src/index.css` | Design tokens (`@theme inline`), reference copy was `docs/bingewyrm-theme.css` |
| `docs/bingewyrm-skipped.md` | Deferred features tracker |
| `public/_redirects` | SPA redirect rule (Cloudflare Pages) |

## Tests

### Stack

- **Framework**: Vitest (vite-native, shares config)
- **Component tests**: `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event`
- **Coverage**: `@vitest/coverage-v8`

### Running

```bash
pnpm test          # single run
pnpm test:watch    # watch mode
pnpm test:coverage # with coverage report
```

Coverage threshold starts at 10% — ratchet up as coverage grows. Never lower.

### File naming

- Unit tests co-located: `src/lib/shuffle.test.ts` next to `src/lib/shuffle.ts`
- Query/component tests: `src/queries/__tests__/groups.test.tsx` (separate dir for complex setup)
- Test infrastructure: `src/__tests__/` (setup, mocks, test-utils)

### Conventions

1. **Pure functions first**: test input → output mapping. No mocking needed.
2. **Query hooks**: mock `@/lib/supabase` module with `vi.mock()`. Use mutable ref pattern to control return values per test:
   ```ts
   const queryRef = vi.hoisted(() => ({ current: [] }))
   vi.mock('@/lib/supabase', () => ({
     supabase: {
       from: () => chain(queryRef),
       rpc: () => chain(rpcRef),
       auth: { getSession: () => Promise.resolve(...) }
     }
   }))
   ```
3. **`useUser` dependency**: mock `@/hooks/use-user` when testing hooks that call it.
4. **QueryClient**: create fresh per test with `retry: false` and `gcTime: 0` to avoid flakiness.
5. **Error paths**: test that RPC errors propagate as thrown exceptions.
6. **Mutation invalidation**: test that `onSuccess` invalidates the expected query keys.
7. **No MSW**: mock supabase module directly; mock `fetch` for anilist tests via `vi.spyOn(globalThis, 'fetch')`.

### What to test by layer

| Layer | What | Example |
|-------|------|---------|
| Pure functions | Edge cases, determinism, type correctness | `shuffle.ts`, `media.ts` |
| Query hooks | RPC called with right args, error handling, cache invalidation | `queries/groups.ts` |
| Components | Form validation, conditional rendering, user interaction | dialogs, pages |
| Edge Functions | Request parsing, response format, error codes | `tmdb-search` |

### Coverage target

- **Baseline**: 10% (statements, branches, functions, lines)
- **New queries**: must have test for success + error path
- **New pure functions**: must have unit tests
- **New components**: must have render + interaction tests for non-trivial logic

## Gotchas

- `@supabase/ssr` is NOT used — this is a Vite SPA, not SSR
- `lucide-react` is only used for `XIcon` in dialog close button
- Invite links are UUID-based, auto-join, no approval
- Leader transfer removes the outgoing leader from members atomically
- `pnpm-lock.yaml` must stay in sync — run `pnpm install` after dep changes
- Edge Function must be redeployed after changes: `supabase functions deploy tmdb-search`
- Git: `develop` branch for all work, merge to `main` for releases
- Item count on watchlist cards excludes removed items (`removed_at IS NOT NULL`)
- Genre blacklist: leader-only, set per-group, excludes items from session pools
