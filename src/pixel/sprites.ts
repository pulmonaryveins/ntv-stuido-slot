import { ARMCHAIRS, BREAK_TABLE, COFFEE, DOOR, FLOOR_BOTTOM, FLOOR_TOP, FRAME, H, LOUNGE, PRINTER, ROWS, W, WALL_H, type DeskLayout } from './layout'

/**
 * Procedural pixel art for the office in a cozy farm-sim ¾ view: a tall wallpapered back
 * wall, warm wood, every object outlined in dark brown with a lit top face and a shaded
 * front face. Everything is plain rectangles on a 2D canvas.
 */

type Ctx = CanvasRenderingContext2D

export const C = {
  outline: '#3b1d0c',
  frame: '#4a2612',
  // wall
  paper: '#c98a4e',
  paperDot: '#b47640',
  paperHi: '#d99a5c',
  wainscot: '#8b4a22',
  wainscotHi: '#a65c2c',
  wainscotLo: '#6e3818',
  trim: '#5b2d12',
  // floor
  plank: '#d99b55',
  plankAlt: '#cf904c',
  plankLine: '#a8672f',
  plankHi: '#e6ad68',
  // wood furniture
  woodTop: '#b9713a',
  woodTopHi: '#cf8749',
  woodFront: '#8e4f25',
  woodFrontLo: '#723d1b',
  // fabrics
  leather: '#8a3f22',
  leatherHi: '#a5512d',
  leatherLo: '#6a2e17',
  rugA: '#a8443a',
  rugB: '#7f2e27',
  rugBorder: '#e0a64e',
  rugBorder2: '#b97c33',
  rugBlue: '#3d6a9a',
  rugBlueB: '#2e5277',
  // misc
  white: '#f6eedc',
  paperSheet: '#fff8e6',
  ink: '#2a1a12',
  metal: '#a7a29a',
  metalDark: '#6e6a64',
  screenOff: '#2c3b3a',
  leaf: '#4c9a3a',
  leafHi: '#78c255',
  leafDark: '#2f6d27',
  pot: '#b5562f',
  potDark: '#8a3c1e',
  glass: '#8fd0e8',
  glassHi: '#c9ecf7',
  shadow: 'rgba(40,15,0,0.25)',
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** Filled rectangle with a 1px dark outline. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  rect(ctx, x, y, w, h, C.outline)
  rect(ctx, x + 1, y + 1, w - 2, h - 2, fill)
}

/** ¾-view block: outlined, lit top face of height `top`, shaded front face below. */
function block(ctx: Ctx, x: number, y: number, w: number, top: number, front: number, cTop: string, cFront: string, cHi?: string) {
  rect(ctx, x + 2, y + top + front, w - 2, 3, C.shadow)
  rect(ctx, x, y, w, top + front, C.outline)
  rect(ctx, x + 1, y + 1, w - 2, top - 1, cTop)
  if (cHi) rect(ctx, x + 1, y + 1, w - 2, 1, cHi)
  rect(ctx, x + 1, y + top, w - 2, front - 1, cFront)
  rect(ctx, x + 1, y + top, w - 2, 1, C.outline)
}

function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)))
    rect(ctx, cx - half, cy + y, half * 2, 1, c)
  }
}

// --- room ----------------------------------------------------------------------

