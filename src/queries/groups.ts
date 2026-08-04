import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/use-user'

export interface Group {
  id: string
  name: string
  leader_id: string
  invite_code: string
  created_at: string
  member_count?: number
}

interface GroupMemberRow {
  group_id: string
  groups: Omit<Group, 'member_count'>
}

interface MemberCountRow {
  group_id: string
  count: number
}

const useGroupMutation = <TArgs, TData = void>(mutationFn: (args: TArgs) => Promise<TData>) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    }
  })
}

export const useGroups = () => {
  const { user } = useUser()

  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name, leader_id, invite_code, created_at)')
        .eq('user_id', user.id)

      if (error) throw error

      const rows = data as unknown as GroupMemberRow[]
      const groupIds = rows.map(m => m.group_id)
      if (groupIds.length === 0) return []

      const { data: counts } = await supabase.rpc('get_member_count', {
        p_group_ids: groupIds
      })

      const countMap = new Map<string, number>()
      if (Array.isArray(counts)) {
        for (const c of counts as MemberCountRow[]) {
          countMap.set(c.group_id, Number(c.count))
        }
      }

      return rows.map(m => ({
        ...m.groups,
        member_count: countMap.get(m.group_id) ?? 0
      }))
    },
    enabled: !!user
  })
}

export const useCreateGroup = () =>
  useGroupMutation(async (name: string) => {
    const { data, error } = await supabase.rpc('create_group', { p_name: name })
    if (error) throw error
    return data as Group
  })

export const useUpdateGroup = () =>
  useGroupMutation(async ({ id, name }: { id: string; name: string }) => {
    const { error } = await supabase.rpc('update_group_name', { p_group_id: id, p_name: name })
    if (error) throw error
  })

export const useDeleteGroup = () =>
  useGroupMutation(async (id: string) => {
    const { error } = await supabase.rpc('delete_group', { p_group_id: id })
    if (error) throw error
  })

export const useRegenerateInvite = () =>
  useGroupMutation(async (groupId: string) => {
    const { data, error } = await supabase.rpc('regenerate_invite_code', {
      p_group_id: groupId
    })
    if (error) throw error
    return data as string
  })

interface GroupMemberWithUser {
  user_id: string
  joined_at: string
  users: { display_name: string | null }
}

export const useGroupMembers = (groupId: string | undefined) => {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      if (!groupId) return []
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, joined_at, users(display_name)')
        .eq('group_id', groupId)

      if (error) throw error
      return (data as unknown as GroupMemberWithUser[]) ?? []
    },
    enabled: !!groupId
  })
}

export const useTransferLeader = () =>
  useGroupMutation(async ({ groupId, newLeaderId }: { groupId: string; newLeaderId: string }) => {
    const { error } = await supabase.rpc('transfer_leader', {
      p_group_id: groupId,
      p_new_leader_id: newLeaderId
    })
    if (error) throw error
  })

export const useGroupGenres = (groupId: string | undefined) => {
  return useQuery({
    queryKey: ['group-genres', groupId],
    queryFn: async () => {
      if (!groupId) return []
      const { data, error } = await supabase.rpc('get_group_genres', { p_group_id: groupId })
      if (error) throw error
      return (data ?? []) as string[]
    },
    enabled: !!groupId
  })
}

export const useGroupGenreBlacklist = (groupId: string | undefined) => {
  return useQuery({
    queryKey: ['genre-blacklist', groupId],
    queryFn: async () => {
      if (!groupId) return []
      const { data, error } = await supabase.rpc('get_genre_blacklist', { p_group_id: groupId })
      if (error) throw error
      return (data ?? []) as string[]
    },
    enabled: !!groupId
  })
}

export const useAddGenreBlacklist = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, genres }: { groupId: string; genres: string[] }) => {
      const { error } = await supabase.rpc('add_genre_blacklist', {
        p_group_id: groupId,
        p_genres: genres
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['genre-blacklist', variables.groupId] })
    }
  })
}

export const useRemoveGenreBlacklist = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, genres }: { groupId: string; genres: string[] }) => {
      const { error } = await supabase.rpc('remove_genre_blacklist', {
        p_group_id: groupId,
        p_genres: genres
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['genre-blacklist', variables.groupId] })
    }
  })
}

export const useJoinGroup = () =>
  useGroupMutation(async (inviteCode: string) => {
    const { data, error } = await supabase.rpc('join_group', {
      p_invite_code: inviteCode
    })
    if (error) throw error
    return data as Group
  })
