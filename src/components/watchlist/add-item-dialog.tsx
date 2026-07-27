import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useAddItem } from '@/queries/watchlists'
import { supabase, supabaseUrl$ } from '@/lib/supabase'
import { searchAniList, type AniListMedia } from '@/lib/anilist'
import { tmdbImg, MEDIA_LABELS as TYPE_LABELS } from '@/lib/media'

interface SearchResult {
  source_id: string
  title: string
  year: number | null
  poster_path: string | null
  overview?: string | null
  vote_average?: number | null
  genres?: string[]
}

interface DetailResult {
  overview: string | null
  vote_average: number | null
  genres: string[]
  runtime: number | null
  poster_path: string | null
  backdrop_path: string | null
}

type MediaType = 'movie' | 'series' | 'anime' | 'anime_movie'

interface Props {
  watchlistId: string
  mediaType: MediaType
  userId: string
  onAdded: () => void
}

function tmdbType(mediaType: MediaType): 'movie' | 'tv' {
  return mediaType === 'movie' ? 'movie' : 'tv'
}

function anilistFormat(mediaType: MediaType): 'TV' | 'MOVIE' {
  return mediaType === 'anime_movie' ? 'MOVIE' : 'TV'
}

function mapAniListResults(results: AniListMedia[]): SearchResult[] {
  return results.map(m => ({
    source_id: String(m.id),
    title: m.title.english ?? m.title.romaji,
    year: m.startDate.year,
    poster_path: m.coverImage.medium,
    overview: m.description ? m.description.replace(/<[^>]*>/g, '').trim() : null,
    vote_average: m.averageScore != null ? m.averageScore / 10 : null,
    genres: m.genres ?? []
  }))
}

