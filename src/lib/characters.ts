import type { Profile } from '../data'

/** Same string hash as the 3D kit (kept here so the UI can use it without loading three.js). */
function hashString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Random-but-stable character per user. Users are processed in sign-up order so a new user
 * never changes anyone else's character; each takes their hash-picked character, or the next
 * free one, and characters only repeat once every one is in use.
 */
export function assignCharacters(profiles: Pick<Profile, 'id' | 'created_at'>[], count: number): Map<string, number> {
  const out = new Map<string, number>()
  if (count === 0) return out
  const used = new Set<number>()
  const ordered = [...profiles].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  for (const p of ordered) {
    if (used.size >= count) used.clear()
    let idx = hashString(p.id) % count
    while (used.has(idx)) idx = (idx + 1) % count
    used.add(idx)
    out.set(p.id, idx)
  }
  return out
}
