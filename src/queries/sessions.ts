import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Session, Item } from './watchlists'

export const useSession = (sessionId: string) => {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      if (error) throw error
      return data as Session
    },
    enabled: !!sessionId
  })
}

export const useSessionItems = (itemIds: string[]) => {
  return useQuery({
    queryKey: ['session-items', itemIds],
    queryFn: async () => {
      if (itemIds.length === 0) return []
      const { data, error } = await supabase.from('items').select('*').in('id', itemIds)
      if (error) throw error
      return data as Item[]
    },
    enabled: itemIds.length > 0
  })
}

export interface Vote {
  id: string
  session_id: string
  item_id: string
  user_id: string
  value: boolean
  created_at: string
}

const invalidateSessionVotes = (queryClient: QueryClient, sessionId: string) => {
  queryClient.invalidateQueries({ queryKey: ['votes', sessionId] })
  queryClient.invalidateQueries({ queryKey: ['session-votes', sessionId] })
}

const useVotes = (sessionId: string, userId: string | undefined, requireUser: boolean) => {
  return useQuery({
    queryKey: userId ? ['votes', sessionId, userId] : ['session-votes', sessionId],
    queryFn: async () => {
      const query = supabase.from('votes').select('*').eq('session_id', sessionId)
      const { data, error } = await (userId ? query.eq('user_id', userId) : query)
      if (error) throw error
      return data as Vote[]
    },
    enabled: !!sessionId && (requireUser ? !!userId : true)
  })
}

export const useMyVotes = (sessionId: string, userId: string | undefined) => useVotes(sessionId, userId, true)

export const useCastVote = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, itemId, value }: { sessionId: string; itemId: string; value: boolean }) => {
      const { error } = await supabase.rpc('cast_vote', {
        p_session_id: sessionId,
        p_item_id: itemId,
        p_value: value
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => invalidateSessionVotes(queryClient, variables.sessionId)
  })
}

export const useDeleteVote = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, itemId }: { sessionId: string; itemId: string }) => {
      const { error } = await supabase.rpc('delete_vote', {
        p_session_id: sessionId,
        p_item_id: itemId
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => invalidateSessionVotes(queryClient, variables.sessionId)
  })
}

export const useEndSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc('end_session', { p_session_id: sessionId })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', variables] })
    }
  })
}

export const useSessionVotes = (sessionId: string) => useVotes(sessionId, undefined, false)

export const useSessionParticipants = (sessionId: string) => {
  return useQuery({
    queryKey: ['session-participants', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_participants')
        .select('user_id, users(display_name)')
        .eq('session_id', sessionId)
      if (error) throw error
      return (data ?? []) as unknown as { user_id: string; users: { display_name: string | null } }[]
    },
    enabled: !!sessionId
  })
}

const useLastSessionByOutcome = (watchlistId: string, resolved: boolean) => {
  return useQuery({
    queryKey: [resolved ? 'last-resolved-session' : 'last-unresolved-session', watchlistId],
    queryFn: async () => {
      const base = supabase
        .from('sessions')
        .select('*')
        .eq('watchlist_id', watchlistId)
        .eq('status', 'ended')
        .order('created_at', { ascending: false })
        .limit(1)

      const { data, error } = await (
        resolved ? base.not('outcome', 'is', null) : base.is('outcome', null)
      ).maybeSingle()
      if (error) throw error
      return data as Session | null
    },
    enabled: !!watchlistId
  })
}

export const useLastUnresolvedSession = (watchlistId: string) => {
  return useLastSessionByOutcome(watchlistId, false)
}

export const useLastResolvedSession = (watchlistId: string) => {
  return useLastSessionByOutcome(watchlistId, true)
}

export const usePastSessions = (watchlistId: string) => {
  return useQuery({
    queryKey: ['past-sessions', watchlistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('watchlist_id', watchlistId)
        .eq('status', 'ended')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Session[]
    },
    enabled: !!watchlistId
  })
}

export const useResolveOutcome = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sessionId,
      outcome,
      discardItemIds
    }: {
      sessionId: string
      outcome: 'saved' | 'discarded'
      discardItemIds?: string[]
    }) => {
      const { error } = await supabase.rpc('resolve_outcome', {
        p_session_id: sessionId,
        p_outcome: outcome,
        p_discard_item_ids: discardItemIds ?? null
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId] })
      queryClient.invalidateQueries({ queryKey: ['session-votes', variables.sessionId] })
    }
  })
}
