export const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p'

export const MEDIA_LABELS: Record<string, string> = {
  movie: 'Movies',
  series: 'Series',
  anime: 'Anime',
  anime_movie: 'Anime Movies'
}

export const tmdbImg = (path: string, size: string): string => {
  return `${TMDB_IMG_BASE}/${size}${path}`
}

export interface MediaItem {
  source: string
  poster_path: string | null
}

export const posterUrl = (item: MediaItem, size: string): string | null => {
  if (!item.poster_path) return null
  if (item.source === 'anilist') return item.poster_path
  return tmdbImg(item.poster_path, size)
}
