import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router'
import { useItems, useWatchlist, useRemoveItem, useRemoveItems, useToggleWatched, useActiveSession } from '@/queries/watchlists'
import { useUser } from '@/hooks/use-user'
import {
  useLastUnresolvedSession,
  useLastResolvedSession,
  useSessionVotes,
  useSessionParticipants
} from '@/queries/sessions'
import { useRealtimeItems } from '@/hooks/use-realtime'
import { AddItemDialog } from '@/components/watchlist/add-item-dialog'
import { ItemDetailPanel } from '@/components/watchlist/item-detail-panel'
import { Button } from '@/components/ui/button'
import { useGroups } from '@/queries/groups'
import { MEDIA_LABELS, posterUrl } from '@/lib/media'

type SortBy = 'title' | 'year' | 'vote_average' | 'added_at'
type SortDir = 'asc' | 'desc'

interface SortOption {
  label: string
  by: SortBy
  dir: SortDir
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Date Added (oldest)', by: 'added_at', dir: 'asc' },
  { label: 'Date Added (newest)', by: 'added_at', dir: 'desc' },
  { label: 'Title (A-Z)', by: 'title', dir: 'asc' },
  { label: 'Title (Z-A)', by: 'title', dir: 'desc' },
  { label: 'Year (newest)', by: 'year', dir: 'desc' },
  { label: 'Year (oldest)', by: 'year', dir: 'asc' },
  { label: 'Rating (highest)', by: 'vote_average', dir: 'desc' },
  { label: 'Rating (lowest)', by: 'vote_average', dir: 'asc' }
]

function loadSort(): SortOption {
  try {
    const raw = localStorage.getItem('watchlist-sort')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.by === 'string' && (parsed.dir === 'asc' || parsed.dir === 'desc')) {
        return parsed as SortOption
      }
    }
  } catch {}
  return SORT_OPTIONS[0]!
}

