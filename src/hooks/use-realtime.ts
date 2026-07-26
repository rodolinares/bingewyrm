import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface RealtimeOptions {
  channel: string
  table: string
  event: 'INSERT' | 'UPDATE' | '*'
  filter: string
  queryKey: (string | null | undefined)[]
}

function useRealtime({ channel, table, event, filter, queryKey }: RealtimeOptions) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const ch = supabase
      .channel(channel)
      .on('postgres_changes', { event, schema: 'public', table, filter }, () => {
        queryClient.invalidateQueries({ queryKey })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [channel, table, event, filter, queryKey, queryClient])
}

export function useRealtimeSession(sessionId: string | null | undefined) {
  useRealtime({
    channel: `session:${sessionId}`,
    table: 'sessions',
    event: 'UPDATE',
    filter: `id=eq.${sessionId}`,
    queryKey: ['session', sessionId]
  })
}

export function useRealtimeItems(watchlistId: string | null | undefined) {
  useRealtime({
    channel: `items:${watchlistId}`,
    table: 'items',
    event: 'INSERT',
    filter: `watchlist_id=eq.${watchlistId}`,
    queryKey: ['items', watchlistId]
  })
}