export function drawRoom(ctx: Ctx, night: boolean) {
  rect(ctx, 0, 0, W, H, C.frame)
  rect(ctx, 2, 2, W - 4, H - 4, '#6b3a1c')
  rect(ctx, FRAME - 2, FRAME - 2, W - FRAME * 2 + 4, H - FRAME * 2 + 4, C.outline)
  // wallpaper with a small diamond pattern
  rect(ctx, FRAME, FRAME, W - FRAME * 2, WALL_H, C.paper)
  for (let y = FRAME + 4; y < FRAME + WALL_H - 20; y += 8)
    for (let x = FRAME + ((y / 8) % 2 ? 4 : 0); x < W - FRAME; x += 8) {
      rect(ctx, x + 2, y, 2, 1, C.paperDot)
      rect(ctx, x + 1, y + 1, 4, 1, C.paperDot)
      rect(ctx, x + 2, y + 2, 2, 1, C.paperDot)
    }
  rect(ctx, FRAME, FRAME, W - FRAME * 2, 3, C.trim)
  // wainscot panels on the lower wall
  const wy = FRAME + WALL_H - 22
  rect(ctx, FRAME, wy - 2, W - FRAME * 2, 2, C.trim)
  rect(ctx, FRAME, wy, W - FRAME * 2, 22, C.wainscot)
  for (let x = FRAME + 4; x < W - FRAME - 10; x += 20) {
    rect(ctx, x, wy + 3, 16, 14, C.wainscotLo)
    rect(ctx, x + 1, wy + 4, 14, 12, C.wainscotHi)
    rect(ctx, x + 2, wy + 5, 12, 10, C.wainscot)
  }
  rect(ctx, FRAME, FLOOR_TOP - 3, W - FRAME * 2, 3, C.trim)
  // horizontal plank floor with staggered joints
  for (let r = 0, y = FLOOR_TOP; y < FLOOR_BOTTOM; r++, y += 8) {
    rect(ctx, FRAME, y, W - FRAME * 2, 8, r % 2 ? C.plankAlt : C.plank)
    rect(ctx, FRAME, y + 7, W - FRAME * 2, 1, C.plankLine)
    for (let x = FRAME + ((r * 29) % 48); x < W - FRAME; x += 48) rect(ctx, x, y, 1, 7, C.plankLine)
    for (let x = FRAME + ((r * 17) % 40) + 6; x < W - FRAME; x += 40) rect(ctx, x, y + 2, 6, 1, C.plankHi)
  }
  rect(ctx, FRAME, FLOOR_TOP, W - FRAME * 2, 4, C.shadow)
  // bottom wall with the doorway and a mat
  rect(ctx, FRAME, FLOOR_BOTTOM, W - FRAME * 2, H - FRAME - FLOOR_BOTTOM, C.wainscot)
  rect(ctx, FRAME, FLOOR_BOTTOM, W - FRAME * 2, 2, C.trim)
  rect(ctx, DOOR.x - 14, FLOOR_BOTTOM, 28, H - FLOOR_BOTTOM, C.plank)
  rect(ctx, DOOR.x - 13, FLOOR_BOTTOM - 6, 26, 9, C.outline)
  rect(ctx, DOOR.x - 12, FLOOR_BOTTOM - 5, 24, 7, '#6a8a3a')
  rect(ctx, DOOR.x - 10, FLOOR_BOTTOM - 4, 20, 5, '#86a64a')
  windows(ctx, night)
}

function windows(ctx: Ctx, night: boolean) {
  for (const x of [66, 214]) {
    const y = FRAME + 10
    box(ctx, x, y, 46, 30, C.woodFront)
    rect(ctx, x + 3, y + 3, 40, 24, night ? '#1d2a4a' : C.glass)
    if (!night) {
      rect(ctx, x + 6, y + 5, 3, 12, C.glassHi)
      rect(ctx, x + 10, y + 5, 2, 7, C.glassHi)
    } else rect(ctx, x + 30, y + 7, 1, 1, '#fff6c8')
    rect(ctx, x + 22, y + 3, 2, 24, C.woodFront)
    rect(ctx, x + 3, y + 14, 40, 2, C.woodFront)
    // curtains
    rect(ctx, x - 4, y - 2, 6, 34, '#7a3b52')
    rect(ctx, x + 44, y - 2, 6, 34, '#7a3b52')
    rect(ctx, x - 3, y - 1, 2, 32, '#954a66')
    rect(ctx, x + 45, y - 1, 2, 32, '#954a66')
    rect(ctx, x - 6, y - 4, 58, 3, C.trim)
    // sill
    rect(ctx, x - 2, y + 30, 50, 3, C.woodTop)
    rect(ctx, x - 2, y + 33, 50, 1, C.outline)
  }
}

// --- furniture ------------------------------------------------------------------

export function plant(ctx: Ctx, x: number, y: number, big = false) {
  const s = big ? 1.3 : 1
  rect(ctx, x + 3 * s, y + 18 * s, 14 * s, 3, C.shadow)
  box(ctx, x + 4 * s, y + 11 * s, 12 * s, 9 * s, C.pot)
  rect(ctx, x + 5 * s, y + 12 * s, 10 * s, 2, C.potDark)
  blob(ctx, x + 10 * s, y + 7 * s, 9 * s, 7 * s, C.outline)
  blob(ctx, x + 10 * s, y + 7 * s, 8 * s, 6 * s, C.leaf)
  blob(ctx, x + 7 * s, y + 5 * s, 3 * s, 2 * s, C.leafHi)
  blob(ctx, x + 13 * s, y + 8 * s, 3 * s, 2 * s, C.leafDark)
}

