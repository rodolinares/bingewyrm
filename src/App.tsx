import { createBrowserRouter, Link, Navigate, Outlet, redirect, useLocation } from 'react-router'
import type { RouteObject } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/use-user'
import { useTheme } from '@/hooks/use-theme'
import { ErrorBoundary } from '@/components/error-boundary'
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
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="flex h-dvh flex-col">
      {user && (
        <header className="flex items-center justify-between border-b border-border px-4 py-2">
          <Link to="/groups" className="flex h-10 items-center font-display text-lg font-black leading-none tracking-tight text-primary">
            BingeWyrm
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="flex h-10 items-center px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </header>
      )}
      <main className="flex-1 overflow-auto">
        <div key={location.pathname} className="animate-[fade-in_150ms_ease-out]">
          <Outlet />
        </div>
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
    element: (
      <ErrorBoundary>
        <AppLayout />
      </ErrorBoundary>
    ),
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
