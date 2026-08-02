import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Session, Item } from './watchlists'

export function useSession(sessionId: string) {
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

export function useSessionItems(itemIds: string[]) {
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
  is_auto: boolean
  created_at: string
}

export function useMyVotes(sessionId: string, userId: string | undefined) {
  return useQuery({
    queryKey: ['votes', sessionId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId!)
      if (error) throw error
      return data as Vote[]
    },
    enabled: !!sessionId && !!userId
  })
}

export function useCastVote() {
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['votes', variables.sessionId] })
      queryClient.invalidateQueries({ queryKey: ['session-votes', variables.sessionId] })
    }
  })
}

export function useDeleteVote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, itemId }: { sessionId: string; itemId: string }) => {
      const { error } = await supabase.rpc('delete_vote', {
        p_session_id: sessionId,
        p_item_id: itemId
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['votes', variables.sessionId] })
      queryClient.invalidateQueries({ queryKey: ['session-votes', variables.sessionId] })
    }
  })
}

export function useEndSession() {
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

export function useSessionVotes(sessionId: string) {
  return useQuery({
    queryKey: ['session-votes', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('votes').select('*').eq('session_id', sessionId)
      if (error) throw error
      return data as Vote[]
    },
    enabled: !!sessionId
  })
}

export function useSessionParticipants(sessionId: string) {
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

function useLastSessionByOutcome(watchlistId: string, resolved: boolean) {
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

export function useLastUnresolvedSession(watchlistId: string) {
  return useLastSessionByOutcome(watchlistId, false)
}

export function useLastResolvedSession(watchlistId: string) {
  return useLastSessionByOutcome(watchlistId, true)
}

export function usePastSessions(watchlistId: string) {
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

export function useResolveOutcome() {
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
