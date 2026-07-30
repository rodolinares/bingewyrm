import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface UserProfile {
  id: string
  display_name: string | null
  email: string | null
  google_account_id: string
  created_at: string
}

export function useUser() {
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession()
      return data.session
    },
    staleTime: 5 * 60 * 1000
  })

  const userId = session?.user?.id

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data } = await supabase.from('users').select('*').eq('id', userId).single()
      return data as UserProfile | null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000
  })

  return {
    user: session?.user ?? null,
    profile: profile ?? null,
    isLoading: sessionLoading || (userId && profileLoading),
    isOnboarded: !!profile?.display_name
  }
}
