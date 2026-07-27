import { describe, it, expect } from 'vitest'
import { tmdbImg, posterUrl, TMDB_IMG_BASE, MEDIA_LABELS } from './media'

describe('tmdbImg', () => {
  it('joins base, size, and path', () => {
    expect(tmdbImg('/abc.jpg', 'w500')).toBe(`${TMDB_IMG_BASE}/w500/abc.jpg`)
  })

  it('passes path through as-is (no slash added)', () => {
    expect(tmdbImg('abc.jpg', 'original')).toBe(`${TMDB_IMG_BASE}/originalabc.jpg`)
  })
})

describe('posterUrl', () => {
  it('returns null when poster_path is null', () => {
    expect(posterUrl({ source: 'tmdb', poster_path: null }, 'w500')).toBeNull()
  })

  it('returns tmdb URL for tmdb source', () => {
    expect(posterUrl({ source: 'tmdb', poster_path: '/x.jpg' }, 'w500')).toBe(
      `${TMDB_IMG_BASE}/w500/x.jpg`
    )
  })

  it('returns raw URL for anilist source', () => {
    expect(posterUrl({ source: 'anilist', poster_path: 'https://anilist.co/img.jpg' }, 'w500')).toBe(
      'https://anilist.co/img.jpg'
    )
  })
})

describe('MEDIA_LABELS', () => {
  it('maps all expected media types', () => {
    expect(MEDIA_LABELS).toMatchObject({
      movie: 'Movies',
      series: 'Series',
      anime: 'Anime',
      anime_movie: 'Anime Movies'
    })
  })
})
