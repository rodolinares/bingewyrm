import { Spinner } from '@/components/ui/spinner'
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { supabase } from '@/lib/supabase'

const AuthCallback = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('Auth callback error:', error)
          navigate('/auth/login', { replace: true })
          return
        }
        navigate('/groups', { replace: true })
      })
      return
    }

    // Fallback: listen for auth state change (hash-based or already signed in)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') {
        navigate('/groups', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate, searchParams])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner />
    </div>
  )
}
export default AuthCallback
