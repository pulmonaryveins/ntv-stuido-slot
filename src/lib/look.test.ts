import { describe, expect, it } from 'vitest'
import { MockClock, MockStudioClient } from '../data/mockClient'
import { SEED_IDS } from '../data/seed'
import { CHARACTER_RE, LOOK_PARTS, PART_OPTIONS, PRESETS, decodeLook, encodeLook, lookFromCode, randomCode, resolveCharacter, startingCode } from './look'
import { ATLAS, atlasLayout, buildAtlas, portraitGrid } from './skin'

const profile = { id: 'u1', avatar_color: '#123456', work_role: 'editor' as const, character: null as string | null }

describe('character codes', () => {
  it('round-trips a custom build and matches the database check', () => {
    for (let i = 0; i < 50; i++) {
      const code = randomCode()
      const s = encodeLook(code)
      expect(s).toMatch(CHARACTER_RE)
      expect(decodeLook(s)).toEqual(code)
      for (const k of LOOK_PARTS) expect(code[k]).toBeLessThan(PART_OPTIONS[k])
    }
    expect(encodeLook(startingCode(profile))).toMatch(CHARACTER_RE)
    expect(decodeLook('hero:2')).toBeNull()
  })

  it('resolves heroes, custom builds and the automatic fallback', () => {
    expect(resolveCharacter({ ...profile, character: 'hero:7' }, 5, 1)).toEqual({ kind: 'hero', index: 2 }) // wraps
    expect(resolveCharacter({ ...profile, character: null }, 5, 3)).toEqual({ kind: 'hero', index: 3 })
    // No pack: everyone is blocky, a chosen hero falls back to the default look.
    const fallback = resolveCharacter({ ...profile, character: 'hero:1' }, 0, undefined)
    expect(fallback.kind).toBe('blocky')
    expect(fallback.kind === 'blocky' && fallback.look.shirt).toBe('#123456')
    // A custom build wins over the pack, and unknown palette indices wrap instead of failing.
    const custom = resolveCharacter({ ...profile, character: 'c:zzzzzzz' }, 5, 0)
    expect(custom.kind).toBe('blocky')
  })

  it('mock client validates and saves like the RPC', async () => {
    const client = new MockStudioClient({ clock: new MockClock(1), autoTick: false })
    client.setActor(SEED_IDS.maya)
    await expect(client.setMyCharacter('nope')).rejects.toMatchObject({ code: 'invalid_input' })
    await client.setMyCharacter('hero:4')
    let snap = await client.getSnapshot()
    expect(snap.profiles.find((p) => p.id === SEED_IDS.maya)?.character).toBe('hero:4')
    expect(snap.activity[0]?.action).toBe('character_change')
    await client.setMyCharacter(null)
    snap = await client.getSnapshot()
    expect(snap.profiles.find((p) => p.id === SEED_IDS.maya)?.character).toBeNull()
  })

  it('reads older 7-digit codes with the new parts at their first option', () => {
    const old = decodeLook('c:2a31045')!
    expect(old.gender).toBe(0)
    expect(old.outfit).toBe(0)
    expect(encodeLook(old)).toBe('c:2a310450000')
  })

  it('every option draws a full skin and portrait', () => {
    for (const slim of [false, true]) expect(() => atlasLayout(slim)).not.toThrow()
    const looks = [...PRESETS.map((p) => p.code), ...Array.from({ length: 40 }, randomCode)].map(lookFromCode)
    for (const look of looks) {
      const atlas = buildAtlas(look)
      expect(atlas).toHaveLength(ATLAS)
      // The head front is fully opaque (no holes in the face).
      const r = atlasLayout(look.gender === 1).parts.head.pz
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) expect(atlas[y]![x]).toMatch(/^#[0-9a-f]{6}$/)
      expect(portraitGrid(look).flat().filter(Boolean).length).toBeGreaterThanOrEqual(64)
    }
  })
})