/** Tall bookshelf standing against the back wall. */
function bookshelf(ctx: Ctx, x: number, seed: number) {
  const y = FRAME + 14
  const w = 40
  const h = FLOOR_TOP - y + 10
  rect(ctx, x + 2, y + h, w - 2, 3, C.shadow)
  box(ctx, x, y, w, h, C.woodFront)
  rect(ctx, x + 1, y + 1, w - 2, 2, C.woodTopHi)
  const books = ['#3b6aa8', '#a8443a', '#d9a845', '#4c9a3a', '#7a4fa0', '#2f8a8a']
  for (let s = 0; s < 4; s++) {
    const sy = y + 5 + s * 13
    rect(ctx, x + 3, sy, w - 6, 11, C.woodFrontLo)
    for (let bx = x + 4, i = 0; bx < x + w - 6; i++) {
      const bw = 3 + ((seed + i + s) % 2)
      const bh = 7 + ((seed * 3 + i * 5 + s) % 3)
      rect(ctx, bx, sy + 11 - bh, bw, bh, books[(seed + s * 2 + i * 3) % books.length]!)
      rect(ctx, bx, sy + 11 - bh, bw, 1, 'rgba(255,255,255,0.25)')
      bx += bw + 1
    }
    rect(ctx, x + 2, sy + 11, w - 4, 2, C.woodTop)
  }
}

/** Coffee station: wall cabinets above a counter with a coffee machine, mugs and a sink. */
function coffeeStation(ctx: Ctx) {
  const x = COFFEE.x
  const w = COFFEE.w
  // wall cabinets
  box(ctx, x + 2, FRAME + 8, w - 4, 18, C.woodFront)
  rect(ctx, x + 2 + (w - 4) / 2, FRAME + 9, 1, 16, C.outline)
  rect(ctx, x + w / 2 - 5, FRAME + 15, 2, 4, C.rugBorder)
  rect(ctx, x + w / 2 + 3, FRAME + 15, 2, 4, C.rugBorder)
  // counter
  const y = FLOOR_TOP - 12
  block(ctx, x, y, w, 10, 16, C.woodTop, C.woodFront, C.woodTopHi)
  rect(ctx, x + 4, y + 13, (w - 10) / 2, 11, C.woodFrontLo)
  rect(ctx, x + w / 2 + 1, y + 13, (w - 10) / 2, 11, C.woodFrontLo)
  // coffee machine, mugs, sink
  box(ctx, x + 6, y - 12, 14, 16, '#3a2a24')
  rect(ctx, x + 9, y - 2, 8, 3, C.metal)
  rect(ctx, x + 16, y - 9, 2, 2, '#e05a4a')
  box(ctx, x + 24, y + 1, 6, 6, C.white)
  box(ctx, x + 31, y + 1, 6, 6, '#e0a64e')
  box(ctx, x + 42, y + 1, 16, 7, C.metal)
  rect(ctx, x + 44, y + 2, 12, 4, '#8fb6c8')
}

function clock(ctx: Ctx, x: number, y: number) {
  blob(ctx, x, y, 8, 8, C.outline)
  blob(ctx, x, y, 7, 7, C.woodFront)
  blob(ctx, x, y, 5, 5, C.white)
  rect(ctx, x, y - 4, 1, 4, C.ink)
  rect(ctx, x, y, 3, 1, C.ink)
}

function filingCabinet(ctx: Ctx, x: number) {
  const y = FLOOR_TOP - 30
  block(ctx, x, y, 26, 6, 34, '#8a8f8a', '#6e736e', '#a2a7a2')
  for (let i = 0; i < 3; i++) {
    rect(ctx, x + 2, y + 8 + i * 11, 22, 1, C.outline)
    rect(ctx, x + 10, y + 11 + i * 11, 6, 2, '#c9cdc9')
  }
}

function waterCooler(ctx: Ctx, x: number, y: number) {
  rect(ctx, x + 2, y + 30, 14, 3, C.shadow)
  box(ctx, x, y + 12, 18, 19, C.white)
  rect(ctx, x + 4, y + 18, 3, 3, '#c0392b')
  rect(ctx, x + 11, y + 18, 3, 3, '#3b6aa8')
  box(ctx, x + 3, y, 12, 13, '#6fb8e6')
  rect(ctx, x + 5, y + 2, 3, 8, '#b9e2f7')
}

