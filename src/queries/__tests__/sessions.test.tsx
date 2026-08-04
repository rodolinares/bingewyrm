import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useSession,
  useSessionItems,
  useMyVotes,
  useCastVote,
  useEndSession,
  useSessionVotes,
  useSessionParticipants,
  useLastUnresolvedSession,
  useLastResolvedSession,
  usePastSessions,
  useResolveOutcome
} from '../sessions'

const mockSession = {
  id: 'sess-1',
  watchlist_id: 'wl-1',
  item_ids: ['item-1', 'item-2'],
  status: 'active',
  start_time: '2024-01-01T00:00:00Z',
  end_time: '',
  end_reason: null,
  outcome: null,
  created_at: '2024-01-01T00:00:00Z'
}

const mockItems = [
  { id: 'item-1', watchlist_id: 'wl-1', title: 'Item 1', source: 'tmdb' },
  { id: 'item-2', watchlist_id: 'wl-1', title: 'Item 2', source: 'tmdb' }
]

const mockVote = {
  id: 'vote-1',
  session_id: 'sess-1',
  item_id: 'item-1',
  user_id: 'user-1',
  value: true,
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

describe('useSession', () => {
  it('fetches session by id', async () => {
    queryRef.current = mockSession

    const { result } = renderHook(() => useSession('sess-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('sess-1')
    expect(result.current.data?.status).toBe('active')
  })
})

describe('useSessionItems', () => {
  it('fetches items by ids', async () => {
    queryRef.current = mockItems

    const { result } = renderHook(() => useSessionItems(['item-1', 'item-2']), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('is disabled when itemIds is empty', async () => {
    const { result } = renderHook(() => useSessionItems([]), { wrapper: createWrapper() })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})

describe('useMyVotes', () => {
  it('fetches votes for session and user', async () => {
    queryRef.current = [mockVote]

    const { result } = renderHook(() => useMyVotes('sess-1', 'user-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.item_id).toBe('item-1')
  })

  it('is disabled when userId is undefined', async () => {
    const { result } = renderHook(() => useMyVotes('sess-1', undefined), {
      wrapper: createWrapper()
    })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCastVote', () => {
  it('calls cast_vote rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useCastVote(), { wrapper: createWrapper() })

    result.current.mutate({ sessionId: 'sess-1', itemId: 'item-1', value: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useEndSession', () => {
  it('calls end_session rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useEndSession(), { wrapper: createWrapper() })

    result.current.mutate('sess-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useSessionVotes', () => {
  it('fetches all votes for session', async () => {
    queryRef.current = [mockVote]

    const { result } = renderHook(() => useSessionVotes('sess-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})

describe('useSessionParticipants', () => {
  it('fetches participants with display names', async () => {
    queryRef.current = [
      { user_id: 'u1', users: { display_name: 'Alice' } },
      { user_id: 'u2', users: { display_name: 'Bob' } }
    ]

    const { result } = renderHook(() => useSessionParticipants('sess-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { user_id: 'u1', users: { display_name: 'Alice' } },
      { user_id: 'u2', users: { display_name: 'Bob' } }
    ])
  })
})

describe('useLastUnresolvedSession', () => {
  it('fetches last ended session without outcome', async () => {
    queryRef.current = { ...mockSession, status: 'ended', outcome: null }

    const { result } = renderHook(() => useLastUnresolvedSession('wl-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('ended')
    expect(result.current.data?.outcome).toBeNull()
  })
})

describe('useLastResolvedSession', () => {
  it('fetches last ended session with outcome', async () => {
    queryRef.current = { ...mockSession, status: 'ended', outcome: 'saved' }

    const { result } = renderHook(() => useLastResolvedSession('wl-1'), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.outcome).toBe('saved')
  })
})

describe('usePastSessions', () => {
  it('fetches past ended sessions', async () => {
    queryRef.current = [
      { ...mockSession, id: 's1', status: 'ended', outcome: 'saved' },
      { ...mockSession, id: 's2', status: 'ended', outcome: 'saved' }
    ]

    const { result } = renderHook(() => usePastSessions('wl-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })
})

describe('useResolveOutcome', () => {
  it('calls resolve_outcome rpc with discardItemIds', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useResolveOutcome(), { wrapper: createWrapper() })

    result.current.mutate({
      sessionId: 'sess-1',
      outcome: 'saved',
      discardItemIds: ['item-1']
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('calls resolve_outcome rpc without discardItemIds', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useResolveOutcome(), { wrapper: createWrapper() })

    result.current.mutate({
      sessionId: 'sess-1',
      outcome: 'discarded'
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
