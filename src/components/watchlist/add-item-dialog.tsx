import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useAddItem } from '@/queries/watchlists'
import { supabase, supabaseUrl$ } from '@/lib/supabase'
import { searchAniList, type AniListMedia } from '@/lib/anilist'

interface SearchResult {
  source_id: string
  title: string
  year: number | null
  poster_path: string | null
}

type MediaType = 'movie' | 'series' | 'anime' | 'anime_movie'

interface Props {
  watchlistId: string
  mediaType: MediaType
  userId: string
  onAdded: () => void
}

const TYPE_LABELS: Record<string, string> = {
  movie: 'Movies',
  series: 'Series',
  anime: 'Anime',
  anime_movie: 'Anime Movies'
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
    poster_path: m.coverImage.medium
  }))
}

export function AddItemDialog({ watchlistId, mediaType, userId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'search' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addItem = useAddItem()
  const debounceRef = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  const [manualTitle, setManualTitle] = useState('')
  const [manualYear, setManualYear] = useState('')

  useEffect(() => {
    if (open && tab === 'search') {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open, tab])

  const handleClose = () => {
    setOpen(false)
    setQuery('')
    setResults([])
    setError(null)
    setManualTitle('')
    setManualYear('')
    setTab('search')
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

  const handleAdd = async (result: SearchResult) => {
    setError(null)
    try {
      await addItem.mutateAsync({
        watchlist_id: watchlistId,
        title: result.title,
        source: mediaType === 'movie' || mediaType === 'series' ? 'tmdb' : 'anilist',
        source_id: result.source_id,
        year: result.year ?? new Date().getFullYear(),
        poster_path: result.poster_path,
        added_by: userId
      })
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item')
    }
  }

  const handleManualAdd = async () => {
    if (!manualTitle.trim() || !manualYear) return
    setError(null)
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
        added_by: userId
      })
      setManualTitle('')
      setManualYear('')
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item')
    }
  }

  const TMDB_IMG = 'https://image.tmdb.org/t/p/w200'

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Item</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
          <div className="flex h-[90dvh] w-full max-w-lg flex-col rounded-t-lg border border-border bg-card shadow-lg sm:rounded-lg sm:h-[80vh]">
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
                    {results.map(r => (
                      <button
                        key={r.source_id}
                        onClick={() => handleAdd(r)}
                        className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                      >
                        {r.poster_path ? (
                          <img
                            src={r.poster_path.startsWith('http') ? r.poster_path : `${TMDB_IMG}${r.poster_path}`}
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
                          <p className="text-xs text-muted-foreground">{r.year ?? 'Unknown year'}</p>
                        </div>
                      </button>
                    ))}
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
          </div>
        </div>
      )}
    </>
  )
}