/** The lounge: patterned rug, sofa, coffee table, two armchairs, side lamps. */
function lounge(ctx: Ctx) {
  const r = LOUNGE.rug
  rect(ctx, r.x, r.y, r.w, r.h, C.outline)
  rect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, C.rugBorder)
  rect(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, C.rugBorder2)
  rect(ctx, r.x + 6, r.y + 6, r.w - 12, r.h - 12, C.rugA)
  for (let i = 0; i < r.w - 20; i += 12) {
    rect(ctx, r.x + 10 + i, r.y + 10, 6, 2, C.rugB)
    rect(ctx, r.x + 10 + i, r.y + r.h - 12, 6, 2, C.rugB)
  }
  blob(ctx, r.x + r.w / 2, r.y + r.h / 2 + 6, 22, 14, C.rugB)
  blob(ctx, r.x + r.w / 2, r.y + r.h / 2 + 6, 18, 10, C.rugA)
  // sofa (back against the top, facing the room)
  const s = LOUNGE.sofa
  rect(ctx, s.x + 2, s.y + 30, s.w - 2, 3, C.shadow)
  box(ctx, s.x, s.y, s.w, 30, C.leatherLo)
  rect(ctx, s.x + 1, s.y + 1, s.w - 2, 12, C.leather)
  rect(ctx, s.x + 1, s.y + 1, s.w - 2, 2, C.leatherHi)
  for (let i = 0; i < 3; i++) {
    box(ctx, s.x + 6 + i * 25, s.y + 12, 24, 14, C.leather)
    rect(ctx, s.x + 7 + i * 25, s.y + 13, 22, 2, C.leatherHi)
  }
  box(ctx, s.x - 4, s.y + 6, 8, 24, C.leatherLo)
  box(ctx, s.x + s.w - 4, s.y + 6, 8, 24, C.leatherLo)
  // coffee table
  const t = LOUNGE.table
  block(ctx, t.x, t.y, t.w, 12, 8, C.woodTop, C.woodFront, C.woodTopHi)
  box(ctx, t.x + 6, t.y + 2, 10, 7, C.paperSheet)
  box(ctx, t.x + 30, t.y + 3, 6, 6, '#e0a64e')
  // armchairs facing each other
  for (const a of ARMCHAIRS) {
    const back = a.face === 'right' ? a.x : a.x + 16
    rect(ctx, a.x + 2, a.y + 30, 20, 3, C.shadow)
    box(ctx, a.x, a.y, 22, 30, C.leather)
    box(ctx, back, a.y - 2, 6, 32, C.leatherLo)
    rect(ctx, a.x + 1, a.y + 1, 20, 2, C.leatherHi)
    rect(ctx, a.x, a.y + 26, 22, 4, C.leatherLo)
  }
}

function printer(ctx: Ctx) {
  const { x, y } = PRINTER
  // small cabinet with the printer on top
  block(ctx, x, y + 6, 30, 6, 18, C.woodTop, C.woodFront, C.woodTopHi)
  box(ctx, x + 3, y - 6, 24, 13, '#e6e2d8')
  rect(ctx, x + 6, y - 2, 18, 3, C.ink)
  box(ctx, x + 7, y - 12, 16, 7, C.paperSheet)
  rect(ctx, x + 22, y + 1, 2, 2, '#4c9a3a')
}

function breakTable(ctx: Ctx) {
  const { x, y } = BREAK_TABLE
  for (const dx of [-24, 24]) {
    box(ctx, x + dx - 6, y + 2, 12, 10, C.woodFront)
    rect(ctx, x + dx - 5, y + 3, 10, 3, C.woodTop)
  }
  blob(ctx, x, y + 12, 14, 3, C.shadow)
  rect(ctx, x - 2, y + 4, 4, 9, C.outline)
  blob(ctx, x, y, 16, 10, C.outline)
  blob(ctx, x, y, 15, 9, C.woodTop)
  blob(ctx, x - 3, y - 3, 8, 3, C.woodTopHi)
  box(ctx, x - 6, y - 4, 6, 6, C.white)
  plant(ctx, x + 1, y - 18)
}

