import type { Snapshot } from '../data/types'

/**
 * Devices a user worked on recently, offered as one-click options when they are not at their
 * usual computer. Combines their saved device, picks remembered in this browser, and devices
 * they claimed seats on (activity feed). Case-insensitive de-duplication, newest first.
 */
const MAX = 6
const key = (userId: string) => `ss.recentDevices.${userId}`

function stored(userId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(userId)) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Remember a device the user just used (newest first). */
export function rememberDevice(userId: string | null, device: string | null | undefined) {
  if (!userId || !device) return
  const next = [device, ...stored(userId).filter((d) => d.toLowerCase() !== device.toLowerCase())].slice(0, MAX)
  try {
    localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
    /* storage unavailable: options still come from the profile and activity */
  }
}

export function recentDevices(snapshot: Snapshot | null, userId: string | null): string[] {
  if (!snapshot || !userId) return []
  const saved = snapshot.profiles.find((p) => p.id === userId)?.device_name
  const fromActivity = snapshot.activity
    .filter((a) => a.action === 'claim' && a.user_id === userId)
    .map((a) => (a.meta as { device_name?: string } | null)?.device_name)
  const out: string[] = []
  for (const d of [saved, ...stored(userId), ...fromActivity]) {
    if (d && !out.some((x) => x.toLowerCase() === d.toLowerCase())) out.push(d)
    if (out.length >= MAX) break
  }
  return out
}
