import { createBrowserRouter, Link, Navigate, Outlet, redirect } from 'react-router'
import type { RouteObject } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/use-user'
import Login from '@/pages/auth/login'
import AuthCallback from '@/pages/auth/callback'
import Onboarding from '@/pages/onboarding'
import GroupList from '@/pages/groups/index'
import GroupLayout, { GroupWatchlists } from '@/pages/groups/[groupId]/index'
import GroupSettings from '@/pages/groups/[groupId]/settings'
import WatchlistDetail from '@/pages/watchlist/[watchlistId]/index'
import SessionStart from '@/pages/watchlist/[watchlistId]/start-session'
import SessionHistory from '@/pages/watchlist/[watchlistId]/history'
import VotingPage from '@/pages/session/[sessionId]/voting'
import ResultsPage from '@/pages/session/[sessionId]/results'
import InviteJoin from '@/pages/invite/[code]'

function AppLayout() {
  const { user } = useUser()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="flex h-screen flex-col">
      {user && (
        <header className="flex items-center justify-between border-b border-border px-4 py-2">
          <Link to="/groups" className="flex h-10 items-center text-sm font-bold text-foreground">
            BingeWyrm
          </Link>
          <button
            onClick={handleSignOut}
            className="flex h-10 items-center px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </header>
      )}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <footer className="border-t border-border px-4 py-2 text-center text-[10px] text-muted-foreground">
        This product uses the TMDb API but is not endorsed or certified by TMDb.
      </footer>
    </div>
  )
}

async function requireAuth() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw redirect('/auth/login')
  return data.session
}

async function requireOnboarding({ request }: { request: Request }) {
  const session = await requireAuth()
  const { data: profile } = await supabase.from('users').select('display_name').eq('id', session.user.id).single()
  if (!profile?.display_name) {
    const url = new URL(request.url)
    throw redirect(`/onboarding?next=${encodeURIComponent(url.pathname)}`)
  }
}

const protectedChildren: RouteObject[] = [
  { path: 'groups', element: <GroupList /> },
  {
    path: 'groups/:groupId',
    element: <GroupLayout />,
    children: [
      { index: true, element: <GroupWatchlists /> },
      { path: 'settings', element: <GroupSettings /> }
    ]
  },
  { path: 'invite/:code', element: <InviteJoin /> },
  {
    path: 'watchlist/:watchlistId',
    children: [
      { index: true, element: <WatchlistDetail /> },
      { path: 'start-session', element: <SessionStart /> },
      { path: 'history', element: <SessionHistory /> }
    ]
  },
  {
    path: 'session/:sessionId',
    children: [
      { path: 'vote', element: <VotingPage /> },
      { path: 'results', element: <ResultsPage /> }
    ]
  }
]

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/groups" replace /> },

      { path: 'auth/login', element: <Login /> },
      { path: 'auth/callback', element: <AuthCallback /> },

      {
        path: 'onboarding',
        loader: requireAuth,
        element: <Onboarding />
      },

      {
        loader: requireOnboarding,
        children: protectedChildren
      },

      { path: '*', element: <Navigate to="/groups" replace /> }
    ]
  }
])
