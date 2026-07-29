import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { useUser } from '@/hooks/use-user'
import { useGroups } from '@/queries/groups'
import { useWatchlist } from '@/queries/watchlists'
import { useSession, useSessionItems, useMyVotes, useCastVote, useEndSession, useDeleteVote } from '@/queries/sessions'
import { useRealtimeSession } from '@/hooks/use-realtime'
import { seededShuffle } from '@/lib/shuffle'
import { Button } from '@/components/ui/button'
import { posterUrl } from '@/lib/media'

export default function VotingPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: session, isLoading: sessionLoading, isError: sessionError } = useSession(sessionId!)
  const { data: allItems, isLoading: itemsLoading } = useSessionItems(session?.item_ids ?? [])
  const { data: votes } = useMyVotes(sessionId!, user?.id)
  const castVote = useCastVote()
  const endSession = useEndSession()
  const deleteVote = useDeleteVote()
  const { data: watchlist } = useWatchlist(session?.watchlist_id ?? '')
  const { data: groups } = useGroups()
  useRealtimeSession(sessionId!)

  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState<'yes' | 'no' | null>(null)
  const [dragX, setDragX] = useState(0)
  const [lastVote, setLastVote] = useState<{ itemId: string } | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isDragging = useRef(false)


  const myVotedIds = useMemo(() => new Set((votes ?? []).map(v => v.item_id)), [votes])

  const deck = useMemo(() => {
    if (!allItems || !user) return []
    const eligible = allItems.filter(i => !myVotedIds.has(i.id))
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
        value
      })
    } catch {
      setAnimating(null)
      return
    }
    setLastVote({ itemId: item.id })
    setTimeout(() => {
      setAnimating(null)
      setIndex(i => i + 1)
    }, 200)
  }

  const handleUndo = async () => {
    if (!lastVote || !session || animating) return
    setLastVote(null)
    try {
      await deleteVote.mutateAsync({
        sessionId: session.id,
        itemId: lastVote.itemId
      })
    } catch {
      return
    }
    setIndex(i => Math.max(0, i - 1))
  }

  const SWIPE_THRESHOLD = 80

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX
    touchStartY.current = e.touches[0]!.clientY
    isDragging.current = false
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (animating) return
      const dx = e.touches[0]!.clientX - touchStartX.current
      const dy = e.touches[0]!.clientY - touchStartY.current
      if (!isDragging.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isDragging.current = true
      }
      if (isDragging.current) {
        e.preventDefault()
        setDragX(dx)
      }
    },
    [animating]
  )

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    if (dragX > SWIPE_THRESHOLD) {
      setDragX(0)
      handleVote(true)
    } else if (dragX < -SWIPE_THRESHOLD) {
      setDragX(0)
      handleVote(false)
    } else {
      setDragX(0)
    }
  }, [dragX, handleVote])

  const handleEndEarly = async () => {
    if (!session) return
    await endSession.mutateAsync(session.id)
    navigate(`/session/${sessionId}/results`, { replace: true })
  }

  if (sessionLoading || itemsLoading || votes === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (sessionError || !session) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Failed to load session.</p>
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
        <Link to={`/watchlist/${session?.watchlist_id}`} className="text-sm text-primary hover:underline">
          Back to watchlist
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      {/* Progress */}
      <p className="mb-4 text-sm text-muted-foreground">
        {allItems ? allItems.length - deck.length + 1 : 0} of {allItems?.length ?? 0}
      </p>

      {/* Card */}
      <div
        className={`flex w-full max-w-sm flex-col items-center rounded-xl border border-border bg-card p-4 shadow-lg transition-transform sm:p-6 ${
          animating === 'yes' ? 'translate-x-8 opacity-0' : animating === 'no' ? '-translate-x-8 opacity-0' : ''
        }`}
        style={{
          transitionDuration: dragX === 0 ? '200ms' : '0ms',
          transform: dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX * 0.05}deg)` : undefined
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {posterUrl(current, 'w500') ? (
          <img
            src={posterUrl(current, 'w500')!}
            alt=""
            className="mb-4 h-48 w-32 rounded-lg object-cover sm:h-64 sm:w-44"
          />
        ) : (
          <div className="mb-4 flex h-48 w-32 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground sm:h-64 sm:w-44">
            No poster
          </div>
        )}
        <h3 className="text-center text-lg font-bold text-foreground">{current.title}</h3>
        <p className="text-sm text-muted-foreground">{current.year}</p>
      </div>

      {/* Vote buttons */}
      <div className="mt-4 flex gap-6 sm:mt-6">
        <button
          onClick={() => handleVote(false)}
          disabled={!!animating}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background text-2xl transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50 sm:h-16 sm:w-16"
        >
          ✕
        </button>
        <button
          onClick={() => handleVote(true)}
          disabled={!!animating}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background text-2xl transition-colors hover:border-green-500/50 hover:text-green-500 disabled:opacity-50 sm:h-16 sm:w-16"
        >
          ♥
        </button>
      </div>

      {/* Undo */}
      {lastVote && (
        <button
          onClick={handleUndo}
          disabled={deleteVote.isPending}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Undo last vote
        </button>
      )}

      {/* End early (leader only) */}
      {isLeader && (
        <button
          onClick={handleEndEarly}
          disabled={endSession.isPending}
          className="mt-4 px-4 py-2 text-sm text-muted-foreground hover:text-foreground sm:mt-6"
        >
          End session early
        </button>
      )}
    </div>
  )
}
