import type { Look } from './look'

/**
 * Pixel-art skins for custom block characters (original art, block-game proportions):
 * 8px cube head, 8x12x4 body, 4x12x4 legs, 4 (classic) or 3 (slim) px wide arms, plus an outer
 * "hat" layer for hair and headwear. Every face is drawn as seen from outside the character.
 * Pure data (colour grids), so the 3D figure (an atlas texture) and the 2D portraits share it.
 */

export type Grid = (string | null)[][] // [row][col]
export type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'
/** +x = the character's left side (col 0 = front), py = top (row 0 = back), pz = front. */
export type Faces = Record<Face, Grid>

const INK = '#1e1e1f'
const WHITE = '#f4f4f4'
const GOLD = '#f5c542'
const HARDHAT = '#e9b923'
const LIPS = '#c46b6b'
const PINK = '#f28bb4'

// ---------------------------------------------------------------------------- helpers

function grid(w: number, h: number, c: string | null = null): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(c))
}
const W = (g: Grid) => g[0]?.length ?? 0
function set(g: Grid, x: number, y: number, c: string | null) {
  if (y >= 0 && y < g.length && x >= 0 && x < W(g)) g[y]![x] = c
}
function rect(g: Grid, x: number, y: number, w: number, h: number, c: string | null | ((x: number, y: number) => string | null)) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, typeof c === 'function' ? c(i, j) : c)
}
export function mirror(g: Grid): Grid {
  return g.map((r) => [...r].reverse())
}

