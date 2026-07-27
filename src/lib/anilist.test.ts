import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchAniList, fetchAniListItem } from './anilist'

const mockMedia = {
  id: 1,
  title: { romaji: 'Test Anime', english: 'Test Anime EN' },
  coverImage: { medium: 'https://example.com/cover.jpg' },
  startDate: { year: 2024 },
  format: 'TV',
  description: '<p>A test anime</p>',
  averageScore: 80,
  genres: ['Action', 'Drama']
}

const mockSearchResponse = {
  data: {
    Page: {
      media: [mockMedia]
    }
  }
}

const mockSingleResponse = {
  data: {
    Media: mockMedia
  }
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockSearchResponse)
    } as Response)
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('searchAniList', () => {
  it('returns media array on success', async () => {
    const result = await searchAniList('test', 'TV')
    expect(result).toHaveLength(1)
    expect(result[0]?.title.romaji).toBe('Test Anime')
  })

  it('sends correct GraphQL query structure', async () => {
    await searchAniList('naruto', 'TV')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://graphql.anilist.co',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('naruto')
      })
    )

    const body = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string) ?? '{}')
    expect(body.variables).toEqual({ search: 'naruto', format: ['TV'] })
  })

  it('passes MOVIE format', async () => {
    await searchAniList('test', 'MOVIE')
    const body = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string) ?? '{}')
    expect(body.variables.format).toEqual(['MOVIE'])
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: false
      } as Response)
    )
    await expect(searchAniList('test', 'TV')).rejects.toThrow('AniList search failed')
  })

  it('throws on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => Promise.reject(new Error('Network error')))
    await expect(searchAniList('test', 'TV')).rejects.toThrow('Network error')
  })
})

describe('fetchAniListItem', () => {
  it('returns single media item', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSingleResponse)
      } as Response)
    )

    const result = await fetchAniListItem('1')
    expect(result.id).toBe(1)
    expect(result.title.romaji).toBe('Test Anime')
  })

  it('sends id as number', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSingleResponse)
      } as Response)
    )

    await fetchAniListItem('42')
    const body = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string) ?? '{}')
    expect(body.variables.id).toBe(42)
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: false
      } as Response)
    )
    await expect(fetchAniListItem('1')).rejects.toThrow('AniList fetch failed')
  })
})
