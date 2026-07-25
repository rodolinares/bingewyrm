import { useParams, Link } from 'react-router'
import { useItems, useWatchlist, useRemoveItem, useToggleWatched, useActiveSession } from '@/queries/watchlists'
import { useUser } from '@/hooks/use-user'
import { useLastUnresolvedSession } from '@/queries/sessions'
import { useRealtimeItems } from '@/hooks/use-realtime'
import { AddItemDialog } from '@/components/watchlist/add-item-dialog'
import { Button } from '@/components/ui/button'
import { useGroups } from '@/queries/groups'

const MEDIA_LABELS: Record<string, string> = {
  movie: 'Movies',
  series: 'Series',
  anime: 'Anime',
  anime_movie: 'Anime Movies'
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/w200'

export default function WatchlistDetail() {
  const { watchlistId } = useParams<{ watchlistId: string }>()
  const { user } = useUser()
  const { data: items, isLoading } = useItems(watchlistId!)
  const removeItem = useRemoveItem()
  const toggleWatched = useToggleWatched()
  const { data: watchlist } = useWatchlist(watchlistId!)
  const { data: groups } = useGroups()
  const { data: activeSession } = useActiveSession(watchlistId!)
  const { data: unresolvedSession } = useLastUnresolvedSession(watchlistId!)
  useRealtimeItems(watchlistId!)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading watchlist...</p>
      </div>
    )
  }

  if (!watchlist) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Watchlist not found.</p>
      </div>
    )
  }

  const posterUrl = (item: { source: string; poster_path: string | null }) => {
    if (!item.poster_path) return null
    if (item.source === 'anilist') return item.poster_path
    return `${TMDB_IMG}${item.poster_path}`
  }

  const isLeader = groups?.some(g => g.id === watchlist?.group_id && g.leader_id === user?.id)
  const eligibleCount = items?.filter(i => !i.watched).length ?? 0

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to={`/groups/${watchlist.group_id}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to group
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{MEDIA_LABELS[watchlist.media_type]}</h1>
        </div>
        <div className="flex gap-2">
          {isLeader && (
            <>
              {unresolvedSession ? (
                <Link
                  to={`/session/${unresolvedSession.id}/results`}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-accent px-2.5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent/80"
                >
                  View Results
                </Link>
              ) : activeSession ? (
                <Link
                  to={`/session/${activeSession.id}/vote`}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
                >
                  Active Session
                </Link>
              ) : (
                <Link
                  to={`/watchlist/${watchlistId}/start-session`}
                  className={`inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-all ${
                    eligibleCount < 2
                      ? 'pointer-events-none cursor-not-allowed opacity-50'
                      : 'bg-primary text-primary-foreground hover:bg-primary/80'
                  }`}
                >
                  Start Session
                </Link>
              )}
            </>
          )}
          {user && (
            <AddItemDialog
              watchlistId={watchlistId!}
              mediaType={watchlist.media_type}
              userId={user.id}
              onAdded={() => {}}
            />
          )}
        </div>
      </div>

      {!items || items.length === 0 ? (
        <p className="text-muted-foreground">No items yet. Add something to get started.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              {posterUrl(item) ? (
                <img src={posterUrl(item)!} alt="" className="h-16 w-12 rounded object-cover" />
              ) : (
                <div className="flex h-16 w-12 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  No img
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.year}</p>
                {item.watched && (
                  <span className="inline-block mt-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Watched
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toggleWatched.mutate({
                      id: item.id,
                      watched: !item.watched,
                      watchlistId: watchlistId!
                    })
                  }
                >
                  {item.watched ? 'Unwatch' : 'Watched'}
                </Button>
                {item.added_by === user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem.mutate({ id: item.id, watchlistId: watchlistId! })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
