import { createBrowserRouter, Navigate, Outlet, redirect } from 'react-router'
import type { RouteObject } from 'react-router'
import { supabase } from '@/lib/supabase'
import Login from '@/pages/auth/login'
import AuthCallback from '@/pages/auth/callback'
import Onboarding from '@/pages/onboarding'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
    </div>
  )
}

function AppLayout() {
  return (
    <div className="flex h-screen">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

async function requireAuth() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw redirect('/auth/login')
}

async function requireOnboarding() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('display_name').eq('id', data.session.user.id).single()

  if (!profile?.display_name) throw redirect('/onboarding')
}

const protectedChildren: RouteObject[] = [
  {
    path: 'groups',
    children: [
      { index: true, element: <Placeholder title="My Groups" /> },
      {
        path: ':groupId',
        children: [
          { index: true, element: <Placeholder title="Group Home" /> },
          { path: 'settings', element: <Placeholder title="Group Settings" /> },
          { path: 'transfer-leader', element: <Placeholder title="Transfer Leader" /> }
        ]
      }
    ]
  },
  { path: 'invite/:code', element: <Placeholder title="Joining group..." /> },
  {
    path: 'watchlist/:watchlistId',
    children: [
      { index: true, element: <Placeholder title="Watchlist" /> },
      { path: 'start-session', element: <Placeholder title="Start Session" /> },
      { path: 'vote', element: <Placeholder title="Vote" /> },
      { path: 'results', element: <Placeholder title="Results" /> },
      { path: 'history', element: <Placeholder title="History" /> }
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
