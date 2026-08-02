import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { useUser } from '@/hooks/use-user'
import { useGroups } from '@/queries/groups'
import { useWatchlist } from '@/queries/watchlists'
import { useSession, useSessionItems, useMyVotes, useCastVote, useEndSession, useDeleteVote, useSessionParticipants, useSessionVotes } from '@/queries/sessions'
import type { Item } from '@/queries/watchlists'
import { useRealtimeSession } from '@/hooks/use-realtime'
import { seededShuffle } from '@/lib/shuffle'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { posterUrl } from '@/lib/media'
import { ItemDetailPanel } from '@/components/watchlist/item-detail-panel'
import { InfoIcon, EyeIcon } from '@/components/icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'

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
  const { data: participants } = useSessionParticipants(sessionId!)
  const { data: allVotes } = useSessionVotes(sessionId!)
  useRealtimeSession(sessionId!)

  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState<'yes' | 'no' | null>(null)
  const [thrownItemId, setThrownItemId] = useState<string | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [lastVote, setLastVote] = useState<{ itemId: string; value: boolean } | null>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [progressOpen, setProgressOpen] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isDragging = useRef(false)


  const myVotedIds = useMemo(() => new Set((votes ?? []).map(v => v.item_id)), [votes])

  const deck = useMemo(() => {
    if (!allItems || !user) return []
    return seededShuffle(allItems, user.id + sessionId)
  }, [allItems, user, sessionId])

  const [current, ...backCards] = useMemo(() => {
    const unvoted: Item[] = []
    for (let i = index; i < deck.length && unvoted.length < 2; i++) {
      const id = deck[i]!.id
      if (id === thrownItemId || !myVotedIds.has(id)) unvoted.push(deck[i]!)
    }
    return unvoted
  }, [deck, index, myVotedIds, thrownItemId])

  useEffect(() => {
    for (const item of deck.slice(index + 1 + backCards.length, index + 4)) {
      const url = posterUrl(item, 'w500')
      if (url) {
        const img = new Image()
        img.src = url
      }
    }
  }, [deck, index, backCards.length])

  const votingProgress = useMemo(() => {
    if (!participants || !allVotes || !session) return []
    const total = session.item_ids.length
    return participants.map(p => ({
      userId: p.user_id,
      displayName: p.users.display_name ?? 'Unnamed',
      votesCast: allVotes.filter(v => v.user_id === p.user_id).length,
      total,
      done: allVotes.filter(v => v.user_id === p.user_id).length === total
    }))
  }, [participants, allVotes, session])

  const isExpired = session ? new Date(session.end_time) <= new Date() : false
  const isEnded = session?.status === 'ended' || isExpired

  useEffect(() => {
    if (session && isEnded) {
      navigate(`/session/${sessionId}/results`, { replace: true })
    }
  }, [session, isEnded, navigate, sessionId])

  const prevCard = useMemo(() => (lastVote ? deck.find(d => d.id === lastVote.itemId) : undefined), [deck, lastVote])

  const handleVote = async (value: boolean) => {
    if (!user || !session || !current || undoing) return
    setAnimating(value ? 'yes' : 'no')
    setThrownItemId(current.id)
    try {
      await castVote.mutateAsync({
        sessionId: session.id,
        itemId: current.id,
        value
      })
    } catch {
      setAnimating(null)
      setThrownItemId(null)
      return
    }
    setLastVote({ itemId: current.id, value })
    setTimeout(() => {
      setAnimating(null)
      setThrownItemId(null)
      setIndex(i => i + 1)
    }, 200)
  }

  const handleUndo = async () => {
    if (!lastVote || !session || animating || undoing) return
    setUndoing(true)
    try {
      await deleteVote.mutateAsync({
        sessionId: session.id,
        itemId: lastVote.itemId
      })
    } catch {
      setUndoing(false)
      return
    }
    setTimeout(() => {
      setUndoing(false)
      setLastVote(null)
      setIndex(i => Math.max(0, i - 1))
    }, 200)
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
        <Spinner />
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
        <div className="flex flex-col items-center gap-2">
          <Spinner />
          <p className="text-sm text-muted-foreground">Loading results...</p>
        </div>
      </div>
    )
  }

  const isLeader = groups?.some(g => g.id === watchlist?.group_id && g.leader_id === user?.id) ?? false

  if (!current) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <h2 className="text-xl font-bold text-foreground">You&apos;re done!</h2>
        {isLeader ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">Waiting for other members.</p>
            <Button variant="outline" onClick={() => setProgressOpen(true)}>
              <EyeIcon className="mr-1.5 h-4 w-4" />
              View voting progress
            </Button>
            <Button onClick={handleEndEarly} disabled={endSession.isPending}>
              End Session Early
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for other members to finish voting.</p>
        )}
        <Link to={`/watchlist/${session?.watchlist_id}`} className="text-sm text-primary hover:underline">
          Back to watchlist
        </Link>

        <VotingProgressDialog
          open={progressOpen}
          onClose={() => setProgressOpen(false)}
          progress={votingProgress}
          onEndEarly={handleEndEarly}
          endEarlyPending={endSession.isPending}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      {/* Progress */}
      <div className="mb-4 flex w-full max-w-sm items-center gap-3">
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${allItems ? ((myVotedIds.size + 1) / allItems.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {myVotedIds.size + 1}/{allItems?.length ?? 0}
        </p>
      </div>

      {/* Card stack */}
      <div className="relative w-full max-w-sm">
        {backCards.map(item => (
          <div
            key={item.id}
            className={`pointer-events-none absolute inset-x-0 top-3 z-0 flex flex-col items-center rounded-xl border border-border bg-card p-4 shadow-lg transition-all duration-200 sm:p-6 ${
              animating ? 'scale-100 translate-y-0 opacity-100' : 'scale-[0.95] translate-y-3 opacity-60'
            }`}
          >
            <CardBody item={item} />
          </div>
        ))}
        <div
          key={current.id}
          className={`relative z-10 flex w-full flex-col items-center rounded-xl border border-border bg-card p-4 shadow-lg transition-all sm:p-6 ${
            undoing
              ? 'scale-[0.95] translate-y-3 opacity-60'
              : animating === 'yes'
                ? 'translate-x-64 rotate-12 opacity-0'
                : animating === 'no'
                  ? '-translate-x-64 -rotate-12 opacity-0'
                  : ''
          }`}
          style={{
            transitionDuration: dragX === 0 ? '200ms' : '0ms',
            transform: dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX * 0.05}deg)` : undefined
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <CardBody item={current} />
        </div>
        {undoing && prevCard && <UndoOverlay item={prevCard} fromRight={lastVote?.value ?? false} />}
      </div>

      {/* Vote buttons */}
      <div className="mt-8 flex items-center gap-6 sm:mt-8">
        <button
          onClick={handleUndo}
          disabled={!lastVote || deleteVote.isPending || undoing}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-xl transition-colors hover:text-foreground disabled:opacity-50 sm:h-14 sm:w-14"
        >
          ↺
        </button>
        <button
          onClick={() => handleVote(false)}
          disabled={!!animating || undoing}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background text-2xl transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50 sm:h-16 sm:w-16"
        >
          ✕
        </button>
        <button
          onClick={() => handleVote(true)}
          disabled={!!animating || undoing}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background text-2xl transition-colors hover:border-green-500/50 hover:text-green-500 disabled:opacity-50 sm:h-16 sm:w-16"
        >
          ♥
        </button>
        <button
          onClick={() => setDetailItemId(current!.id)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background transition-colors hover:text-foreground sm:h-14 sm:w-14"
        >
          <InfoIcon className="h-5 w-5" />
        </button>
      </div>

      <Link
        to={`/watchlist/${session.watchlist_id}`}
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
      >
        Back to watchlist
      </Link>

      {detailItemId && current && (
        <ItemDetailPanel
          item={current}
          mediaType={watchlist?.media_type ?? 'movie'}
          open
          onClose={() => setDetailItemId(null)}
        />
      )}

      {/* Leader progress button + end early */}
      {isLeader && (
        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={() => setProgressOpen(true)}>
            <EyeIcon className="mr-1.5 h-4 w-4" />
            Progress
          </Button>
          <Button variant="outline" onClick={handleEndEarly} disabled={endSession.isPending}>
            End early
          </Button>
        </div>
      )}

      <VotingProgressDialog
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        progress={votingProgress}
        onEndEarly={handleEndEarly}
        endEarlyPending={endSession.isPending}
      />
    </div>
  )
}

interface ProgressItem {
  userId: string
  displayName: string
  votesCast: number
  total: number
  done: boolean
}

function Poster({ item }: { item: Item }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const url = posterUrl(item, 'w500')

  if (!url || failed) {
    return (
      <div className="mb-4 flex h-48 w-32 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground sm:h-64 sm:w-44">
        No poster
      </div>
    )
  }

  return (
    <div className="relative mb-4 h-48 w-32 overflow-hidden rounded-lg sm:h-64 sm:w-44">
      <img
        src={url}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Spinner />
        </div>
      )}
    </div>
  )
}

function CardBody({ item }: { item: Item }) {
  return (
    <>
      <Poster key={item.id} item={item} />
      <h3 className="text-center text-lg font-bold text-foreground">{item.title}</h3>
      <p className="text-sm text-muted-foreground">{item.year}</p>
      {item.genres.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {item.genres.slice(0, 3).map(g => (
            <span key={g} className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {g}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

function UndoOverlay({ item, fromRight }: { item: Item; fromRight: boolean }) {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className={`absolute inset-x-0 top-0 z-20 flex flex-col items-center rounded-xl border border-border bg-card p-4 shadow-lg transition-all duration-200 sm:p-6 ${
        settled
          ? 'translate-x-0 rotate-0 opacity-100'
          : fromRight
            ? 'translate-x-64 rotate-12 opacity-0'
            : '-translate-x-64 -rotate-12 opacity-0'
      }`}
    >
      <CardBody item={item} />
    </div>
  )
}

function VotingProgressDialog({
  open,
  onClose,
  progress,
  onEndEarly,
  endEarlyPending
}: {
  open: boolean
  onClose: () => void
  progress: ProgressItem[]
  onEndEarly: () => void
  endEarlyPending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Voting progress</DialogTitle>
          <DialogDescription>How many items each member has voted on.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {progress.map(p => (
            <div key={p.userId} className="flex items-center gap-3">
              <span className="w-24 truncate text-sm text-foreground">{p.displayName}</span>
              <div className="flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(p.votesCast / p.total) * 100}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {p.votesCast}/{p.total}
              </span>
            </div>
          ))}
        </div>
        <Button onClick={onEndEarly} disabled={endEarlyPending} className="w-full">
          End session early
        </Button>
      </DialogContent>
    </Dialog>
  )
}
