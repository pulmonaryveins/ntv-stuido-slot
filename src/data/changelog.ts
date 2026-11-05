import type { IconName } from '../ui/PixelIcon'

/**
 * "What's new": user-facing release notes, newest first. Shown once after sign-in when there is
 * an entry the user has not seen (tracked per user in this browser), and any time from the
 * account menu. To announce a change, add an entry at the top with a new, unique `id`.
 * Write for users, not developers: what they can do now, in a line each.
 */
export interface ChangelogEntry {
  /** Unique and increasing (yyyy-mm-dd plus a letter for a second update that day). */
  id: string
  date: string
  title: string
  items: { icon: IconName; text: string }[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-11-05b',
    date: '2026-11-05',
    title: 'Your own character',
    items: [
      { icon: 'user', text: 'Customize your character: pick a hero or build your own block character (account menu → Customize character).' },
      { icon: 'palette', text: 'Choose gender, skin, hair, outfit, shoes, facial hair and accessories, or start from an office quick look.' },
      { icon: 'sparkle', text: 'Live 3D preview: drag to turn it, try the Idle, Walk and Wave poses.' },
      { icon: 'check', text: 'Your new look shows up for everyone right away, in the studio and next to your name.' },
    ],
  },
  {
    id: '2026-11-05a',
    date: '2026-11-05',
    title: 'Profiles, notifications and polish',
    items: [
      { icon: 'user', text: 'Click anyone in the 3D studio to see their profile card: what they are doing, their device and recent activity.' },
      { icon: 'bell', text: 'Notifications are easier to spot: bottom right, colour-coded, with a countdown bar. Hover to keep one open.' },
      { icon: 'brush', text: 'Redrawn icons, smoother animations and pixel cursors.' },
      { icon: 'sun', text: 'Floor lamps in the office now lean over the areas they light.' },
    ],
  },
  {
    id: '2026-11-04a',
    date: '2026-11-04',
    title: 'The office grows',
    items: [
      { icon: 'block', text: 'A street outside the office, a bigger studio and a details window for every seat.' },
      { icon: 'key', text: 'Fixed password reset links.' },
    ],
  },
]

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id ?? ''

const key = (userId: string) => `ss.changelog.seen.${userId}`

/** The newest entry this user has seen in this browser ('' = none). */
export function seenChangelog(userId: string): string {
  try {
    return localStorage.getItem(key(userId)) ?? ''
  } catch {
    return LATEST_CHANGELOG_ID // storage blocked: do not nag on every visit
  }
}

export function markChangelogSeen(userId: string) {
  try {
    localStorage.setItem(key(userId), LATEST_CHANGELOG_ID)
  } catch {
    /* storage blocked: the dialog simply shows again next time */
  }
}

/** Entries newer than `seen` (ids sort as strings). */
export function unseenEntries(seen: string): ChangelogEntry[] {
  return CHANGELOG.filter((e) => e.id > seen)
}
