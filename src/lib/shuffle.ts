// Deterministic PRNG (mulberry32) seeded from userId + sessionId.
// Same user + session always produces the same shuffle order.
export const seededShuffle = <T>(items: T[], seed: string): T[] => {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }

  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    const j = ((t ^ (t >>> 14)) >>> 0) % (i + 1)
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}