export function AddItemDialog({ watchlistId, mediaType, userId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'search' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Map<string, SearchResult>>(new Map())
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set())
  const [detailItem, setDetailItem] = useState<SearchResult | null>(null)
  const [detail, setDetail] = useState<DetailResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const addItem = useAddItem()
  const debounceRef = useRef<number | undefined>(undefined)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  const [manualTitle, setManualTitle] = useState('')
  const [manualYear, setManualYear] = useState('')

  const fetchExistingIds = async () => {
    const { data } = await supabase
      .from('items')
      .select('source_id')
      .eq('watchlist_id', watchlistId)
      .is('removed_at', null)
    if (data) setExistingIds(new Set(data.map(i => i.source_id).filter(Boolean) as string[]))
  }

  useEffect(() => {
    if (open) fetchExistingIds()
  }, [open, watchlistId])

  useEffect(() => {
    if (open && tab === 'search' && !detailItem) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open, tab, detailItem])

  const handleClose = () => {
    setOpen(false)
    setQuery('')
    setResults([])
    setError(null)
    setSuccess(null)
    setSelected(new Set())
    setSelectedItems(new Map())
    setDetailItem(null)
    setDetail(null)
    setManualTitle('')
    setManualYear('')
    setTab('search')
    clearTimeout(closeTimerRef.current)
  }

  const searchQuery = tab === 'search' ? query.trim() : ''

  useEffect(() => {
    if (!searchQuery) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        if (mediaType === 'movie' || mediaType === 'series') {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData.session?.access_token
          const res = await fetch(
            `${supabaseUrl$}/functions/v1/tmdb-search?q=${encodeURIComponent(searchQuery)}&type=${tmdbType(mediaType)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (!res.ok) throw new Error('Search failed')
          const data = await res.json()
          setResults(data.results)
        } else {
          const format = anilistFormat(mediaType)
          const media = await searchAniList(searchQuery, format)
          setResults(mapAniListResults(media))
        }
      } catch {
        setError('Search failed. Try again.')
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [searchQuery, mediaType])

  const displayedResults = useMemo(() => {
    const resultIds = new Set(results.map(r => r.source_id))
    const pinned = [...selectedItems.values()].filter(r => !resultIds.has(r.source_id))
    return [...results, ...pinned]
  }, [results, selectedItems])

  const toggleSelect = (result: SearchResult) => {
    const { source_id } = result
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(source_id)) next.delete(source_id)
      else next.add(source_id)
      return next
    })
    setSelectedItems(prev => {
      const next = new Map(prev)
      if (next.has(source_id)) next.delete(source_id)
      else next.set(source_id, result)
      return next
    })
  }

  const fetchDetail = async (item: SearchResult) => {
    setDetailItem(item)
    setDetailLoading(true)
    setDetail(null)

    if (mediaType === 'anime' || mediaType === 'anime_movie') {
      // AniList: data already in search result
      setDetail({
        overview: item.overview ?? null,
        vote_average: item.vote_average ?? null,
        genres: item.genres ?? [],
        runtime: null,
        poster_path: item.poster_path,
        backdrop_path: null
      })
      setDetailLoading(false)
      return
    }

    // TMDb: fetch from detail endpoint
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch(
        `${supabaseUrl$}/functions/v1/tmdb-search/detail/${item.source_id}?type=${tmdbType(mediaType)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error('Failed to load details')
      const data = await res.json()
      setDetail(data)
    } catch {
      // Fall back to search data
      setDetail({
        overview: item.overview ?? null,
        vote_average: item.vote_average ?? null,
        genres: item.genres ?? [],
        runtime: null,
        poster_path: item.poster_path,
        backdrop_path: null
      })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDetailAdd = async (item: SearchResult) => {
    setError(null)
    setSuccess(null)
    try {
      await addItem.mutateAsync({
        watchlist_id: watchlistId,
        title: item.title,
        source: mediaType === 'movie' || mediaType === 'series' ? 'tmdb' : 'anilist',
        source_id: item.source_id,
        year: item.year ?? new Date().getFullYear(),
        poster_path: item.poster_path,
        vote_average: item.vote_average ?? null,
        genres: item.genres ?? [],
        added_by: userId
      })
      setSuccess(`Added "${item.title}"`)
      closeTimerRef.current = setTimeout(() => {
        setDetailItem(null)
        setDetail(null)
        setSuccess(null)
        fetchExistingIds()
        onAdded()
      }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item')
    }
  }

  const handleBatchAdd = async () => {
    setError(null)
    setSuccess(null)
    const toAdd = [...selectedItems.values()].filter(r => selected.has(r.source_id))
    let added = 0
    let failed = 0

    for (const result of toAdd) {
      try {
        await addItem.mutateAsync({
          watchlist_id: watchlistId,
          title: result.title,
          source: mediaType === 'movie' || mediaType === 'series' ? 'tmdb' : 'anilist',
          source_id: result.source_id,
          year: result.year ?? new Date().getFullYear(),
          poster_path: result.poster_path,
          vote_average: result.vote_average ?? null,
          genres: result.genres ?? [],
          added_by: userId
        })
        added++
      } catch {
        failed++
      }
    }

    if (failed > 0 && added > 0) {
      setError(`${added} added, ${failed} failed`)
    } else if (failed > 0) {
      setError('Failed to add items')
    } else {
      setSuccess(`Added ${added} item${added > 1 ? 's' : ''}`)
      closeTimerRef.current = setTimeout(() => handleClose(), 1500)
    }

    setSelected(new Set())
    setSelectedItems(new Map())
    fetchExistingIds()
    onAdded()
  }

  const handleManualAdd = async () => {
    if (!manualTitle.trim() || !manualYear) return
    setError(null)
    setSuccess(null)
    const year = parseInt(manualYear, 10)
    if (isNaN(year) || year < 1800 || year > 2100) {
      setError('Enter a valid year')
      return
    }
    try {
      await addItem.mutateAsync({
        watchlist_id: watchlistId,
        title: manualTitle.trim(),
        source: 'manual',
        source_id: null,
        year,
        poster_path: null,
        vote_average: null,
        genres: [],
        added_by: userId
      })
      setSuccess('Added item')
      closeTimerRef.current = setTimeout(() => handleClose(), 1500)
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item')
    }
  }

  // Detail panel
  if (detailItem) {
    const isAdded = existingIds.has(detailItem.source_id)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Add Item</Button>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
            <div className="flex h-[90dvh] w-full max-w-lg flex-col rounded-t-lg border border-border bg-card shadow-lg sm:rounded-lg sm:h-[80dvh]">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <button
                  onClick={() => { setDetailItem(null); setDetail(null); setError(null); setSuccess(null) }}
                  className="flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  &larr; Back
                </button>
                <button
                  onClick={handleClose}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  &times;
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {success && (
                  <div className="mb-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{success}</div>
                )}
                {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

                <div className="flex gap-4">
                  {detailItem.poster_path ? (
                    <img
                      src={
                        detailItem.poster_path.startsWith('http')
                          ? detailItem.poster_path
                          :             tmdbImg(detailItem.poster_path, 'w300')
                      }
                      alt=""
                      className="h-40 w-28 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-28 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      No img
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-foreground">{detailItem.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {detailItem.year && <span>{detailItem.year}</span>}
                      {detail?.vote_average != null && detail.vote_average > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="text-yellow-400">★</span>
                          {detail.vote_average.toFixed(1)}
                        </span>
                      )}
                      {detail?.runtime != null && <span>{detail.runtime} min</span>}
                    </div>
                    {detail?.genres && detail.genres.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {detail.genres.map(g => (
                          <span key={g} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {detailLoading ? (
                  <p className="mt-4 text-sm text-muted-foreground">Loading details...</p>
                ) : detail?.overview ? (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{detail.overview}</p>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-border p-4">
                {isAdded ? (
                  <div className="text-center text-sm text-emerald-400">Already in watchlist</div>
                ) : (
                  <Button
                    onClick={() => handleDetailAdd(detailItem)}
                    disabled={addItem.isPending || !!success}
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {addItem.isPending ? 'Adding...' : `Add to ${TYPE_LABELS[mediaType]}`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Search / list view
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Item</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
          <div className="flex h-[90dvh] w-full max-w-lg flex-col rounded-t-lg border border-border bg-card shadow-lg sm:rounded-lg sm:h-[80dvh]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-lg font-bold text-foreground">Add to {TYPE_LABELS[mediaType]}</h2>
              <button
                onClick={handleClose}
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <div className="flex border-b border-border">
              <button
                onClick={() => setTab('search')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === 'search' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'
                }`}
              >
                Search
              </button>
              <button
                onClick={() => setTab('manual')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === 'manual' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'
                }`}
              >
                Manual Entry
              </button>
            </div>

            {success && (
              <div className="mx-4 mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{success}</div>
            )}

            <div className="flex-1 overflow-auto p-4">
              {tab === 'search' ? (
                <>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={`Search ${(TYPE_LABELS[mediaType] ?? mediaType).toLowerCase()}...`}
                    className="mb-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {searching && <p className="text-sm text-muted-foreground">Searching...</p>}
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <div className="space-y-2">
                    {displayedResults.map(r => {
                      const isSelected = selected.has(r.source_id)
                      const isAdded = existingIds.has(r.source_id)
                      const isPinned = !results.some(res => res.source_id === r.source_id)
                      return (
                        <div
                          key={r.source_id}
                          className={`flex items-center gap-3 rounded-md border p-3 transition-colors ${
                            isAdded
                              ? 'cursor-default border-border opacity-50'
                              : isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50 hover:bg-accent'
                          } ${isPinned ? 'border-l-2 border-l-primary' : ''}`}
                        >
                          <button
                            onClick={() => !isAdded && toggleSelect(r)}
                            disabled={isAdded}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                          >
                            {isAdded ? (
                              <span className="text-[10px] text-muted-foreground">✓</span>
                            ) : isSelected ? (
                              <div className="flex h-full w-full items-center justify-center rounded-full border-primary bg-primary text-primary-foreground">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : null}
                          </button>
                          {r.poster_path ? (
                            <img
                              src={r.poster_path.startsWith('http') ? r.poster_path : tmdbImg(r.poster_path, 'w200')}
                              alt=""
                              className="h-16 w-12 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-12 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                              No img
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{r.year ?? 'Unknown year'}</span>
                              {r.vote_average != null && r.vote_average > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <span className="text-yellow-400">★</span>
                                  {r.vote_average.toFixed(1)}
                                </span>
                              )}
                            </div>
                            {isAdded && (
                              <span className="mt-1 inline-block rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                                Added
                              </span>
                            )}
                          </div>
                          {!isAdded && (
                            <button
                              onClick={() => fetchDetail(r)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="View details"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm text-foreground">Title</label>
                    <input
                      value={manualTitle}
                      onChange={e => setManualTitle(e.target.value)}
                      placeholder="Enter title"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-foreground">Year</label>
                    <input
                      value={manualYear}
                      onChange={e => setManualYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="e.g. 2024"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    onClick={handleManualAdd}
                    disabled={!manualTitle.trim() || !manualYear || addItem.isPending}
                    className="h-11 w-full"
                  >
                    {addItem.isPending ? 'Adding...' : 'Add Item'}
                  </Button>
                </div>
              )}
            </div>

            {tab === 'search' && selected.size > 0 && (
              <div className="shrink-0 border-t border-border p-4">
                <Button
                  onClick={handleBatchAdd}
                  disabled={addItem.isPending}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {addItem.isPending ? 'Adding...' : `Add ${selected.size} item${selected.size > 1 ? 's' : ''}`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
