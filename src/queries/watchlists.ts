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
      const { data, error } = await supabase.from('watchlists').select('*').eq('group_id', groupId).order('created_at')

      if (error) throw error
      return data as Watchlist[]
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
      const { data, error } = await supabase.from('items').insert(item).select().single()
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
      const { error } = await supabase.from('items').update({ watched }).eq('id', id)
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
      const { error } = await supabase.from('items').update({ removed_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', variables.watchlistId] })
    }
  })
}
