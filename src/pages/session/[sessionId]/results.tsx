import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { useUser } from '@/hooks/use-user'
import { useGroups } from '@/queries/groups'
import { useWatchlist } from '@/queries/watchlists'
import {
  useSession,
  useSessionItems,
  useSessionVotes,
  useSessionParticipants,
  useResolveOutcome
} from '@/queries/sessions'
import { Button } from '@/components/ui/button'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w200'

interface RankedItem {
  id: string
  title: string
  year: number
  poster_path: string | null
  source: string
  added_at: string
  voteCount: number
}

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: session, isLoading: sessionLoading } = useSession(sessionId!)
  const { data: items, isLoading: itemsLoading } = useSessionItems(session?.item_ids ?? [])
  const { data: votes } = useSessionVotes(sessionId!)
  const { data: participants } = useSessionParticipants(sessionId!)
  const { data: watchlist } = useWatchlist(session?.watchlist_id ?? '')
  const { data: groups } = useGroups()
  const resolveOutcome = useResolveOutcome()

  const [confirmAction, setConfirmAction] = useState<'saved' | 'recycled' | 'discarded' | null>(null)

  const ranked = useMemo(() => {
    if (!items || !votes) return []
    const voteCounts = new Map<string, number>()
    for (const v of votes) {
      if (v.value) voteCounts.set(v.item_id, (voteCounts.get(v.item_id) ?? 0) + 1)
    }
    const result: RankedItem[] = items.map(i => ({
      id: i.id,
      title: i.title,
      year: i.year,
      poster_path: i.poster_path,
      source: i.source,
      added_at: i.added_at,
      voteCount: voteCounts.get(i.id) ?? 0
    }))
    result.sort((a, b) => b.voteCount - a.voteCount || a.added_at.localeCompare(b.added_at))
    return result
  }, [items, votes])

  const isLeader = groups?.some(g => g.id === watchlist?.group_id && g.leader_id === user?.id) ?? false
  const voterCount = participants?.length ?? 0
  const isResolved = !!session?.outcome

  const handleResolve = async (outcome: 'saved' | 'recycled' | 'discarded') => {
    if (!session) return
    const discardIds = outcome === 'discarded' ? items?.map(i => i.id) : undefined
    await resolveOutcome.mutateAsync({
      sessionId: session.id,
      outcome,
      discardItemIds: discardIds
    })
    setConfirmAction(null)
    navigate(`/watchlist/${session.watchlist_id}`, { replace: true })
  }

  if (sessionLoading || itemsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Session not found.</p>
      </div>
    )
  }

  const posterUrl = (item: { source: string; poster_path: string | null }) => {
    if (!item.poster_path) return null
    if (item.source === 'anilist') return item.poster_path
    return `${TMDB_IMG}${item.poster_path}`
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link to={`/watchlist/${session.watchlist_id}`} className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to watchlist
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Results</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {session.end_reason === 'manual'
          ? 'Ended early'
          : session.end_reason === 'time_limit'
            ? 'Time ran out'
            : 'All members voted'}
        {' · '}
        {voterCount} voter{voterCount !== 1 ? 's' : ''}
        {session.outcome && (
          <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
            {session.outcome}
          </span>
        )}
      </p>

      {/* Ranked items */}
      <div className="mt-6 space-y-2">
        {ranked.map((item, i) => (
          <div key={item.id} className="flex items-center gap-3 rounded-md border border-border p-3">
            <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
            {posterUrl(item) ? (
              <img src={posterUrl(item)!} alt="" className="h-12 w-9 rounded object-cover" />
            ) : (
              <div className="flex h-12 w-9 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                No img
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.year}</p>
            </div>
            <span className="text-sm font-medium text-foreground">
              {item.voteCount}/{voterCount}
            </span>
          </div>
        ))}
      </div>

      {/* Leader actions */}
      {isLeader && !isResolved && (
        <div className="mt-8 space-y-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-foreground">Decide Outcome</h2>
          {!confirmAction ? (
            <div className="flex gap-2">
              <Button onClick={() => handleResolve('saved')} disabled={resolveOutcome.isPending}>
                Save
              </Button>
              <Button variant="outline" onClick={() => handleResolve('recycled')} disabled={resolveOutcome.isPending}>
                Recycle
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmAction('discarded')}
                disabled={resolveOutcome.isPending}
              >
                Discard
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                {confirmAction === 'discarded'
                  ? 'This will remove all items from the watchlist. The watchlist itself stays. This cannot be undone.'
                  : `Are you sure you want to ${confirmAction === 'saved' ? 'save' : 'recycle'} these results?`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant={confirmAction === 'discarded' ? 'destructive' : 'default'}
                  onClick={() => handleResolve(confirmAction)}
                  disabled={resolveOutcome.isPending}
                >
                  {resolveOutcome.isPending
                    ? 'Processing...'
                    : confirmAction === 'discarded'
                      ? 'Yes, discard'
                      : 'Confirm'}
                </Button>
                <Button variant="outline" onClick={() => setConfirmAction(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
