export interface AniListMedia {
  id: number
  title: { romaji: string; english: string | null }
  coverImage: { medium: string }
  startDate: { year: number | null }
  format: string
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
    }
  }
}`

export async function searchAniList(query: string, format: 'TV' | 'MOVIE'): Promise<AniListMedia[]> {
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