/** Everything that never moves, drawn once into the background. */
export function drawFurniture(ctx: Ctx) {
  // back wall
  bookshelf(ctx, 20, 2)
  coffeeStation(ctx)
  clock(ctx, 196, FRAME + 22)
  bookshelf(ctx, 276, 5)
  filingCabinet(ctx, 322)
  plant(ctx, 356, FLOOR_TOP - 16, true)
  // desk rugs (one per account row)
  for (const y of ROWS.ys) {
    const x = ROWS.x0
    const w = ROWS.x1 - ROWS.x0
    rect(ctx, x, y - 22, w, 62, C.outline)
    rect(ctx, x + 1, y - 21, w - 2, 60, C.rugBorder2)
    rect(ctx, x + 3, y - 19, w - 6, 56, C.rugBlue)
    for (let i = 0; i < w - 12; i += 10) rect(ctx, x + 6 + i, y - 16, 5, 1, C.rugBlueB)
  }
  // lounge, water cooler, printer, break table, front plants
  lounge(ctx)
  waterCooler(ctx, 18, 222)
  printer(ctx)
  breakTable(ctx)
  plant(ctx, 160, FLOOR_BOTTOM - 22)
  plant(ctx, W - FRAME - 22, FLOOR_BOTTOM - 22)
}

// --- desks ----------------------------------------------------------------------

export type DeskState = 'free' | 'in_use' | 'overdue' | 'reserved'

/** Chair behind a desk (drawn before the person sitting in it). */
export function drawChair(ctx: Ctx, d: DeskLayout) {
  const cx = d.desk.x + d.desk.w / 2
  const y = d.desk.y - 16
  box(ctx, cx - 9, y, 18, 14, '#5a3a2a')
  rect(ctx, cx - 8, y + 1, 16, 3, '#74503a')
  rect(ctx, cx - 9, y + 12, 18, 3, C.outline)
}

/** Wooden desk in ¾ view: top with monitor, lamp and props; front with the name-plate area. */
export function drawDesk(ctx: Ctx, d: DeskLayout, state: DeskState, mine: boolean, hover: boolean, t: number) {
  const { x, y, w } = d.desk
  if (hover || mine) rect(ctx, x - 6, y - 20, w + 12, d.desk.h + 26, mine ? 'rgba(255,230,140,0.25)' : 'rgba(255,255,255,0.15)')
  block(ctx, x, y, w, 14, 14, C.woodTop, C.woodFront, C.woodTopHi)
  // front: drawers either side of the plate
  rect(ctx, x + 2, y + 15, w - 4, 12, C.woodFrontLo)
  // monitor (screen faces the sitter; the camera sees its back) with a status light
  const mx = x + w / 2 - 10
  const on = state !== 'free'
  const light = state === 'overdue' ? (Math.floor(t * 2) % 2 ? '#ff5a4a' : '#8a2d2b') : state === 'reserved' ? '#f2c94c' : on ? '#6fe08a' : '#5a5650'
  box(ctx, mx, y - 8, 20, 13, '#4a4744')
  rect(ctx, mx + 2, y - 6, 16, 8, '#5f5b57')
  rect(ctx, mx + 8, y + 4, 4, 3, C.outline)
  rect(ctx, mx + 17, y - 6, 2, 2, light)
  if (on) rect(ctx, mx - 2, y + 4, 24, 2, 'rgba(140,255,170,0.25)')
  // lamp, papers, mug / sticky note
  rect(ctx, x + 4, y + 2, 6, 2, C.outline)
  rect(ctx, x + 6, y - 6, 2, 8, C.outline)
  box(ctx, x + 3, y - 9, 8, 5, '#e0a64e')
  box(ctx, x + w - 14, y + 3, 9, 7, C.paperSheet)
  if (state === 'reserved') box(ctx, x + w - 22, y + 2, 7, 7, '#f2d74c')
  else if (on) box(ctx, x + w - 21, y + 4, 5, 6, C.white)
}

/** Kept for API symmetry: desks have no separate partition in this style. */
export function drawPanel() {}

// --- characters -----------------------------------------------------------------

export type Facing = 'up' | 'down' | 'left' | 'right'
export interface Look {
  skin: string
  hair: string
  shirt: string
  pants: string
}

