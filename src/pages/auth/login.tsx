import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

const Login = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') {
        navigate('/groups', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-black leading-none tracking-tight text-primary">BingeWyrm</h1>
          <div className="mx-auto h-1 w-12 rounded-full bg-accent" />
          <p className="text-muted-foreground">Group watchlists, ranked by vote.</p>
        </div>
        <Button onClick={handleSignIn} className="mx-auto w-fit px-8" size="lg">
          Sign in with Google
        </Button>
      </div>
    </div>
  )
}
export default Login
