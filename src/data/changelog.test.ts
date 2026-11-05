import { describe, expect, it } from 'vitest'
import { CHANGELOG, LATEST_CHANGELOG_ID, unseenEntries } from './changelog'

describe('update log', () => {
  it('is newest first with unique ids', () => {
    const ids = CHANGELOG.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort().reverse()).toEqual(ids)
    expect(LATEST_CHANGELOG_ID).toBe(ids[0])
    for (const e of CHANGELOG) expect(e.items.length).toBeGreaterThan(0)
  })

  it('shows only what is newer than the last seen entry', () => {
    expect(unseenEntries('')).toHaveLength(CHANGELOG.length)
    expect(unseenEntries(LATEST_CHANGELOG_ID)).toHaveLength(0)
    expect(unseenEntries(CHANGELOG[1]!.id).map((e) => e.id)).toEqual([CHANGELOG[0]!.id])
  })
})
