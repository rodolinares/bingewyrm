import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Watchlist {
  id: string
  group_id: string
  media_type: 'movie' | 'series' | 'anime' | 'anime_movie'
  created_by: string
  created_at: string
  item_count?: number
}

export interface Item {
  id: string
  watchlist_id: string
  title: string
  source: 'tmdb' | 'anilist' | 'manual'
  source_id: string | null
  year: number
  poster_path: string | null
  added_by: string
  added_at: string
  watched: boolean
  removed_at: string | null
}

export function useWatchlists(groupId: string) {
  return useQuery({
    queryKey: ['watchlists', groupId],
    queryFn: async () => {
      const { data: watchlists, error } = await supabase
        .from('watchlists')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at')

      if (error) throw error
      if (!watchlists || watchlists.length === 0) return []

      const { data: items } = await supabase
        .from('items')
        .select('watchlist_id')
        .in('watchlist_id', watchlists.map(w => w.id))
        .is('removed_at', null)

      const countMap = new Map<string, number>()
      for (const item of items ?? []) {
        countMap.set(item.watchlist_id, (countMap.get(item.watchlist_id) ?? 0) + 1)
      }

      return watchlists.map(w => ({
        ...w,
        item_count: countMap.get(w.id) ?? 0
      })) as Watchlist[]
    }
  })
}

export function useWatchlist(watchlistId: string) {
  return useQuery({
    queryKey: ['watchlist', watchlistId],
    queryFn: async () => {
      const { data, error } = await supabase.from('watchlists').select('*').eq('id', watchlistId).single()

      if (error) throw error
      return data as Watchlist
    },
    enabled: !!watchlistId
  })
}

export function useCreateWatchlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, mediaType }: { groupId: string; mediaType: string }) => {
      const { data, error } = await supabase.rpc('create_watchlist', {
        p_group_id: groupId,
        p_media_type: mediaType
      })
      if (error) throw error
      return data as Watchlist
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists', variables.groupId] })
    }
  })
}

export function useItems(watchlistId: string) {
  return useQuery({
    queryKey: ['items', watchlistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('watchlist_id', watchlistId)
        .is('removed_at', null)
        .order('added_at')

      if (error) throw error
      return data as Item[]
    }
  })
}

export function useAddItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: Omit<Item, 'id' | 'added_at' | 'watched' | 'removed_at'>) => {
      const { data, error } = await supabase.rpc('add_item', {
        p_watchlist_id: item.watchlist_id,
        p_title: item.title,
        p_source: item.source,
        p_source_id: item.source_id,
        p_year: item.year,
        p_poster_path: item.poster_path
      })
      if (error) {
        if (error.code === '23505') throw new Error('This item is already in the watchlist')
        throw error
      }
      return data as Item
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', variables.watchlist_id] })
    }
  })
}

export function useToggleWatched() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, watched }: { id: string; watched: boolean; watchlistId: string }) => {
      const { error } = await supabase.rpc('toggle_item_watched', { p_item_id: id, p_watched: watched })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', variables.watchlistId] })
    }
  })
}

export function useRemoveItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string; watchlistId: string }) => {
      const { error } = await supabase.rpc('remove_item', { p_item_id: id })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', variables.watchlistId] })
    }
  })
}

export interface Session {
  id: string
  watchlist_id: string
  item_ids: string[]
  status: 'active' | 'ended'
  start_time: string
  end_time: string
  end_reason: 'all_voted' | 'time_limit' | 'manual' | null
  outcome: 'saved' | 'recycled' | 'discarded' | null
  created_at: string
}

export function useActiveSession(watchlistId: string) {
  return useQuery({
    queryKey: ['active-session', watchlistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('watchlist_id', watchlistId)
        .eq('status', 'active')
        .maybeSingle()

      if (error) throw error
      return data as Session | null
    },
    enabled: !!watchlistId
  })
}

export function useStartSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      watchlistId,
      itemIds,
      duration
    }: {
      watchlistId: string
      itemIds: string[]
      duration: string
    }) => {
      const { data, error } = await supabase.rpc('start_session', {
        p_watchlist_id: watchlistId,
        p_item_ids: itemIds,
        p_duration: duration
      })
      if (error) throw error
      return data as Session
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['active-session', variables.watchlistId] })
    }
  })
}
