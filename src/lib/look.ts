import type { Profile } from '../data/types'

/**
 * Character customization. A profile's `character` code is either
 *   'hero:N'        hero N from the optional character pack, or
 *   'c:XXXXXXXXXXX' a custom block character: base-36 palette indices in the order of LOOK_PARTS
 *                   (codes saved before a part existed are shorter; missing parts read as 0), or
 *   null            automatic: a random-but-stable hero, else the role-based block character.
 * The database checks the same shape (supabase/migrations/*_character*.sql). Indices wrap, so
 * growing a palette never breaks saved characters. No three.js here: the UI uses it too.
 */

export const CHARACTER_RE = /^(hero:[0-9]{1,2}|c:[0-9a-z]{7,16})$/

export const SKIN = ['#f6d7b8', '#f2c7a5', '#e0ad84', '#d9a07a', '#b97b55', '#a06a43', '#8d5a3b', '#5e3a24']
export const HAIR = ['#2b1d16', '#3a2a22', '#6b4423', '#a06a3b', '#e0bf63', '#b5462e', '#9aa0a6', '#efefef', '#5b8def', '#c75b9b']
export const SHIRT = ['#3c8527', '#6c9a3b', '#2bb3a3', '#4a7c9b', '#5b8def', '#8e6cd1', '#c75b9b', '#d9534f', '#e07a5f', '#f2a541', '#3b4255', '#e8e8e8', '#2a9fa6', '#7a4f2a']
export const PANTS = ['#3b4255', '#2b2a33', '#4a6fa5', '#6b4f3a', '#8a6d4a', '#5c5d61', '#2f5d3a', '#7a2e3a', '#3d4fa8']
export const SHOES = ['#3a2a22', '#1e1e1f', '#6b4423', '#e8e8e8', '#5c5d61', '#7a2e3a']
export const EYES = ['#1e1e1f', '#5a3a22', '#3d7fd6', '#3c8527', '#8e6cd1', '#b5462e']
export const GENDERS = ['Male', 'Female', 'Other'] as const
export const HAIR_STYLES = ['Bald', 'Short', 'Long', 'Spiky', 'Mohawk', 'Bun', 'Ponytail', 'Bob', 'Curly'] as const
export const OUTFITS = ['T-shirt', 'Hoodie', 'Jacket', 'Overalls', 'Dress', 'Suit'] as const
export const FACIAL_HAIR = ['None', 'Stubble', 'Mustache', 'Beard', 'Goatee'] as const
export const ACCESSORIES = ['None', 'Headphones', 'Glasses', 'Beanie', 'Cap', 'Crown', 'Hard hat', 'Flower', 'ID badge'] as const

/** Stored order. Never reorder: append new parts at the end. */
export const LOOK_PARTS = ['skin', 'hair', 'hairStyle', 'shirt', 'pants', 'eyes', 'accessory', 'gender', 'outfit', 'shoes', 'facialHair'] as const
export type LookPart = (typeof LOOK_PARTS)[number]
/** Palette indices, as stored. */
export type LookCode = Record<LookPart, number>

/** Concrete colours and shapes, ready to draw. */
export interface Look {
  skin: string
  hair: string
  hairStyle: number
  shirt: string
  pants: string
  shoes: string
  eyes: string
  accessory: number
  /** 0 male, 1 female, 2 other. Female: slim arms, lashes, lips. */
  gender: number
  outfit: number
  facialHair: number
  /** Colour for the beanie / cap (the shirt colour, so outfits match). */
  hat: string
}

export const PART_OPTIONS: Record<LookPart, number> = {
  skin: SKIN.length,
  hair: HAIR.length,
  hairStyle: HAIR_STYLES.length,
  shirt: SHIRT.length,
  pants: PANTS.length,
  eyes: EYES.length,
  accessory: ACCESSORIES.length,
  gender: GENDERS.length,
  outfit: OUTFITS.length,
  shoes: SHOES.length,
  facialHair: FACIAL_HAIR.length,
}

const wrap = (i: number, n: number) => ((i % n) + n) % n
const pick = <T,>(list: readonly T[], i: number) => list[wrap(i, list.length)]!

/** Same string hash as the 3D kit. */
export function hashString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function encodeLook(code: LookCode): string {
  return `c:${LOOK_PARTS.map((k) => wrap(code[k] ?? 0, 36).toString(36)).join('')}`
}

export function decodeLook(character: string): LookCode | null {
  if (!/^c:[0-9a-z]{7,16}$/.test(character)) return null
  const digits = character.slice(2)
  return Object.fromEntries(LOOK_PARTS.map((k, i) => [k, digits[i] ? parseInt(digits[i]!, 36) : 0])) as LookCode
}

export function lookFromCode(code: LookCode): Look {
  const shirt = pick(SHIRT, code.shirt)
  return {
    skin: pick(SKIN, code.skin),
    hair: pick(HAIR, code.hair),
    hairStyle: wrap(code.hairStyle, HAIR_STYLES.length),
    shirt,
    pants: pick(PANTS, code.pants),
    shoes: pick(SHOES, code.shoes),
    eyes: pick(EYES, code.eyes),
    accessory: wrap(code.accessory, ACCESSORIES.length),
    gender: wrap(code.gender, GENDERS.length),
    outfit: wrap(code.outfit, OUTFITS.length),
    facialHair: wrap(code.facialHair, FACIAL_HAIR.length),
    hat: shirt,
  }
}

