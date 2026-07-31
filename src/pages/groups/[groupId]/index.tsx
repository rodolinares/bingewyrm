import { Link, Outlet, useParams } from 'react-router'
import { useGroups } from '@/queries/groups'
import { useUser } from '@/hooks/use-user'
import { useWatchlists } from '@/queries/watchlists'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { CreateWatchlistDialog } from '@/components/group/create-watchlist-dialog'
import { MEDIA_LABELS } from '@/lib/media'

export default function GroupLayout() {
  const { groupId } = useParams()
  const { data: groups, isLoading, isError } = useGroups()
  const { profile } = useUser()

  const group = groups?.find(g => g.id === groupId)
  const isLeader = group?.leader_id === profile?.id

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !group) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-destructive">Failed to load group.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r border-border bg-card sm:flex">
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

      {/* Mobile group header */}
      <div className="flex items-center border-b border-border px-4 py-3 sm:hidden">
        <Link to="/groups" className="mr-3 text-sm text-muted-foreground hover:text-foreground">
          &larr;
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-foreground">{group.name}</h2>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto sm:pb-0">
        <Outlet context={{ group, isLeader }} />
      </main>

      {/* Mobile bottom nav */}
      <nav className="flex shrink-0 border-t border-border bg-card sm:hidden">
        <BottomNavLink to={`/groups/${groupId}`} label="Watchlists" />
        <BottomNavLink to={`/groups/${groupId}/settings`} label="Settings" />
      </nav>
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

function BottomNavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-1 items-center justify-center py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      {label}
    </Link>
  )
}

export function GroupWatchlists() {
  const { groupId } = useParams()
  const { data: watchlists, isLoading, isError } = useWatchlists(groupId!)

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Watchlists</h1>
        {groupId && (
          <CreateWatchlistDialog
            groupId={groupId}
            existingTypes={watchlists?.map(w => w.media_type) ?? []}
          />
        )}
      </div>
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-2 h-3 w-16" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="text-destructive">Failed to load watchlists.</p>
      ) : !watchlists || watchlists.length === 0 ? (
        <p className="text-muted-foreground">No watchlists yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4">
          {watchlists.map(w => (
            <Link
              key={w.id}
              to={`/watchlist/${w.id}`}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <h3 className="font-semibold text-foreground">{MEDIA_LABELS[w.media_type]}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{w.item_count ?? 0} items</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
