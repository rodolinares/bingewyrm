import { describe, it, expect } from 'vitest'
import { seededShuffle } from './shuffle'

describe('seededShuffle', () => {
  it('returns array of same length', () => {
    const items = [1, 2, 3, 4, 5]
    const result = seededShuffle(items, 'test-seed')
    expect(result).toHaveLength(5)
  })

  it('contains all original elements', () => {
    const items = [1, 2, 3, 4, 5]
    const result = seededShuffle(items, 'test-seed')
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('does not mutate original array', () => {
    const items = [1, 2, 3, 4, 5]
    const copy = [...items]
    seededShuffle(items, 'test-seed')
    expect(items).toEqual(copy)
  })

  it('produces same order for same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const result1 = seededShuffle(items, 'same-seed')
    const result2 = seededShuffle(items, 'same-seed')
    expect(result1).toEqual(result2)
  })

  it('produces different order for different seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const result1 = seededShuffle(items, 'seed-a')
    const result2 = seededShuffle(items, 'seed-b')
    expect(result1).not.toEqual(result2)
  })

  it('handles empty array', () => {
    expect(seededShuffle([], 'seed')).toEqual([])
  })

  it('handles single element', () => {
    expect(seededShuffle([42], 'seed')).toEqual([42])
  })

  it('handles two elements', () => {
    const items = [1, 2]
    const result = seededShuffle(items, 'two-elem')
    expect(result).toHaveLength(2)
    expect(result).toContain(1)
    expect(result).toContain(2)
  })

  it('produces shuffled order (statistical check)', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const result = seededShuffle(items, 'shuffle-check')
    const samePosition = items.filter((v, i) => result[i] === v).length
    expect(samePosition).toBeLessThan(items.length)
  })

  it('works with object arrays', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = seededShuffle(items, 'object-seed')
    expect(result).toHaveLength(3)
    expect(result.map(r => r.id).sort()).toEqual([1, 2, 3])
  })
})