const ROLE_ACCESSORY: Record<Profile['work_role'], number> = { editor: 1, designer: 2, motion: 3 }
const LEGACY_SKIN = ['#f2c7a5', '#d9a07a', '#b97b55', '#8d5a3b', '#f5d6bd']

/** The automatic block character (no choice made): their colour and a role prop. */
export function defaultLook(profile: Pick<Profile, 'id' | 'avatar_color' | 'work_role'>): Look {
  return {
    skin: pick(LEGACY_SKIN, hashString(profile.id)),
    hair: '#3a2a22',
    hairStyle: 1,
    shirt: profile.avatar_color,
    pants: '#3b4255',
    shoes: '#3a2a22',
    eyes: '#1e1e1f',
    accessory: ROLE_ACCESSORY[profile.work_role] ?? 0,
    gender: 2,
    outfit: 0,
    facialHair: 0,
    hat: profile.avatar_color,
  }
}

const zero = (): LookCode => Object.fromEntries(LOOK_PARTS.map((k) => [k, 0])) as LookCode

/** A starting point for the editor that resembles the user's automatic character. */
export function startingCode(profile: Pick<Profile, 'id' | 'work_role'>): LookCode {
  const h = hashString(profile.id)
  return { ...zero(), skin: h % SKIN.length, hair: 1, hairStyle: 1, shirt: h % SHIRT.length, accessory: ROLE_ACCESSORY[profile.work_role] ?? 0, gender: 2 }
}

/** A random custom character (facial hair stays rarer, dresses only sometimes). */
export function randomCode(): LookCode {
  const r = (n: number) => Math.floor(Math.random() * n)
  const code = Object.fromEntries(LOOK_PARTS.map((k) => [k, r(PART_OPTIONS[k])])) as LookCode
  if (Math.random() < 0.6) code.facialHair = 0
  if (Math.random() < 0.4) code.accessory = 0
  return code
}

/** Ready-made office looks for a creative studio; users tweak from there. */
export const PRESETS: { name: string; code: LookCode }[] = [
  // Cutting video all day: headphones and a comfy hoodie.
  { name: 'Editor', code: { ...zero(), skin: 3, hair: 1, hairStyle: 3, shirt: 10, pants: 1, shoes: 3, outfit: 1, accessory: 1, gender: 0 } },
  { name: 'Designer', code: { ...zero(), skin: 1, hair: 9, hairStyle: 7, shirt: 11, pants: 0, shoes: 1, outfit: 0, accessory: 2, gender: 1, eyes: 3 } },
  { name: 'Motion artist', code: { ...zero(), skin: 5, hair: 0, hairStyle: 8, shirt: 5, pants: 2, shoes: 3, outfit: 2, accessory: 3, gender: 2 } },
  { name: 'Producer', code: { ...zero(), skin: 6, hair: 0, hairStyle: 6, shirt: 7, pants: 1, shoes: 1, outfit: 5, accessory: 8, gender: 1, eyes: 1 } },
  // Keeps the render farm running: hard hat with a lamp for the server racks.
  { name: 'Render tech', code: { ...zero(), skin: 4, hair: 5, hairStyle: 1, shirt: 9, pants: 2, shoes: 2, outfit: 3, accessory: 6, gender: 0, facialHair: 1 } },
  { name: 'Intern', code: { ...zero(), skin: 0, hair: 4, hairStyle: 2, shirt: 2, pants: 4, shoes: 3, outfit: 0, accessory: 8, gender: 1, eyes: 2 } },
  { name: 'IT support', code: { ...zero(), skin: 2, hair: 2, hairStyle: 1, shirt: 4, pants: 0, shoes: 0, outfit: 0, accessory: 4, gender: 0, facialHair: 4 } },
  { name: 'Studio head', code: { ...zero(), skin: 7, hair: 6, hairStyle: 1, shirt: 12, pants: 1, shoes: 1, outfit: 5, accessory: 5, gender: 0, facialHair: 3 } },
]

export function heroIndexOf(character: string | null | undefined): number | null {
  const m = character ? /^hero:(\d{1,2})$/.exec(character) : null
  return m ? Number(m[1]) : null
}

export type ResolvedCharacter = { kind: 'hero'; index: number } | { kind: 'blocky'; look: Look }

/**
 * What to draw for a profile. `heroCount` is the number of heroes in the pack (0 when the pack
 * is missing); `autoHero` is their automatic hero (assignCharacters) for profiles with no choice.
 */
export function resolveCharacter(
  profile: Pick<Profile, 'id' | 'avatar_color' | 'work_role' | 'character'>,
  heroCount: number,
  autoHero: number | undefined,
): ResolvedCharacter {
  const c = profile.character ?? null
  const hero = heroIndexOf(c)
  if (hero !== null && heroCount > 0) return { kind: 'hero', index: hero % heroCount }
  const code = c ? decodeLook(c) : null
  if (code) return { kind: 'blocky', look: lookFromCode(code) }
  if (c === null && heroCount > 0 && autoHero !== undefined) return { kind: 'hero', index: autoHero }
  return { kind: 'blocky', look: defaultLook(profile) }
}
