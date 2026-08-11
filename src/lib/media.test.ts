import { describe, it, expect, beforeEach } from 'vitest'
import {
  tmdbImg,
  posterUrl,
  formatDuration,
  TMDB_IMG_BASE,
  MEDIA_LABELS,
  detectRegion,
  parseCountryCode,
  getStoredRegion,
  setStoredRegion,
  mapTmdbProviders,
  mapAniListProviders
} from './media'

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
    expect(posterUrl({ source: 'tmdb', poster_path: '/x.jpg' }, 'w500')).toBe(`${TMDB_IMG_BASE}/w500/x.jpg`)
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

describe('detectRegion', () => {
  it('extracts region from locale with region', () => {
    expect(detectRegion('en-US')).toBe('US')
    expect(detectRegion('de-DE')).toBe('DE')
  })

  it('normalizes lowercase region to uppercase', () => {
    expect(detectRegion('pt-br')).toBe('BR')
  })

  it('falls back to US when locale has no region', () => {
    expect(detectRegion('en')).toBe('US')
    expect(detectRegion('')).toBe('US')
  })
})

describe('parseCountryCode', () => {
  it('extracts uppercase country code from geo payload', () => {
    expect(parseCountryCode({ country_code: 'pe' })).toBe('PE')
    expect(parseCountryCode({ country_code: 'US' })).toBe('US')
  })

  it('returns null for missing or malformed code', () => {
    expect(parseCountryCode({})).toBeNull()
    expect(parseCountryCode({ country_code: 42 })).toBeNull()
    expect(parseCountryCode(null)).toBeNull()
    expect(parseCountryCode({ country_code: 'USX' })).toBeNull()
  })
})

describe('mapTmdbProviders', () => {
  it('maps flatrate/rent/buy into categorized providers', () => {
    const providers = mapTmdbProviders({
      link: 'https://tmdb.org/watch',
      flatrate: [{ provider_name: 'Netflix', logo_path: '/netflix.png' }],
      rent: [{ provider_name: 'Apple TV', logo_path: '/apple.png' }],
      buy: [{ provider_name: 'Prime Video', logo_path: '/prime.png' }]
    })
    expect(providers).toEqual([
      { name: 'Netflix', logo_path: '/netflix.png', url: 'https://tmdb.org/watch', category: 'stream' },
      { name: 'Apple TV', logo_path: '/apple.png', url: 'https://tmdb.org/watch', category: 'rent' },
      { name: 'Prime Video', logo_path: '/prime.png', url: 'https://tmdb.org/watch', category: 'buy' }
    ])
  })

  it('returns empty array for null region data', () => {
    expect(mapTmdbProviders(null)).toEqual([])
  })

  it('handles missing categories', () => {
    expect(mapTmdbProviders({ flatrate: [] })).toEqual([])
  })
})

describe('mapAniListProviders', () => {
  it('maps external links to stream providers', () => {
    expect(
      mapAniListProviders([
        { site: 'Crunchyroll', url: 'https://crunchyroll.com/x' },
        { site: 'Netflix', url: 'https://netflix.com/x' }
      ])
    ).toEqual([
      { name: 'Crunchyroll', logo_path: null, url: 'https://crunchyroll.com/x', category: 'stream' },
      { name: 'Netflix', logo_path: null, url: 'https://netflix.com/x', category: 'stream' }
    ])
  })

  it('returns empty array when no links', () => {
    expect(mapAniListProviders(undefined)).toEqual([])
  })
})

describe('getStoredRegion / setStoredRegion', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns null when nothing stored', () => {
    expect(getStoredRegion()).toBeNull()
  })

  it('round-trips a stored region and normalizes to uppercase', () => {
    setStoredRegion('pe')
    expect(getStoredRegion()).toBe('PE')
  })

  it('clears stored region on null', () => {
    setStoredRegion('PE')
    setStoredRegion(null)
    expect(getStoredRegion()).toBeNull()
  })
})

describe('formatDuration', () => {
  it('returns null for unknown duration', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(undefined)).toBeNull()
    expect(formatDuration(0)).toBeNull()
    expect(formatDuration(-5)).toBeNull()
  })

  it('formats sub-hour durations as minutes', () => {
    expect(formatDuration(45)).toBe('45m')
  })

  it('formats hour+ durations', () => {
    expect(formatDuration(112)).toBe('1h 52m')
    expect(formatDuration(120)).toBe('2h')
  })
})
