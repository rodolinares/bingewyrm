import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { useItems, useWatchlist, useStartSession, useActiveSession } from '@/queries/watchlists'
import { useGroupMembers, useGroupGenreBlacklist } from '@/queries/groups'
import { Button } from '@/components/ui/button'
import { posterUrl } from '@/lib/media'

const PRESETS = [
  { label: '1m', ms: 60_000 },
  { label: '15m', ms: 900_000 },
  { label: '1h', ms: 3_600_000 },
  { label: '6h', ms: 21_600_000 },
  { label: '24h', ms: 86_400_000 }
] as const

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

function toInterval(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${s} seconds`
}

export default function SessionStart() {
  const { watchlistId } = useParams<{ watchlistId: string }>()
  const navigate = useNavigate()
  const { data: watchlist } = useWatchlist(watchlistId!)
  const { data: items, isLoading: itemsLoading } = useItems(watchlistId!)
  const { data: members } = useGroupMembers(watchlist?.group_id)
  const { data: blacklist } = useGroupGenreBlacklist(watchlist?.group_id)
  const { data: activeSession } = useActiveSession(watchlistId!)
  const startSession = useStartSession()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [durationMs, setDurationMs] = useState(3_600_000)
  const [customMinutes, setCustomMinutes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const blacklistSet = new Set(blacklist ?? [])
  const eligibleItems =
    items?.filter(i => {
      if (i.watched) return false
      if (blacklistSet.size > 0 && i.genres?.some(g => blacklistSet.has(g))) return false
      return true
    }) ?? []

  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === eligibleItems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(eligibleItems.map(i => i.id)))
    }
  }

  const handleCustomMinutes = (val: string) => {
    setCustomMinutes(val)
    const m = parseInt(val, 10)
    if (!isNaN(m) && m > 0) {
      setDurationMs(m * 60_000)
    }
  }

  const handleStart = async () => {
    if (selected.size < 2) {
      setError('Select at least 2 items')
      return
    }
    if (!members || members.length < 2) {
      setError('At least 2 members required')
      return
    }
    setError(null)
    try {
      const session = await startSession.mutateAsync({
        watchlistId: watchlistId!,
        itemIds: Array.from(selected),
        duration: toInterval(durationMs)
      })
      navigate(`/session/${session.id}/vote`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start session')
    }
  }

  if (itemsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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

  if (activeSession) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">An active session already exists for this watchlist.</p>
        <Link
          to={`/session/${activeSession.id}/vote`}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
        >
          Go to active session
        </Link>
      </div>
    )
  }

  if (eligibleItems.length < 2) {
    return (
      <div className="p-6">
        <Link to={`/watchlist/${watchlistId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to watchlist
        </Link>
        <p className="mt-4 text-muted-foreground">
          Need at least 2 unwatched items to start a session. Currently {eligibleItems.length} eligible.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link to={`/watchlist/${watchlistId}`} className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to watchlist
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Start Session</h1>
      <p className="mt-1 text-sm text-muted-foreground">Select items to include and set a time limit.</p>

      {/* Time limit */}
      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Time Limit</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => {
                setDurationMs(p.ms)
                setCustomMinutes('')
              }}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                durationMs === p.ms && !customMinutes
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            value={customMinutes}
            onChange={e => handleCustomMinutes(e.target.value)}
            placeholder="min"
            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Session ends: {formatDuration(durationMs)} or when all members vote, whichever comes first.
        </p>
      </section>

      {/* Item picker */}
      <section className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Items ({selected.size}/{eligibleItems.length})
          </h2>
          <button onClick={toggleAll} className="text-xs text-primary hover:underline">
            {selected.size === eligibleItems.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="space-y-1">
          {eligibleItems.map(item => (
            <label
              key={item.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 transition-colors ${
                selected.has(item.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggleItem(item.id)}
                className="accent-primary"
              />
              {posterUrl(item, 'w200') ? (
                <img src={posterUrl(item, 'w200')!} alt="" className="h-12 w-9 rounded object-cover" />
              ) : (
                <div className="flex h-12 w-9 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                  No img
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.year}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-6">
        <Button onClick={handleStart} disabled={selected.size < 2 || startSession.isPending} className="w-full">
          {startSession.isPending
            ? 'Starting...'
            : `Start Session (${selected.size} items, ${formatDuration(durationMs)})`}
        </Button>
      </div>
    </div>
  )
}