export default function WatchlistDetail() {
  const { watchlistId } = useParams<{ watchlistId: string }>()
  const { user } = useUser()
  const { data: items, isLoading, isError } = useItems(watchlistId!)
  const removeItem = useRemoveItem()
  const removeItems = useRemoveItems()
  const toggleWatched = useToggleWatched()
  const { data: watchlist } = useWatchlist(watchlistId!)
  const { data: groups } = useGroups()
  const { data: activeSession } = useActiveSession(watchlistId!)
  const { data: unresolvedSession } = useLastUnresolvedSession(watchlistId!)
  const { data: resolvedSession } = useLastResolvedSession(watchlistId!)
  const { data: resolvedVotes } = useSessionVotes(resolvedSession?.id ?? '')
  const { data: resolvedParticipants } = useSessionParticipants(resolvedSession?.id ?? '')
  useRealtimeItems(watchlistId!)

  const [sort, setSort] = useState<SortOption>(loadSort)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchConfirm, setBatchConfirm] = useState(false)

  const sortedItems = useMemo(() => {
    if (!items) return []
    const sorted = [...items]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sort.by === 'vote_average') {
        if (a.vote_average == null && b.vote_average == null) cmp = 0
        else if (a.vote_average == null) cmp = 1
        else if (b.vote_average == null) cmp = -1
        else cmp = a.vote_average - b.vote_average
      } else if (sort.by === 'title') {
        cmp = a.title.localeCompare(b.title)
      } else if (sort.by === 'year') {
        cmp = a.year - b.year
      } else {
        cmp = a.added_at.localeCompare(b.added_at)
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [items, sort])

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = SORT_OPTIONS[Number(e.target.value)]!
    setSort(opt)
    localStorage.setItem('watchlist-sort', JSON.stringify(opt))
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading watchlist...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Failed to load watchlist.</p>
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
          {unresolvedSession ? (
            <Link
              to={`/session/${unresolvedSession.id}/results`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground transition-all hover:bg-accent/80"
            >
              View Results
            </Link>
          ) : activeSession ? (
            <Link
              to={`/session/${activeSession.id}/vote`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
            >
              Active Session
            </Link>
          ) : isLeader ? (
            <Button
              render={<Link to={`/watchlist/${watchlistId}/start-session`} />}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={eligibleCount < 2}
            >
              Start Session
            </Button>
          ) : null}
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

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={SORT_OPTIONS.findIndex(o => o.by === sort.by && o.dir === sort.dir)}
            onChange={handleSortChange}
            className="flex h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SORT_OPTIONS.map((opt, i) => (
              <option key={i} value={i}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => { setEditMode(!editMode); setSelectedIds(new Set()); setBatchConfirm(false) }}
            className={`flex h-8 items-center rounded-md border px-2 text-xs font-medium transition-colors ${
              editMode ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:text-foreground'
            }`}
          >
            {editMode ? 'Done' : 'Select'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {editMode && selectedIds.size > 0 && (
            batchConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-destructive">Remove {selectedIds.size}?</span>
                <button
                  onClick={() => {
                    removeItems.mutate({ ids: [...selectedIds], watchlistId: watchlistId! })
                    setEditMode(false)
                    setSelectedIds(new Set())
                    setBatchConfirm(false)
                  }}
                  className="flex h-7 items-center rounded bg-destructive px-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/80"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setBatchConfirm(false)}
                  className="flex h-7 items-center rounded border border-input px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setBatchConfirm(true)}
                className="flex h-7 items-center rounded border border-input px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Remove {selectedIds.size}
              </button>
            )
          )}
          {items && <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {editMode && selectedIds.size > 0 && selectedIds.size < sortedItems.length && (
        <button
          onClick={() => setSelectedIds(new Set(sortedItems.map(i => i.id)))}
          className="mb-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Select all {sortedItems.length} items
        </button>
      )}

      {!sortedItems || sortedItems.length === 0 ? (
        <p className="text-muted-foreground">No items yet. Add something to get started.</p>
      ) : (
        <div className="space-y-2">
          {sortedItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              {editMode && (
                <button
                  onClick={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                    selectedIds.has(item.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30 hover:border-muted-foreground'
                  }`}
                >
                  {selectedIds.has(item.id) && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}
              {posterUrl(item, 'w200') ? (
                <img src={posterUrl(item, 'w200')!} alt="" className="h-16 w-12 rounded object-cover" />
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
                <button
                  onClick={() => setDetailItemId(item.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="View details"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
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
                {(item.added_by === user?.id || isLeader) && (
                  confirmingId === item.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-destructive">Remove?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          removeItem.mutate({ id: item.id, watchlistId: watchlistId! })
                          setConfirmingId(null)
                        }}
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingId(item.id)}>
                      Remove
                    </Button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Last resolved session results */}
      {resolvedSession && (
        <div className="mt-8 border-t border-border pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Latest Results</h2>
            <Link to={`/watchlist/${watchlistId}/history`} className="text-sm text-primary hover:underline">
              Full history
            </Link>
          </div>
          <Link
            to={`/session/${resolvedSession.id}/results`}
            className="block rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
          >
            <p className="text-sm text-muted-foreground">
              {new Date(resolvedSession.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
              {' · '}
              {resolvedSession.item_ids.length} items
            </p>
            {resolvedVotes && resolvedParticipants && (
              <p className="mt-1 text-xs text-muted-foreground">
                {resolvedVotes.filter(v => v.value).length} total yes votes across {resolvedParticipants.length} voters
              </p>
            )}
            <span
              className={`mt-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                resolvedSession.outcome === 'saved'
                  ? 'bg-green-500/20 text-green-400'
                  : resolvedSession.outcome === 'recycled'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-destructive/20 text-destructive'
              }`}
            >
              {resolvedSession.outcome}
            </span>
          </Link>
        </div>
      )}

      {detailItemId && items && (
        <ItemDetailPanel
          item={items.find(i => i.id === detailItemId)!}
          mediaType={watchlist.media_type}
          open
          onClose={() => setDetailItemId(null)}
        />
      )}
    </div>
  )
}
