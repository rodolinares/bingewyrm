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

export const tmdbType = (mediaType: 'movie' | 'series' | 'anime' | 'anime_movie'): 'movie' | 'tv' => {
  return mediaType === 'movie' ? 'movie' : 'tv'
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

export const formatDuration = (minutes: number | null | undefined): string | null => {
  if (minutes == null || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export type WatchCategory = 'stream' | 'rent' | 'buy'

export interface WatchProvider {
  name: string
  logo_path: string | null
  url: string | null
  category: WatchCategory
}

export interface TmdbRegionData {
  link?: string
  flatrate?: { provider_name: string; logo_path: string | null }[]
  rent?: { provider_name: string; logo_path: string | null }[]
  buy?: { provider_name: string; logo_path: string | null }[]
}

export const detectRegion = (locale: string): string => {
  return locale.split('-')[1]?.toUpperCase() ?? 'US'
}

export const parseCountryCode = (data: unknown): string | null => {
  const code = (data as { country_code?: unknown } | null)?.country_code
  return typeof code === 'string' && /^[A-Z]{2}$/i.test(code) ? code.toUpperCase() : null
}

let regionPromise: Promise<string> | null = null

// ponytail: IP geolocation via ipapi.co (no key, 30k req/mo), cached once per session.
// locale fallback covers offline/geo-failure. Manual override setting if users report wrong region.
const fetchRegion = async (): Promise<string> => {
  try {
    const res = await fetch('https://ipapi.co/json/')
    if (!res.ok) return detectRegion(navigator.language)
    const region = parseCountryCode(await res.json())
    return region ?? detectRegion(navigator.language)
  } catch {
    return detectRegion(navigator.language)
  }
}

export const getRegion = (): Promise<string> => {
  if (!regionPromise) regionPromise = fetchRegion()
  return regionPromise
}

const REGION_KEY = 'bingewyrm-region'

export const getStoredRegion = (): string | null => {
  try {
    const v = window.localStorage.getItem(REGION_KEY)
    return v && /^[A-Z]{2}$/i.test(v) ? v.toUpperCase() : null
  } catch {
    return null
  }
}

export const setStoredRegion = (code: string | null): void => {
  try {
    if (code) window.localStorage.setItem(REGION_KEY, code)
    else window.localStorage.removeItem(REGION_KEY)
  } catch {
    // localStorage unavailable
  }
}

// ponytail: curated list, not full ISO-3166. Covers major markets + LatAm.
// Add countries if a user can't find theirs.
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'VE', name: 'Venezuela' }
]

const mapProviderList = (
  list: TmdbRegionData['flatrate'],
  category: WatchCategory,
  link: string | null
): WatchProvider[] => {
  return (list ?? []).map(p => ({
    name: p.provider_name,
    logo_path: p.logo_path,
    url: link,
    category
  }))
}

export const mapTmdbProviders = (regionData: TmdbRegionData | null): WatchProvider[] => {
  if (!regionData) return []
  const link = regionData.link ?? null
  return [
    ...mapProviderList(regionData.flatrate, 'stream', link),
    ...mapProviderList(regionData.rent, 'rent', link),
    ...mapProviderList(regionData.buy, 'buy', link)
  ]
}

export const mapAniListProviders = (externalLinks: { site: string; url: string }[] | undefined): WatchProvider[] => {
  return (externalLinks ?? []).map(l => ({
    name: l.site,
    logo_path: null,
    url: l.url,
    category: 'stream' as const
  }))
}
