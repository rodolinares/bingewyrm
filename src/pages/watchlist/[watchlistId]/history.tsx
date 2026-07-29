import { useParams, Link } from 'react-router'
import { useWatchlist } from '@/queries/watchlists'
import { usePastSessions } from '@/queries/sessions'
import { Spinner } from '@/components/ui/spinner'
import { MEDIA_LABELS } from '@/lib/media'

const OUTCOME_LABELS: Record<string, string> = {
  saved: 'Saved',
  recycled: 'Recycled',
  discarded: 'Discarded'
}

const END_REASON_LABELS: Record<string, string> = {
  manual: 'Ended early',
  time_limit: 'Time ran out',
  all_voted: 'All voted'
}

export default function SessionHistory() {
  const { watchlistId } = useParams<{ watchlistId: string }>()
  const { data: watchlist } = useWatchlist(watchlistId!)
  const { data: sessions, isLoading } = usePastSessions(watchlistId!)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
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

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link to={`/watchlist/${watchlistId}`} className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to {MEDIA_LABELS[watchlist.media_type]}
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Session History</h1>

      {!sessions || sessions.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No sessions yet. Start one from the watchlist page.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {sessions.map(session => (
            <Link
              key={session.id}
              to={`/session/${session.id}/results`}
              className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {new Date(session.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {END_REASON_LABELS[session.end_reason ?? ''] ?? session.end_reason ?? 'Unknown'}
                  {' · '}
                  {session.item_ids.length} items
                </p>
              </div>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  session.outcome === 'saved'
                    ? 'bg-green-500/20 text-green-400'
                    : session.outcome === 'recycled'
                      ? 'bg-blue-500/20 text-blue-400'
                      : session.outcome === 'discarded'
                        ? 'bg-destructive/20 text-destructive'
                        : 'bg-muted text-muted-foreground'
                }`}
              >
                {session.outcome ? OUTCOME_LABELS[session.outcome] : 'Pending'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
