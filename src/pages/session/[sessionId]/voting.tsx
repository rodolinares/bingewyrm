import { useState, useMemo, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { useUser } from '@/hooks/use-user'
import { useGroups } from '@/queries/groups'
import { useWatchlist } from '@/queries/watchlists'
import { useSession, useSessionItems, useMyVotes, useCastVote, useEndSession } from '@/queries/sessions'
import { useRealtimeSession } from '@/hooks/use-realtime'
import { seededShuffle } from '@/lib/shuffle'
import { Button } from '@/components/ui/button'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500'

export default function VotingPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: session, isLoading: sessionLoading } = useSession(sessionId!)
  const { data: allItems, isLoading: itemsLoading } = useSessionItems(session?.item_ids ?? [])
  const { data: votes } = useMyVotes(sessionId!, user?.id)
  const castVote = useCastVote()
  const endSession = useEndSession()
  const { data: watchlist } = useWatchlist(session?.watchlist_id ?? '')
  const { data: groups } = useGroups()
  useRealtimeSession(sessionId!)

  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState<'yes' | 'no' | null>(null)

  const myVotedIds = useMemo(() => new Set((votes ?? []).filter(v => !v.is_auto).map(v => v.item_id)), [votes])

  const deck = useMemo(() => {
    if (!allItems || !user) return []
    const eligible = allItems.filter(i => i.added_by !== user.id && !myVotedIds.has(i.id))
    return seededShuffle(eligible, user.id + sessionId)
  }, [allItems, user, myVotedIds, sessionId])

  const isExpired = session ? new Date(session.end_time) <= new Date() : false
  const isEnded = session?.status === 'ended' || isExpired

  useEffect(() => {
    if (session && isEnded) {
      navigate(`/session/${sessionId}/results`, { replace: true })
    }
  }, [session, isEnded, navigate, sessionId])

  const handleVote = async (value: boolean) => {
    if (!user || !session || index >= deck.length) return
    const item = deck[index]!
    setAnimating(value ? 'yes' : 'no')
    try {
      await castVote.mutateAsync({
        sessionId: session.id,
        itemId: item.id,
        userId: user.id,
        value
      })
    } catch {
      setAnimating(null)
      return
    }
    setTimeout(() => {
      setAnimating(null)
      setIndex(i => i + 1)
    }, 200)
  }

  const handleEndEarly = async () => {
    if (!session) return
    await endSession.mutateAsync(session.id)
    navigate(`/session/${sessionId}/results`, { replace: true })
  }

  if (sessionLoading || itemsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
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

  if (isEnded) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Session ended. Loading results...</p>
      </div>
    )
  }

  const current = deck[index]
  const isLeader = groups?.some(g => g.id === watchlist?.group_id && g.leader_id === user?.id) ?? false

  if (!current) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-bold text-foreground">You&apos;re done!</h2>
        <p className="text-sm text-muted-foreground">Waiting for other members to finish voting.</p>
        {isLeader && (
          <Button onClick={handleEndEarly} disabled={endSession.isPending}>
            End Session Early
          </Button>
        )}
        <Link to="/groups" className="text-sm text-primary hover:underline">
          Back to groups
        </Link>
      </div>
    )
  }

  const posterUrl = current.poster_path
    ? current.source === 'anilist'
      ? current.poster_path
      : `${TMDB_IMG}${current.poster_path}`
    : null

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      {/* Progress */}
      <p className="mb-4 text-sm text-muted-foreground">
        {index + 1} of {deck.length}
      </p>

      {/* Card */}
      <div
        className={`flex w-full max-w-sm flex-col items-center rounded-xl border border-border bg-card p-6 shadow-lg transition-transform ${
          animating === 'yes' ? 'translate-x-8 opacity-0' : animating === 'no' ? '-translate-x-8 opacity-0' : ''
        }`}
        style={{ transitionDuration: '200ms' }}
      >
        {posterUrl ? (
          <img src={posterUrl} alt="" className="mb-4 h-64 w-44 rounded-lg object-cover" />
        ) : (
          <div className="mb-4 flex h-64 w-44 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
            No poster
          </div>
        )}
        <h3 className="text-center text-lg font-bold text-foreground">{current.title}</h3>
        <p className="text-sm text-muted-foreground">{current.year}</p>
      </div>

      {/* Vote buttons */}
      <div className="mt-6 flex gap-6">
        <button
          onClick={() => handleVote(false)}
          disabled={!!animating}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-background text-2xl transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
        >
          ✕
        </button>
        <button
          onClick={() => handleVote(true)}
          disabled={!!animating}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-background text-2xl transition-colors hover:border-green-500/50 hover:text-green-500 disabled:opacity-50"
        >
          ♥
        </button>
      </div>

      {/* End early (leader only) */}
      {isLeader && (
        <button
          onClick={handleEndEarly}
          disabled={endSession.isPending}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground"
        >
          End session early
        </button>
      )}
    </div>
  )
}