/** Deterministic 0..1 noise per pixel. */
function noise(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`

/** Lighten (amt > 0) or darken (amt < 0), 0..1. */
export function shade(hex: string, amt: number): string {
  const c = rgb(hex)
  return toHex(c.map((v) => (amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))))
}
function mix(a: string, b: string, t: number) {
  const x = rgb(a)
  const y = rgb(b)
  return toHex(x.map((v, i) => v + (y[i]! - v) * t))
}
/** A colour with a little per-pixel variation, like a hand-painted texture. */
const tex = (base: string, seed: number, amt = 0.07) => (x: number, y: number) => shade(base, (noise(x, y, seed) - 0.5) * 2 * amt)

function textured(w: number, h: number, base: string, seed: number, amt?: number) {
  const g = grid(w, h)
  rect(g, 0, 0, w, h, tex(base, seed, amt))
  return g
}

// ---------------------------------------------------------------------------- head

const brows = (L: Look) => (L.hairStyle === 0 ? shade(L.skin, -0.32) : shade(L.hair, -0.1))
const facialColor = (L: Look) => (L.hairStyle === 0 ? '#3a2a22' : shade(L.hair, -0.05))

function headFront(L: Look): Grid {
  const g = textured(8, 8, L.skin, 1, 0.05)
  const b = brows(L)
  for (const x of [1, 2, 5, 6]) set(g, x, 3, b)
  // Eyes: white outside, iris toward the nose.
  set(g, 1, 4, WHITE)
  set(g, 2, 4, L.eyes)
  set(g, 5, 4, L.eyes)
  set(g, 6, 4, WHITE)
  if (L.gender === 1) {
    set(g, 0, 4, shade(L.skin, -0.55)) // lashes
    set(g, 7, 4, shade(L.skin, -0.55))
  }
  set(g, 3, 5, shade(L.skin, -0.12)) // nose
  set(g, 4, 5, shade(L.skin, -0.12))
  const mouth = L.gender === 1 ? LIPS : shade(L.skin, -0.38)
  set(g, 3, 6, mouth)
  set(g, 4, 6, mouth)
  const f = facialColor(L)
  switch (L.facialHair) {
    case 1: // stubble
      rect(g, 0, 5, 8, 3, (x, y) => ((y === 5 || y === 6) && (x === 3 || x === 4) ? g[y]![x]! : noise(x, y, 7) > 0.5 ? mix(L.skin, f, 0.45) : g[y]![x]!))
      break
    case 2: // mustache
      rect(g, 2, 5, 4, 1, f)
      break
    case 3: // full beard, mouth showing
      rect(g, 2, 5, 4, 1, f)
      set(g, 0, 5, f)
      set(g, 7, 5, f)
      rect(g, 0, 6, 3, 1, f)
      rect(g, 5, 6, 3, 1, f)
      rect(g, 0, 7, 8, 1, f)
      break
    case 4: // goatee
      rect(g, 2, 5, 4, 1, f)
      set(g, 2, 6, f)
      set(g, 5, 6, f)
      rect(g, 2, 7, 4, 1, f)
      break
  }
  return g
}

/** Side of the head, col 0 = front. */
function headSide(L: Look): Grid {
  const g = textured(8, 8, L.skin, 2, 0.05)
  set(g, 4, 4, shade(L.skin, -0.14)) // ear
  set(g, 4, 5, shade(L.skin, -0.14))
  const f = facialColor(L)
  if (L.facialHair === 3) {
    set(g, 0, 5, f)
    rect(g, 0, 6, 2, 1, f)
    rect(g, 0, 7, 4, 1, f)
  } else if (L.facialHair === 1) rect(g, 0, 5, 3, 3, (x, y) => (noise(x, y, 9) > 0.5 ? mix(L.skin, f, 0.45) : g[y]![x]!))
  return g
}

function head(L: Look): Faces {
  const side = headSide(L)
  return {
    px: side,
    nx: mirror(side),
    py: textured(8, 8, shade(L.skin, 0.03), 3, 0.05),
    ny: textured(8, 8, shade(L.skin, -0.1), 4, 0.05),
    pz: headFront(L),
    nz: textured(8, 8, L.skin, 5, 0.05),
  }
}

// ---------------------------------------------------------------------------- hair + headwear (outer layer)

interface Layer {
  front: Grid
  /** col 0 = front, for the +x side; the -x side gets its own (mirrored on placement). */
  left: Grid
  right: Grid
  back: Grid
  /** row 0 = back */
  top: Grid
}

function hairLayer(L: Look): Layer {
  const l: Layer = { front: grid(8, 8), left: grid(8, 8), right: grid(8, 8), back: grid(8, 8), top: grid(8, 8) }
  const h = tex(L.hair, 11, 0.12)
  const sides = (fn: (g: Grid) => void) => {
    fn(l.left)
    fn(l.right)
  }
  switch (L.hairStyle) {
    case 1: // short
    case 5: // bun (the bun itself is a block)
    case 6: // ponytail (the tail is a block)
      rect(l.front, 0, 0, 8, 2, h)
      set(l.front, 0, 2, h(0, 2))
      set(l.front, 7, 2, h(7, 2))
      sides((g) => {
        rect(g, 0, 0, 8, 3, h)
        rect(g, 1, 3, 7, 1, h)
        rect(g, 4, 4, 4, 2, h)
      })
      rect(l.back, 0, 0, 8, L.hairStyle === 1 ? 6 : 7, h)
      rect(l.top, 0, 0, 8, 8, h)
      break
    case 2: // long
      rect(l.front, 0, 0, 8, 2, h)
      rect(l.front, 0, 2, 1, 6, h)
      rect(l.front, 7, 2, 1, 6, h)
      sides((g) => {
        rect(g, 0, 0, 1, 3, h)
        rect(g, 1, 0, 7, 8, h)
      })
      rect(l.back, 0, 0, 8, 8, h)
      rect(l.top, 0, 0, 8, 8, h)
      break
    case 3: // spiky (spikes are blocks)
      rect(l.front, 0, 0, 8, 1, h)
      for (const x of [0, 2, 3, 5, 7]) set(l.front, x, 1, h(x, 1))
      set(l.front, 0, 2, h(0, 2))
      set(l.front, 7, 2, h(7, 2))
      sides((g) => {
        rect(g, 0, 0, 8, 3, h)
        rect(g, 2, 3, 6, 1, h)
      })
      rect(l.back, 0, 0, 8, 5, h)
      rect(l.top, 0, 0, 8, 8, h)
      break
    case 4: // mohawk (the crest is a block)
      rect(l.front, 3, 0, 2, 2, h)
      sides((g) => rect(g, 0, 0, 8, 1, h))
      rect(l.back, 3, 0, 2, 7, h)
      rect(l.top, 3, 0, 2, 8, h)
      break
    case 7: // bob with a side fringe
      rect(l.front, 0, 0, 8, 2, h)
      rect(l.front, 0, 2, 3, 1, h)
      rect(l.front, 5, 2, 3, 1, h)
      rect(l.front, 0, 3, 1, 4, h)
      rect(l.front, 7, 3, 1, 4, h)
      sides((g) => {
        rect(g, 0, 0, 1, 4, h)
        rect(g, 1, 0, 7, 7, h)
      })
      rect(l.back, 0, 0, 8, 7, h)
      rect(l.top, 0, 0, 8, 8, h)
      break
    case 8: {
      // curly: fuller, with a lighter twist pattern
      const c = (x: number, y: number) => ((x + y) % 3 === 0 ? shade(L.hair, 0.16) : h(x, y))
      rect(l.front, 0, 0, 8, 3, c)
      for (const x of [0, 1, 6, 7]) set(l.front, x, 3, c(x, 3))
      sides((g) => rect(g, 0, 0, 8, 6, c))
      rect(l.back, 0, 0, 8, 7, c)
      rect(l.top, 0, 0, 8, 8, c)
      break
    }
  }

  const hc = L.hat
  switch (L.accessory) {
    case 2: // glasses: frames on the outer layer, eyes show through the lenses
      for (const x of [1, 2, 5, 6]) {
        set(l.front, x, 3, INK)
        set(l.front, x, 5, INK)
      }
      for (const x of [0, 3, 4, 7]) set(l.front, x, 4, INK)
      sides((g) => rect(g, 0, 4, 4, 1, INK))
      break
    case 3: {
      // beanie with a folded brim
      const b = tex(hc, 21, 0.06)
      const fold = shade(hc, -0.22)
      rect(l.front, 0, 0, 8, 2, b)
      rect(l.front, 0, 2, 8, 1, fold)
      sides((g) => {
        rect(g, 0, 0, 8, 2, b)
        rect(g, 0, 2, 8, 1, fold)
      })
      rect(l.back, 0, 0, 8, 3, b)
      rect(l.back, 0, 3, 8, 1, fold)
      rect(l.top, 0, 0, 8, 8, b)
      break
    }
    case 4: {
      // cap (the brim is a block)
      const b = tex(hc, 22, 0.06)
      rect(l.front, 0, 0, 8, 2, b)
      set(l.front, 3, 1, WHITE)
      set(l.front, 4, 1, WHITE)
      sides((g) => rect(g, 0, 0, 8, 2, b))
      rect(l.back, 0, 0, 8, 2, b)
      rect(l.top, 0, 0, 8, 8, b)
      break
    }
    case 6: {
      // hard hat (brim and lamp are blocks)
      const y = tex(HARDHAT, 23, 0.05)
      rect(l.front, 0, 0, 8, 2, y)
      sides((g) => rect(g, 0, 0, 8, 2, y))
      rect(l.back, 0, 0, 8, 2, y)
      rect(l.top, 0, 0, 8, 8, y)
      rect(l.top, 3, 0, 2, 8, shade(HARDHAT, 0.18)) // ridge
      break
    }
    case 7: // flower behind the left ear
      set(l.left, 5, 1, PINK)
      set(l.left, 6, 2, PINK)
      set(l.left, 4, 2, PINK)
      set(l.left, 5, 3, PINK)
      set(l.left, 5, 2, GOLD)
      break
  }
  return l
}

function hatFaces(L: Look): Faces {
  const l = hairLayer(L)
  return { px: l.left, nx: mirror(l.right), py: l.top, ny: grid(8, 8), pz: l.front, nz: l.back }
}

// ---------------------------------------------------------------------------- body

const SLEEVE_ROWS = [4, 11, 11, 4, 3, 11]

function torso(L: Look): Faces {
  const s = tex(L.shirt, 31, 0.06)
  const p = tex(L.pants, 32, 0.06)
  const hem = shade(L.shirt, -0.18)
  const front = grid(8, 12)
  const back = grid(8, 12)
  const side = grid(4, 12)
  const top = grid(8, 4)
  const bottom = grid(8, 4)
  for (const g of [front, back, side, top, bottom]) rect(g, 0, 0, W(g), g.length, s)

  switch (L.outfit) {
    case 0: // T-shirt
      rect(front, 3, 0, 2, 1, L.skin)
      for (const g of [front, back, side]) rect(g, 0, 11, W(g), 1, hem)
      rect(top, 3, 1, 2, 2, L.skin)
      break
    case 1: // hoodie: strings, pouch pocket, hood on the back
      rect(front, 2, 0, 4, 1, shade(L.shirt, -0.15))
      rect(front, 2, 1, 1, 4, WHITE)
      rect(front, 5, 1, 1, 4, WHITE)
      rect(front, 1, 7, 6, 1, shade(L.shirt, -0.22))
      rect(front, 1, 8, 6, 3, shade(L.shirt, -0.1))
      rect(back, 0, 0, 8, 3, shade(L.shirt, -0.12))
      for (const g of [front, back, side]) rect(g, 0, 11, W(g), 1, hem)
      break
    case 2: {
      // open jacket over a contrasting shirt
      const inner = rgb(L.shirt).reduce((a, b) => a + b, 0) > 560 ? '#3b4255' : '#e8e8e8'
      rect(front, 3, 0, 2, 12, tex(inner, 33, 0.04))
      rect(front, 2, 0, 1, 5, shade(L.shirt, -0.24))
      rect(front, 5, 0, 1, 5, shade(L.shirt, -0.24))
      for (const g of [front, back, side]) rect(g, 0, 11, W(g), 1, hem)
      break
    }
    case 3: // overalls: bib and straps over the shirt
      rect(front, 1, 4, 6, 8, p)
      rect(front, 0, 8, 8, 4, p)
      rect(front, 1, 0, 1, 4, p)
      rect(front, 6, 0, 1, 4, p)
      set(front, 1, 4, GOLD)
      set(front, 6, 4, GOLD)
      rect(front, 3, 6, 2, 2, shade(L.pants, -0.15)) // pocket
      rect(back, 1, 0, 1, 7, p)
      rect(back, 6, 0, 1, 7, p)
      rect(back, 0, 7, 8, 5, p)
      rect(side, 0, 8, 4, 4, p)
      rect(bottom, 0, 0, 8, 4, p)
      break
    case 4: // dress with a waistband
      rect(front, 2, 0, 4, 1, L.skin)
      for (const g of [front, back, side]) {
        rect(g, 0, 7, W(g), 1, shade(L.shirt, -0.22))
        rect(g, 0, 8, W(g), 4, tex(shade(L.shirt, 0.05), 34, 0.05))
      }
      rect(top, 2, 1, 4, 2, L.skin)
      break
    case 5: {
      // suit: jacket in the pants colour, white shirt, tie in the top colour
      const j = tex(L.pants, 35, 0.05)
      for (const g of [front, back, side, top]) rect(g, 0, 0, W(g), g.length, j)
      rect(bottom, 0, 0, 8, 4, j)
      rect(front, 3, 0, 2, 6, WHITE)
      rect(front, 3, 1, 2, 5, (x) => (x === 3 ? L.shirt : shade(L.shirt, -0.18)))
      set(front, 3, 0, WHITE)
      set(front, 4, 0, WHITE)
      rect(front, 2, 0, 1, 7, shade(L.pants, -0.3)) // lapels
      rect(front, 5, 0, 1, 7, shade(L.pants, -0.3))
      set(front, 3, 8, GOLD) // buttons
      set(front, 3, 10, GOLD)
      rect(top, 3, 1, 2, 2, WHITE)
      break
    }
  }
  if (L.accessory === 8) {
    // ID badge on a lanyard
    const strap = '#2a6fd6'
    for (let y = 0; y < 5; y++) {
      set(front, 2 + Math.floor(y / 3), y, strap)
      set(front, 5 - Math.floor(y / 3), y, strap)
    }
    rect(front, 3, 5, 2, 3, WHITE)
    set(front, 3, 6, '#5b8def')
    rect(back, 2, 0, 4, 1, strap)
  }
  return { px: side, nx: mirror(side), py: top, ny: bottom, pz: front, nz: back }
}

function arm(L: Look, w: number): Faces {
  const rows = SLEEVE_ROWS[L.outfit] ?? 4
  const suit = L.outfit === 5
  const s = tex(suit ? L.pants : L.shirt, 41, 0.06)
  const k = tex(L.skin, 42, 0.05)
  const paint = (g: Grid) => {
    rect(g, 0, 0, W(g), g.length, (x, y) => (y < rows ? s(x, y) : k(x, y)))
    rect(g, 0, rows - 1, W(g), 1, suit ? WHITE : shade(L.shirt, -0.16)) // cuff / hem
  }
  const front = grid(w, 12)
  const back = grid(w, 12)
  const side = grid(4, 12)
  for (const g of [front, back, side]) paint(g)
  const top = grid(w, 4)
  rect(top, 0, 0, w, 4, s)
  const bottom = grid(w, 4)
  rect(bottom, 0, 0, w, 4, k)
  return { px: side, nx: mirror(side), py: top, ny: bottom, pz: front, nz: back }
}

function leg(L: Look): Faces {
  const p = tex(L.pants, 51, 0.07)
  const dress = L.outfit === 4
  const paint = (g: Grid) => {
    rect(g, 0, 0, W(g), 10, p)
    if (dress) {
      rect(g, 0, 0, W(g), 6, tex(shade(L.shirt, 0.05), 34, 0.05))
      rect(g, 0, 6, W(g), 4, tex(L.skin, 52, 0.05))
    } else if (L.outfit !== 3) rect(g, 0, 0, W(g), 1, shade(L.pants, -0.25)) // belt line
    rect(g, 0, 10, W(g), 1, shade(L.shoes, 0.1))
    rect(g, 0, 11, W(g), 1, L.shoes)
  }
  const front = grid(4, 12)
  const back = grid(4, 12)
  const side = grid(4, 12)
  for (const g of [front, back, side]) paint(g)
  const top = grid(4, 4)
  rect(top, 0, 0, 4, 4, dress ? L.shirt : L.pants)
  const bottom = grid(4, 4)
  rect(bottom, 0, 0, 4, 4, shade(L.shoes, -0.2))
  return { px: side, nx: mirror(side), py: top, ny: bottom, pz: front, nz: back }
}

// ---------------------------------------------------------------------------- atlas

export const ATLAS = 64
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export type PartName = 'head' | 'hat' | 'body' | 'arm' | 'leg'
/** Flat-colour patches for small blocks (spikes, brims, crown points). */
export const PATCHES = ['hair', 'hatc', 'ink', 'gold', 'gem', 'pink', 'lamp', 'white', 'hardhat'] as const
export type Patch = (typeof PATCHES)[number]

export interface Layout {
  parts: Record<PartName, Record<Face, Rect>>
  patches: Record<Patch, Rect>
}

/** Part sizes in pixels: [width, height, depth]. */
export function partSize(part: PartName, slim: boolean): [number, number, number] {
  switch (part) {
    case 'head':
    case 'hat':
      return [8, 8, 8]
    case 'body':
      return [8, 12, 4]
    case 'arm':
      return [slim ? 3 : 4, 12, 4]
    case 'leg':
      return [4, 12, 4]
  }
}

const layoutCache = new Map<boolean, Layout>()

/** Where each face lives in the 64x64 atlas (a simple shelf packer; fixed per arm width). */
export function atlasLayout(slim: boolean): Layout {
  const cached = layoutCache.get(slim)
  if (cached) return cached
  let x = 0
  let y = 0
  let row = 0
  const place = (w: number, h: number): Rect => {
    if (x + w > ATLAS) {
      x = 0
      y += row
      row = 0
    }
    const r = { x, y, w, h }
    x += w
    row = Math.max(row, h)
    if (y + h > ATLAS) throw new Error('skin atlas overflow')
    return r
  }
  const parts = {} as Layout['parts']
  for (const part of ['head', 'hat', 'body', 'arm', 'leg'] as PartName[]) {
    const [w, h, d] = partSize(part, slim)
    parts[part] = { pz: place(w, h), nz: place(w, h), px: place(d, h), nx: place(d, h), py: place(w, d), ny: place(w, d) }
  }
  const patches = {} as Layout['patches']
  for (const p of PATCHES) patches[p] = place(2, 2)
  const layout = { parts, patches }
  layoutCache.set(slim, layout)
  return layout
}

const PATCH_COLORS = (L: Look): Record<Patch, string> => ({
  hair: L.hair,
  hatc: L.hat,
  ink: INK,
  gold: GOLD,
  gem: '#d9534f',
  pink: PINK,
  lamp: '#fff6b8',
  white: WHITE,
  hardhat: HARDHAT,
})

/** The whole skin as one 64x64 grid (null = transparent). */
export function buildAtlas(L: Look): Grid {
  const slim = L.gender === 1
  const layout = atlasLayout(slim)
  const out = grid(ATLAS, ATLAS)
  const faces: Record<PartName, Faces> = { head: head(L), hat: hatFaces(L), body: torso(L), arm: arm(L, slim ? 3 : 4), leg: leg(L) }
  for (const part of Object.keys(faces) as PartName[]) {
    for (const f of Object.keys(faces[part]) as Face[]) {
      const r = layout.parts[part][f]
      const g = faces[part][f]
      for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) out[r.y + j]![r.x + i] = g[j]?.[i] ?? null
    }
  }
  const colors = PATCH_COLORS(L)
  for (const p of PATCHES) {
    const r = layout.patches[p]
    rect(out, r.x, r.y, r.w, r.h, p === 'hair' ? tex(L.hair, 12, 0.1) : colors[p])
  }
  return out
}

// ---------------------------------------------------------------------------- 2D portraits

/**
 * Front portrait on a 10x10 grid: the face (x1-8, y2-9) with the outer layer on top, plus the
 * blocks that stick out (crown, headphones, spikes, brims) drawn in the margin.
 */
export function portraitGrid(L: Look): Grid {
  const g = grid(10, 10)
  const face = headFront(L)
  const over = hairLayer(L).front
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g[y + 2]![x + 1] = over[y]![x] ?? face[y]![x]!
  const h = L.hair
  switch (L.hairStyle) {
    case 3:
      for (const x of [2, 4, 5, 7]) set(g, x, 1, shade(h, x % 2 ? 0.1 : 0))
      break
    case 4:
      rect(g, 4, 0, 2, 2, h)
      break
    case 5:
      rect(g, 4, 1, 2, 1, h)
      break
    case 8:
      rect(g, 1, 1, 8, 1, h)
      break
  }
  switch (L.accessory) {
    case 1:
      rect(g, 1, 1, 8, 1, INK)
      rect(g, 0, 4, 1, 4, INK)
      rect(g, 9, 4, 1, 4, INK)
      break
    case 3:
      rect(g, 4, 1, 2, 1, WHITE)
      break
    case 4:
      rect(g, 1, 4, 8, 1, shade(L.hat, -0.25))
      break
    case 5:
      rect(g, 1, 1, 8, 1, GOLD)
      for (const x of [1, 4, 5, 8]) set(g, x, 0, GOLD)
      rect(g, 4, 1, 2, 1, '#d9534f')
      break
    case 6:
      rect(g, 0, 3, 10, 1, shade(HARDHAT, -0.12))
      rect(g, 4, 2, 2, 1, '#fff6b8')
      break
    case 7:
      set(g, 8, 2, PINK)
      set(g, 9, 3, PINK)
      break
  }
  return g
}

/** Front view of the outfit (arms, body, top of the legs) for the editor's outfit buttons. */
export function outfitGrid(L: Look): Grid {
  const slim = L.gender === 1
  const aw = slim ? 3 : 4
  const t = torso(L).pz
  const a = arm(L, aw).pz
  const l = leg(L).pz
  const g = grid(8 + aw * 2, 16)
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < aw; x++) {
      g[y]![x] = a[y]![x]!
      g[y]![x + aw + 8] = a[y]![x]!
    }
    for (let x = 0; x < 8; x++) g[y]![x + aw] = t[y]![x]!
  }
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g[12 + y]![aw + x] = l[y]![x]!
    g[12 + y]![aw + 4 + x] = l[y]![x]!
  }
  return g
}
