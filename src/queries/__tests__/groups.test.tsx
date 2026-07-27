import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useRegenerateInvite,
  useGroupMembers,
  useTransferLeader,
  useGroupGenres,
  useGroupGenreBlacklist,
  useAddGenreBlacklist,
  useRemoveGenreBlacklist,
  useJoinGroup
} from '../groups'

const mockUser = { id: 'user-1' }

const queryRef = vi.hoisted(() => ({ current: [] as unknown }))
const rpcRef = vi.hoisted(() => ({ current: null as unknown }))

function chain<T>(ref: { current: T }) {
  const c: {
    select: () => typeof c
    eq: () => typeof c
    in: () => typeof c
    is: () => typeof c
    order: () => typeof c
    limit: () => typeof c
    single: () => typeof c
    maybeSingle: () => typeof c
    then: (fn: (v: { data: T; error: null }) => unknown) => Promise<unknown>
  } = {
    select: () => c,
    eq: () => c,
    in: () => c,
    is: () => c,
    order: () => c,
    limit: () => c,
    single: () => c,
    maybeSingle: () => c,
    then: (fn: (v: { data: T; error: null }) => unknown) =>
      Promise.resolve({ data: ref.current, error: null } as { data: T; error: null }).then(fn)
  }
  return c
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => chain(queryRef),
    rpc: () => chain(rpcRef),
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: mockUser } }, error: null })
    }
  }
}))

vi.mock('@/hooks/use-user', () => ({
  useUser: () => ({
    user: mockUser,
    profile: { id: mockUser.id, display_name: 'Test User' },
    isLoading: false,
    isOnboarded: true
  })
}))

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  queryRef.current = []
  rpcRef.current = null
})

describe('useGroups', () => {
  it('returns empty array when no groups', async () => {
    queryRef.current = []
    rpcRef.current = []

    const { result } = renderHook(() => useGroups(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('returns groups with member counts', async () => {
    const groups = [
      { group_id: 'g1', groups: { id: 'g1', name: 'Group 1', leader_id: 'u1', invite_code: 'abc', created_at: '2024-01-01' } },
      { group_id: 'g2', groups: { id: 'g2', name: 'Group 2', leader_id: 'u2', invite_code: 'def', created_at: '2024-01-02' } }
    ]
    queryRef.current = groups
    rpcRef.current = [
      { group_id: 'g1', count: 3 },
      { group_id: 'g2', count: 5 }
    ]

    const { result } = renderHook(() => useGroups(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]?.name).toBe('Group 1')
    expect(result.current.data?.[0]?.member_count).toBe(3)
    expect(result.current.data?.[1]?.member_count).toBe(5)
  })

  it('sets member_count to 0 when rpc returns empty', async () => {
    queryRef.current = [
      { group_id: 'g1', groups: { id: 'g1', name: 'Group 1', leader_id: 'u1', invite_code: 'abc', created_at: '2024-01-01' } }
    ]
    rpcRef.current = []

    const { result } = renderHook(() => useGroups(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.member_count).toBe(0)
  })
})

describe('useCreateGroup', () => {
  it('calls create_group rpc and returns group', async () => {
    const newGroup = { id: 'g1', name: 'New Group', leader_id: 'u1', invite_code: 'xyz', created_at: '2024-01-01' }
    rpcRef.current = newGroup

    const { result } = renderHook(() => useCreateGroup(), { wrapper: createWrapper() })

    result.current.mutate('New Group')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject(newGroup)
  })
})

describe('useUpdateGroup', () => {
  it('calls update_group_name rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useUpdateGroup(), { wrapper: createWrapper() })

    result.current.mutate({ id: 'g1', name: 'Renamed' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useDeleteGroup', () => {
  it('calls delete_group rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useDeleteGroup(), { wrapper: createWrapper() })

    result.current.mutate('g1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useRegenerateInvite', () => {
  it('calls regenerate_invite_code rpc and returns new code', async () => {
    rpcRef.current = 'new-code-123'

    const { result } = renderHook(() => useRegenerateInvite(), { wrapper: createWrapper() })

    result.current.mutate('g1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('new-code-123')
  })
})

describe('useGroupMembers', () => {
  it('fetches members for a group', async () => {
    const members = [
      { user_id: 'u1', joined_at: '2024-01-01', users: { display_name: 'Alice' } },
      { user_id: 'u2', joined_at: '2024-01-02', users: { display_name: 'Bob' } }
    ]
    queryRef.current = members

    const { result } = renderHook(() => useGroupMembers('g1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]?.users.display_name).toBe('Alice')
  })

  it('is disabled when groupId is undefined', async () => {
    const { result } = renderHook(() => useGroupMembers(undefined), { wrapper: createWrapper() })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})

describe('useTransferLeader', () => {
  it('calls transfer_leader rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useTransferLeader(), { wrapper: createWrapper() })

    result.current.mutate({ groupId: 'g1', newLeaderId: 'u2' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useGroupGenres', () => {
  it('fetches genres for a group', async () => {
    rpcRef.current = ['Action', 'Drama', 'Comedy']

    const { result } = renderHook(() => useGroupGenres('g1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(['Action', 'Drama', 'Comedy'])
  })
})

describe('useGroupGenreBlacklist', () => {
  it('fetches blacklisted genres', async () => {
    rpcRef.current = ['Horror', 'Thriller']

    const { result } = renderHook(() => useGroupGenreBlacklist('g1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(['Horror', 'Thriller'])
  })
})

describe('useAddGenreBlacklist', () => {
  it('calls add_genre_blacklist rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useAddGenreBlacklist(), { wrapper: createWrapper() })

    result.current.mutate({ groupId: 'g1', genres: ['Horror'] })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useRemoveGenreBlacklist', () => {
  it('calls remove_genre_blacklist rpc', async () => {
    rpcRef.current = null

    const { result } = renderHook(() => useRemoveGenreBlacklist(), { wrapper: createWrapper() })

    result.current.mutate({ groupId: 'g1', genres: ['Horror'] })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useJoinGroup', () => {
  it('calls join_group rpc and returns group', async () => {
    const group = { id: 'g1', name: 'Joined Group', leader_id: 'u1', invite_code: 'abc', created_at: '2024-01-01' }
    rpcRef.current = group

    const { result } = renderHook(() => useJoinGroup(), { wrapper: createWrapper() })

    result.current.mutate('invite-code-123')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject(group)
  })
})
