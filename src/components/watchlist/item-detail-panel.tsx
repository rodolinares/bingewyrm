import { useState, useEffect } from 'react'
import { supabase, supabaseUrl$ } from '@/lib/supabase'
import { fetchAniListItem, type AniListMedia } from '@/lib/anilist'
import type { Item } from '@/queries/watchlists'
import { tmdbImg } from '@/lib/media'

interface DetailData {
  overview: string | null
  vote_average: number | null
  genres: string[]
  runtime: number | null
  poster_path: string | null
}

type MediaType = 'movie' | 'series' | 'anime' | 'anime_movie'

interface Props {
  item: Item
  mediaType: MediaType
  open: boolean
  onClose: () => void
}

function tmdbType(mediaType: MediaType): 'movie' | 'tv' {
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

export function ItemDetailPanel({ item, mediaType, open, onClose }: Props) {
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
        vote_average: null,
        genres: [],
        runtime: null,
        poster_path: item.poster_path
      })
      setLoading(false)
    }
  }, [open, item.source_id, item.source, mediaType, item.vote_average, item.genres, item.poster_path])

  if (!open) return null

  const posterSrc = item.poster_path
    ? item.source === 'anilist' || item.poster_path.startsWith('http')
      ? item.poster_path
      : tmdbImg(item.poster_path, 'w300')
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex h-[90dvh] w-full max-w-lg flex-col rounded-t-lg border border-border bg-card shadow-lg sm:rounded-lg sm:h-[80dvh]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <button
            onClick={onClose}
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
                <span>{item.year}</span>
                {item.vote_average != null && item.vote_average > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    {item.vote_average.toFixed(1)}
                  </span>
                )}
                {detail?.runtime != null && <span>{detail.runtime} min</span>}
              </div>
              {(detail?.genres ?? item.genres)?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(detail?.genres ?? item.genres).map(g => (
                    <span key={g} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading details...</p>
          ) : detail?.overview ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{detail.overview}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
