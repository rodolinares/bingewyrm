import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useRealtimeSession(sessionId: string | null | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, queryClient])
}

export function useRealtimeItems(watchlistId: string | null | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!watchlistId) return

    const channel = supabase
      .channel(`items:${watchlistId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'items', filter: `watchlist_id=eq.${watchlistId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['items', watchlistId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [watchlistId, queryClient])
}
