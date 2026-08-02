import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useWatchlists,
  useWatchlist,
  useCreateWatchlist,
  useItems,
  useAddItem,
  useToggleWatched,
  useRemoveItem,
  useRemoveItems,
  useActiveSession,
  useStartSession
} from '../watchlists'

const mockWatchlist = {
  id: 'wl-1',
  group_id: 'g-1',
  media_type: 'movie' as const,
  created_by: 'user-1',
  created_at: '2024-01-01T00:00:00Z'
}

const mockItem = {
  id: 'item-1',
  watchlist_id: 'wl-1',
  title: 'Test Item',
  source: 'tmdb' as const,
  source_id: '123',
  year: 2024,
  poster_path: '/poster.jpg',
  vote_average: 7.5,
  genres: ['Action'],
  added_by: 'user-1',
  added_at: '2024-01-01T00:00:00Z',
  watched: false,
  removed_at: null
}

const mockSession = {
  id: 'sess-1',
  watchlist_id: 'wl-1',
  item_ids: ['item-1'],
  status: 'active' as const,
  start_time: '2024-01-01T00:00:00Z',
  end_time: '',
  end_reason: null,
  outcome: null,
  created_at: '2024-01-01T00:00:00Z'
}

const queryRef = vi.hoisted(() => ({ current: [] as unknown }))
const rpcRef = vi.hoisted(() => ({ current: null as unknown }))

const chain = (ref: { current: unknown }) => {
  const c: Record<string, unknown> = {
    select: () => c,
    eq: () => c,
    in: () => c,
    is: () => c,
    order: () => c,
    limit: () => c,
    single: () => c,
    maybeSingle: () => c,
    not: () => c,
    then: (fn: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: ref.current, error: null }).then(fn)
  }
  return c as typeof c & { then: (fn: (v: { data: unknown; error: null }) => unknown) => Promise<unknown> }
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => chain(queryRef),
    rpc: () => chain(rpcRef),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } }, error: null })
    }
  }
}))

const createWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return ({ children }: { children: ReactNode }) => {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  queryRef.current = []
  rpcRef.current = null
})

describe('useWatchlists', () => {
  it('fetches watchlists with item counts', async () => {
    queryRef.current = [mockWatchlist, { ...mockWatchlist, id: 'wl-2' }]

    const { result } = renderHook(() => useWatchlists('g-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]?.id).toBe('wl-1')
  })
})

describe('useWatchlist', () => {
  it('fetches single watchlist by id', async () => {
    queryRef.current = mockWatchlist

    const { result } = renderHook(() => useWatchlist('wl-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.media_type).toBe('movie')
  })
})

describe('useCreateWatchlist', () => {
  it('calls create_watchlist rpc', async () => {
    rpcRef.current = mockWatchlist

    const { result } = renderHook(() => useCreateWatchlist(), { wrapper: createWrapper() })

    result.current.mutate({ groupId: 'g-1', mediaType: 'movie' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.media_type).toBe('movie')
  })
})

describe('useItems', () => {
  it('fetches items for watchlist', async () => {
    queryRef.current = [mockItem]

    const { result } = renderHook(() => useItems('wl-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.title).toBe('Test Item')
  })
})

describe('useAddItem', () => {
  it('calls add_item rpc and returns item', async () => {
    rpcRef.current = mockItem

    const { result } = renderHook(() => useAddItem(), { wrapper: createWrapper() })

    result.current.mutate({
      watchlist_id: 'wl-1',
      title: 'New Item',
      source: 'tmdb',
      source_id: '456',
      year: 2025,
      poster_path: '/new.jpg',
      vote_average: 8.0,
      genres: ['Drama']
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.title).toBe('Test Item')
  })
})

describe('useToggleWatched', () => {
  it('calls toggle_item_watched rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useToggleWatched(), { wrapper: createWrapper() })

    result.current.mutate({ id: 'item-1', watched: true, watchlistId: 'wl-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useRemoveItem', () => {
  it('calls remove_item rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useRemoveItem(), { wrapper: createWrapper() })

    result.current.mutate({ id: 'item-1', watchlistId: 'wl-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useRemoveItems', () => {
  it('calls remove_items rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useRemoveItems(), { wrapper: createWrapper() })

    result.current.mutate({ ids: ['item-1', 'item-2'], watchlistId: 'wl-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useActiveSession', () => {
  it('fetches active session for watchlist', async () => {
    queryRef.current = mockSession

    const { result } = renderHook(() => useActiveSession('wl-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('active')
  })

  it('returns null when no active session', async () => {
    queryRef.current = null

    const { result } = renderHook(() => useActiveSession('wl-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

describe('useStartSession', () => {
  it('calls start_session rpc', async () => {
    rpcRef.current = mockSession

    const { result } = renderHook(() => useStartSession(), { wrapper: createWrapper() })

    result.current.mutate({
      watchlistId: 'wl-1',
      itemIds: ['item-1', 'item-2'],
      duration: '30m'
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('active')
  })
})
