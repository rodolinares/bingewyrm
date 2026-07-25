import { Link, Outlet, useParams } from 'react-router'
import { useGroups } from '@/queries/groups'
import { useUser } from '@/hooks/use-user'

export default function GroupLayout() {
  const { groupId } = useParams()
  const { data: groups } = useGroups()
  const { profile } = useUser()

  const group = groups?.find(g => g.id === groupId)
  const isLeader = group?.leader_id === profile?.id

  if (!group) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading group...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <aside className="flex w-60 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <Link to="/groups" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; All groups
          </Link>
          <h2 className="mt-2 text-lg font-bold text-foreground">{group.name}</h2>
          <p className="text-xs text-muted-foreground">{isLeader ? 'Leader' : 'Member'}</p>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          <NavLink to={`/groups/${groupId}`}>Watchlists</NavLink>
          <NavLink to={`/groups/${groupId}/settings`}>Settings</NavLink>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet context={{ group, isLeader }} />
      </main>
    </div>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </Link>
  )
}
