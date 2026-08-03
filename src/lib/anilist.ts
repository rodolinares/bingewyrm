export interface AniListMedia {
  id: number
  title: { romaji: string; english: string | null }
  coverImage: { medium: string }
  startDate: { year: number | null }
  format: string
  description: string | null
  averageScore: number | null
  genres: string[]
  externalLinks?: { site: string; url: string }[]
}

interface AniListResponse {
  data: {
    Page: {
      media: AniListMedia[]
    }
  }
}

const ANILIST_URL = 'https://graphql.anilist.co'

const SEARCH_QUERY = `query ($search: String, $format: [MediaFormat]) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME, format_in: $format) {
      id
      title { romaji english }
      coverImage { medium }
      startDate { year }
      format
      description(asHtml: false)
      averageScore
      genres
    }
  }
}`

export const searchAniList = async (query: string, format: 'TV' | 'MOVIE'): Promise<AniListMedia[]> => {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { search: query, format: [format] }
    })
  })

  if (!res.ok) throw new Error('AniList search failed')
  const data: AniListResponse = await res.json()
  return data.data.Page.media
}

const SINGLE_QUERY = `query ($id: Int) {
  Media(id: $id) {
    id
    title { romaji english }
    coverImage { medium }
    startDate { year }
    format
    description(asHtml: false)
    averageScore
    genres
    externalLinks { site url }
  }
}`

interface SingleResponse {
  data: {
    Media: AniListMedia
  }
}

export const fetchAniListItem = async (id: string): Promise<AniListMedia> => {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: SINGLE_QUERY,
      variables: { id: Number(id) }
    })
  })

  if (!res.ok) throw new Error('AniList fetch failed')
  const data: SingleResponse = await res.json()
  return data.data.Media
}
