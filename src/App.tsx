import { createBrowserRouter, Navigate, Outlet } from 'react-router'

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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/groups" replace /> },
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
      },
      { path: 'onboarding', element: <Placeholder title="Set Display Name" /> },
      { path: 'auth/callback', element: <Placeholder title="Signing in..." /> },
      { path: '*', element: <Navigate to="/groups" replace /> }
    ]
  }
])
