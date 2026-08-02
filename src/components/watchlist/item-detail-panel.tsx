import { useState, useEffect, type ReactNode } from 'react'
import { supabase, supabaseUrl$ } from '@/lib/supabase'
import { fetchAniListItem, type AniListMedia } from '@/lib/anilist'
import { Skeleton } from '@/components/ui/skeleton'
import { posterUrl } from '@/lib/media'

interface DetailData {
  overview: string | null
  vote_average: number | null
  genres: string[]
  runtime: number | null
  poster_path: string | null
}

export type MediaType = 'movie' | 'series' | 'anime' | 'anime_movie'

export interface DetailSource {
  title: string
  source: string
  source_id: string | null
  year: number | null
  poster_path: string | null
  vote_average: number | null
  genres?: string[]
}

interface Props {
  item: DetailSource
  mediaType: MediaType
  open: boolean
  onClose: () => void
  onBack?: () => void
  status?: ReactNode
  footer?: ReactNode
}

export function tmdbType(mediaType: MediaType): 'movie' | 'tv' {
  return mediaType === 'movie' ? 'movie' : 'tv'
}

function mapAniListDetail(m: AniListMedia): DetailData {
  return {
    overview: m.description ? m.description.replace(/<[^>]*>/g, '').trim() : null,
    vote_average: m.averageScore != null ? m.averageScore / 10 : null,
    genres: m.genres ?? [],
    runtime: null,
    poster_path: m.coverImage.medium
  }
}

export function ItemDetailPanel({ item, mediaType, open, onClose, onBack, status, footer }: Props) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !item.source_id) return

    setLoading(true)
    setDetail(null)

    if (item.source === 'anilist') {
      fetchAniListItem(item.source_id)
        .then(m => setDetail(mapAniListDetail(m)))
        .catch(() => {
          setDetail({
            overview: null,
            vote_average: item.vote_average,
            genres: item.genres ?? [],
            runtime: null,
            poster_path: item.poster_path
          })
        })
        .finally(() => setLoading(false))
    } else if (item.source === 'tmdb') {
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const token = sessionData.session?.access_token
        fetch(`${supabaseUrl$}/functions/v1/tmdb-search/detail/${item.source_id}?type=${tmdbType(mediaType)}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => (r.ok ? r.json() : Promise.reject()))
          .then(data => setDetail(data))
          .catch(() => {
            setDetail({
              overview: null,
              vote_average: item.vote_average,
              genres: item.genres ?? [],
              runtime: null,
              poster_path: item.poster_path
            })
          })
          .finally(() => setLoading(false))
      })
    } else {
      setDetail({
        overview: null,
        vote_average: item.vote_average,
        genres: item.genres ?? [],
        runtime: null,
        poster_path: item.poster_path
      })
      setLoading(false)
    }
  }, [open, item.source_id, item.source, mediaType, item.vote_average, item.genres, item.poster_path])

  if (!open) return null

  const posterSrc = posterUrl(item, 'w300')
  const rating = detail?.vote_average ?? item.vote_average
  const genres = detail?.genres ?? item.genres ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex h-[90dvh] w-full max-w-lg flex-col rounded-t-lg border border-border bg-card shadow-lg sm:rounded-lg sm:h-[80dvh]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <button
            onClick={onBack ?? onClose}
            className="flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back
          </button>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {status}
          <div className="flex gap-4">
            {posterSrc ? (
              <img src={posterSrc} alt="" className="h-40 w-28 shrink-0 rounded object-cover" />
            ) : (
              <div className="flex h-40 w-28 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                No img
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-foreground">{item.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {item.year != null && <span>{item.year}</span>}
                {rating != null && rating > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    {rating.toFixed(1)}
                  </span>
                )}
                {detail?.runtime != null && <span>{detail.runtime} min</span>}
              </div>
              {genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {genres.map(g => (
                    <span key={g} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : detail?.overview ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{detail.overview}</p>
          ) : null}
        </div>

        {footer}
      </div>
    </div>
  )
}