const SKINS = ['#f1c9a5', '#e0ac7e', '#c68b59', '#8d5a3b', '#f5d6c0']
const HAIRS = ['#2a1d14', '#5a3a22', '#a8692d', '#e2c06a', '#1b1b1f', '#8a2f2f', '#d9d9d9']
const PANTS = ['#2f3b59', '#3a3a3f', '#4a3a2a', '#2c4a3a']

export function lookFor(id: string, shirt: string): Look {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  h = Math.abs(h)
  return { skin: SKINS[h % SKINS.length]!, hair: HAIRS[(h >> 3) % HAIRS.length]!, shirt, pants: PANTS[(h >> 6) % PANTS.length]! }
}

/**
 * 12×16 character with its feet at (x, y). `step` alternates the legs while walking;
 * sitting characters are drawn from the waist up.
 */
export function drawCharacter(ctx: Ctx, x: number, y: number, look: Look, face: Facing, step: number, sitting: boolean) {
  const ox = Math.round(x) - 6
  const oy = Math.round(y) - (sitting ? 13 : 16)
  if (!sitting) rect(ctx, ox + 1, oy + 15, 10, 2, C.shadow)
  // legs
  if (!sitting) {
    const a = step % 2 === 1
    if (face === 'left' || face === 'right') {
      rect(ctx, ox + 3, oy + 11, 3, a ? 4 : 5, look.pants)
      rect(ctx, ox + 6, oy + 11, 3, a ? 5 : 4, look.pants)
      rect(ctx, ox + (a ? 2 : 3), oy + 15, 4, 1, C.ink)
      rect(ctx, ox + (a ? 6 : 5), oy + 15, 4, 1, C.ink)
    } else {
      rect(ctx, ox + 3, oy + 11, 2, a ? 4 : 5, look.pants)
      rect(ctx, ox + 7, oy + 11, 2, a ? 5 : 4, look.pants)
      rect(ctx, ox + 3, oy + (a ? 14 : 15), 2, 1, C.ink)
      rect(ctx, ox + 7, oy + (a ? 15 : 14), 2, 1, C.ink)
    }
  }
  // body + arms
  rect(ctx, ox + 2, oy + 6, 8, 6, look.shirt)
  rect(ctx, ox + 2, oy + 11, 8, 1, 'rgba(0,0,0,0.25)')
  if (face === 'left' || face === 'right') {
    rect(ctx, ox + 5, oy + 7, 3, 4, 'rgba(0,0,0,0.18)')
    rect(ctx, ox + (face === 'right' ? 7 : 3), oy + 9, 2, 2, look.skin)
  } else {
    rect(ctx, ox + 1, oy + 7, 1, 4, look.shirt)
    rect(ctx, ox + 10, oy + 7, 1, 4, look.shirt)
    rect(ctx, ox + 1, oy + 11, 1, 1, look.skin)
    rect(ctx, ox + 10, oy + 11, 1, 1, look.skin)
  }
  // head
  rect(ctx, ox + 2, oy, 8, 7, look.skin)
  rect(ctx, ox + 2, oy, 8, 2, look.hair)
  if (face === 'up') {
    rect(ctx, ox + 2, oy, 8, 6, look.hair)
  } else if (face === 'down') {
    rect(ctx, ox + 2, oy + 2, 1, 2, look.hair)
    rect(ctx, ox + 9, oy + 2, 1, 2, look.hair)
    rect(ctx, ox + 4, oy + 4, 1, 1, C.ink)
    rect(ctx, ox + 7, oy + 4, 1, 1, C.ink)
  } else {
    const back = face === 'left' ? ox + 7 : ox + 2
    rect(ctx, back, oy, 3, 5, look.hair)
    rect(ctx, face === 'left' ? ox + 3 : ox + 8, oy + 4, 1, 1, C.ink)
  }
}

/** Night: darken the room and add warm pools around the desk lamps and the lounge. */
export function drawNight(ctx: Ctx, lamps: { x: number; y: number }[]) {
  ctx.fillStyle = 'rgba(14,16,40,0.42)'
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'lighter'
  for (const l of lamps) {
    const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 46)
    g.addColorStop(0, 'rgba(255,200,120,0.32)')
    g.addColorStop(1, 'rgba(255,200,120,0)')
    ctx.fillStyle = g
    ctx.fillRect(l.x - 46, l.y - 46, 92, 92)
  }
  ctx.globalCompositeOperation = 'source-over'
}
