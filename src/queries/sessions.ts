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
    mutationFn: async ({
      sessionId,
      itemId,
      userId,
      value
    }: {
      sessionId: string
      itemId: string
      userId: string
      value: boolean
    }) => {
      const { error } = await supabase.from('votes').insert({
        session_id: sessionId,
        item_id: itemId,
        user_id: userId,
        value,
        is_auto: false
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['votes', variables.sessionId, variables.userId] })
    }
  })
}

export function useEndSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'ended', end_reason: 'manual' })
        .eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', variables] })
    }
  })
}
