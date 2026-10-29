import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GEO, GLOW, rand } from './kit'

/**
 * A blocky plains village around the office: timber-framed houses on cobblestone footings,
 * stepped roofs, a well and bell in the square, crop farms with water channels, an animal pen,
 * hay bales, lantern posts on dirt paths, woods and terraced hills.
 *
 * Static boxes are drawn as one InstancedMesh (one draw call). Lantern glows are a second,
 * small InstancedMesh using the shared night-glow material.
 */

type V3 = [number, number, number]
interface Box {
  p: V3
  s: V3
  c: string
  r?: number
}

export const PATH_Z0 = 19.5
export const PATH_Z1 = 23.5

const K = {
  grass: '#62b043',
  grassTop: '#6dbf4b',
  dirt: '#866043',
  path: '#a3824f',
  pathDark: '#8f7144',
  cobble: '#8a8a8a',
  cobbleDark: '#6e6e6e',
  log: '#6b4f2e',
  logDark: '#4e3a22',
  plank: '#b8945f',
  plankLight: '#c9a670',
  spruce: '#5e4630',
  darkOak: '#4a3320',
  glass: '#b9e1ee',
  water: '#3f76e4',
  waterLight: '#5b8ff0',
  leaves: ['#3e8a2e', '#4b9c37', '#58ad40'],
  birchLeaves: ['#6aa84f', '#7cb85d'],
  birch: '#e3dfcf',
  birchMark: '#3b3b3b',
  farmland: '#5b3d24',
  wheat: ['#c9b34a', '#b9a23d', '#7fae3c'],
  carrot: '#e67e22',
  hay: '#d8b23a',
  hayBand: '#8a6a2a',
  wool: '#efefef',
  pig: '#f0a5a2',
  cowBody: '#5a4a3a',
  cowSpot: '#efefef',
  iron: '#c9c9c9',
  bell: '#e2b33c',
  flowers: ['#e04f5f', '#f2c230', '#4f7fe0', '#ffffff', '#c06bd8'],
  stoneHill: '#7d7d7d',
}

const ROOFS = [K.darkOak, K.spruce, '#7a3b2a']

function rot(dx: number, dz: number, r: number): [number, number] {
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [dx * c + dz * s, -dx * s + dz * c]
}

function placer(out: Box[], ox: number, oz: number, r = 0) {
  return (dx: number, y: number, dz: number, s: V3, c: string) => {
    const [x, z] = rot(dx, dz, r)
    out.push({ p: [ox + x, y, oz + z], s, c, r })
  }
}

interface Out {
  boxes: Box[]
  lights: V3[]
}

// --- small pieces ------------------------------------------------------------

function oak(o: Out, x: number, z: number, seed: number, scale = 1) {
  const b = o.boxes
  const h = Math.round(4 + rand(seed) * 2) * 0.5 * scale + 1.5
  const g = K.leaves
  b.push({ p: [x, h / 2, z], s: [0.5, h, 0.5], c: K.log })
  b.push({ p: [x, h - 0.2, z], s: [2.5 * scale, 1, 2.5 * scale], c: g[seed % 3]! })
  b.push({ p: [x, h + 0.75, z], s: [1.5 * scale, 1, 1.5 * scale], c: g[(seed + 1) % 3]! })
  b.push({ p: [x + 0.6, h - 0.75, z - 0.5], s: [1.2, 0.6, 1.2], c: g[(seed + 2) % 3]! })
}

function birch(o: Out, x: number, z: number, seed: number) {
  const b = o.boxes
  const h = 3 + rand(seed) * 1.5
  b.push({ p: [x, h / 2, z], s: [0.45, h, 0.45], c: K.birch })
  for (let y = 0.6; y < h; y += 0.9) b.push({ p: [x + 0.23, y, z], s: [0.02, 0.15, 0.25], c: K.birchMark })
  b.push({ p: [x, h + 0.1, z], s: [1.9, 1.2, 1.9], c: K.birchLeaves[seed % 2]! })
  b.push({ p: [x, h + 1, z], s: [1, 0.6, 1], c: K.birchLeaves[(seed + 1) % 2]! })
}

function flowers(o: Out, x: number, z: number, seed: number, n = 5) {
  for (let i = 0; i < n; i++) {
    const fx = x + (rand(seed + i) - 0.5) * 3
    const fz = z + (rand(seed + i * 7) - 0.5) * 3
    o.boxes.push({ p: [fx, 0.2, fz], s: [0.06, 0.4, 0.06], c: '#3e8a2e' })
    o.boxes.push({ p: [fx, 0.45, fz], s: [0.2, 0.2, 0.2], c: K.flowers[(seed + i) % K.flowers.length]! })
  }
}

function hay(o: Out, x: number, z: number, y = 0.5) {
  o.boxes.push({ p: [x, y, z], s: [1, 1, 1], c: K.hay })
  o.boxes.push({ p: [x, y, z], s: [1.02, 0.15, 1.02], c: K.hayBand })
  o.boxes.push({ p: [x, y + 0.32, z], s: [1.02, 0.12, 1.02], c: K.hayBand })
}

function barrel(o: Out, x: number, z: number) {
  o.boxes.push({ p: [x, 0.45, z], s: [0.8, 0.9, 0.8], c: K.spruce })
  o.boxes.push({ p: [x, 0.91, z], s: [0.6, 0.02, 0.6], c: K.logDark })
  o.boxes.push({ p: [x, 0.25, z], s: [0.82, 0.08, 0.82], c: K.iron })
  o.boxes.push({ p: [x, 0.7, z], s: [0.82, 0.08, 0.82], c: K.iron })
}

/** Fence post with a hanging lantern (the glow is in the lights list). */
function lanternPost(o: Out, x: number, z: number) {
  o.boxes.push({ p: [x, 0.2, z], s: [0.5, 0.4, 0.5], c: K.cobble })
  o.boxes.push({ p: [x, 1.3, z], s: [0.2, 2.2, 0.2], c: K.plank })
  o.boxes.push({ p: [x, 2.45, z], s: [0.45, 0.1, 0.45], c: K.logDark })
  o.boxes.push({ p: [x, 2.05, z], s: [0.38, 0.06, 0.38], c: K.logDark })
  o.lights.push([x, 2.25, z])
}

function fenceLine(o: Out, x0: number, z0: number, x1: number, z1: number, gap?: [number, number]) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const n = Math.round(len / 0.9)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = x0 + (x1 - x0) * t
    const z = z0 + (z1 - z0) * t
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? x : z
    if (gap && along > gap[0] && along < gap[1]) continue
    o.boxes.push({ p: [x, 0.5, z], s: [0.2, 1, 0.2], c: K.plank })
    if (i < n) {
      const nx = x0 + (x1 - x0) * ((i + 0.5) / n)
      const nz = z0 + (z1 - z0) * ((i + 0.5) / n)
      const nAlong = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? nx : nz
      if (gap && nAlong > gap[0] - 0.45 && nAlong < gap[1] + 0.45) continue
      const sx = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? len / n : 0.1
      const sz = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 0.1 : len / n
      o.boxes.push({ p: [nx, 0.65, nz], s: [sx, 0.12, sz], c: K.plank })
      o.boxes.push({ p: [nx, 0.35, nz], s: [sx, 0.12, sz], c: K.plank })
    }
  }
}

/** Dirt path strip from (x0,z0) to (x1,z1), axis-aligned, with speckles. */
function path(o: Out, x0: number, z0: number, x1: number, z1: number, w = 2) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0)
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0)
  o.boxes.push({ p: [cx, 0.015, cz], s: alongX ? [len, 0.03, w] : [w, 0.03, len], c: K.path })
  for (let i = 0; i < len; i += 1.3) {
    const t = alongX ? [Math.min(x0, x1) + i, cz + (rand(i * 13 + cx) - 0.5) * (w - 0.6)] : [cx + (rand(i * 13 + cz) - 0.5) * (w - 0.6), Math.min(z0, z1) + i]
    o.boxes.push({ p: [t[0]!, 0.03, t[1]!], s: [0.5, 0.02, 0.5], c: K.pathDark })
  }
}

// --- buildings ---------------------------------------------------------------

/**
 * Timber-framed house: cobblestone footing, log corner posts, plank walls, glass panes,
 * a door with a step, and a stepped roof. Front is local +z.
 */
function house(o: Out, x: number, z: number, r: number, seed: number, size: 'small' | 'big' = 'small') {
  const b = placer(o.boxes, x, z, r)
  const W = size === 'big' ? 7 : 5
  const D = size === 'big' ? 6 : 5
  const H = size === 'big' ? 4.5 : 3
  const roof = ROOFS[seed % ROOFS.length]!
  b(0, 0.25, 0, [W + 0.2, 0.5, D + 0.2], K.cobble)
  b(0, 0.5 + H / 2, 0, [W - 0.2, H, D - 0.2], seed % 2 ? K.plank : K.plankLight)
  for (const [cx, cz] of [
    [-W / 2 + 0.25, -D / 2 + 0.25],
    [W / 2 - 0.25, -D / 2 + 0.25],
    [-W / 2 + 0.25, D / 2 - 0.25],
    [W / 2 - 0.25, D / 2 - 0.25],
  ] as const)
    b(cx, 0.5 + H / 2, cz, [0.5, H, 0.5], K.log)
  b(0, 0.5 + H - 0.15, 0, [W, 0.3, D], K.log) // top beam
  if (size === 'big') b(0, 0.5 + H / 2, 0, [W, 0.3, D], K.log) // floor beam
  // door + step + windows
  b(-W / 4, 1.5, D / 2 - 0.05, [1, 2, 0.12], K.spruce)
  b(-W / 4, 0.6, D / 2 + 0.4, [1.2, 0.2, 0.6], K.cobbleDark)
  b(W / 4, 2, D / 2 - 0.05, [1, 1, 0.12], K.glass)
  b(-W / 2 + 0.05, 2, 0, [0.12, 1, 1], K.glass)
  b(W / 2 - 0.05, 2, 0, [0.12, 1, 1], K.glass)
  if (size === 'big') {
    b(-W / 4, 4.2, D / 2 - 0.05, [1, 1, 0.12], K.glass)
    b(W / 4, 4.2, D / 2 - 0.05, [1, 1, 0.12], K.glass)
  }
  // stepped roof along x (stairs-style terraces)
  const steps = Math.ceil(D / 2) + 1
  for (let i = 0; i < steps; i++) {
    const depth = D + 1 - i * 2
    if (depth <= 0) break
    b(0, 0.5 + H + 0.25 + i * 0.5, 0, [W + 0.8, 0.5, depth], roof)
  }
  // gable ends in planks
  for (let i = 0; i < steps - 1; i++) {
    const depth = D - 1 - i * 2
    if (depth <= 0) break
    b(-W / 2 + 0.1, 0.5 + H + 0.25 + i * 0.5, 0, [0.2, 0.5, depth], K.plank)
    b(W / 2 - 0.1, 0.5 + H + 0.25 + i * 0.5, 0, [0.2, 0.5, depth], K.plank)
  }
  // a lantern by the door and some flowers/hay in front
  o.lights.push([x + rot(-W / 4 - 0.9, D / 2 + 0.2, r)[0], 2.3, z + rot(-W / 4 - 0.9, D / 2 + 0.2, r)[1]])
  b(-W / 4 - 0.9, 2.1, D / 2 + 0.2, [0.2, 0.4, 0.2], K.logDark)
  if (seed % 3 === 0) hay(o, x + rot(W / 2 + 1, D / 2 - 0.5, r)[0], z + rot(W / 2 + 1, D / 2 - 0.5, r)[1])
  if (seed % 3 === 1) barrel(o, x + rot(W / 2 + 0.8, D / 2 - 0.6, r)[0], z + rot(W / 2 + 0.8, D / 2 - 0.6, r)[1])
}

/** Cobblestone watchtower with a plank top and fence railing. */
function tower(o: Out, x: number, z: number) {
  const b = o.boxes
  b.push({ p: [x, 4, z], s: [3, 8, 3], c: K.cobble })
  for (let y = 1; y < 8; y += 2) b.push({ p: [x, y, z + 1.51], s: [0.6, 0.8, 0.02], c: '#2a2a2e' })
  b.push({ p: [x, 8.25, z], s: [4, 0.5, 4], c: K.plank })
  for (const [dx, dz] of [
    [-1.8, -1.8],
    [1.8, -1.8],
    [-1.8, 1.8],
    [1.8, 1.8],
  ] as const) {
    b.push({ p: [x + dx, 9.5, z + dz], s: [0.3, 2, 0.3], c: K.log })
  }
  b.push({ p: [x, 10.6, z], s: [4.6, 0.4, 4.6], c: K.darkOak })
  b.push({ p: [x, 11, z], s: [3, 0.4, 3], c: K.darkOak })
  fenceLine(o, x - 1.8, z + 1.8, x + 1.8, z + 1.8)
  fenceLine(o, x - 1.8, z - 1.8, x + 1.8, z - 1.8)
  o.lights.push([x, 9.6, z])
}

/** Village square: cobblestone plaza, well with a roof, and a bell on a post. */
function square(o: Out, cx: number, cz: number) {
  const b = o.boxes
  b.push({ p: [cx, 0.02, cz], s: [11, 0.04, 11], c: K.cobble })
  for (let i = 0; i < 18; i++) b.push({ p: [cx - 5 + rand(i + 3) * 10, 0.045, cz - 5 + rand(i * 5 + 1) * 10], s: [0.9, 0.02, 0.9], c: K.cobbleDark })
  // well
  b.push({ p: [cx, 0.5, cz], s: [3.6, 1, 3.6], c: K.cobble })
  b.push({ p: [cx, 0.98, cz], s: [2.4, 0.06, 2.4], c: K.water })
  for (const [dx, dz] of [
    [-1.5, -1.5],
    [1.5, -1.5],
    [-1.5, 1.5],
    [1.5, 1.5],
  ] as const)
    b.push({ p: [cx + dx, 2, cz + dz], s: [0.25, 2, 0.25], c: K.plank })
  b.push({ p: [cx, 3.15, cz], s: [4.2, 0.4, 4.2], c: K.cobbleDark })
  b.push({ p: [cx, 3.5, cz], s: [2.4, 0.4, 2.4], c: K.cobbleDark })
  // bell
  b.push({ p: [cx + 4, 1.2, cz - 3.6], s: [0.3, 2.4, 0.3], c: K.log })
  b.push({ p: [cx + 4, 2.45, cz - 3.6], s: [0.9, 0.2, 0.3], c: K.log })
  b.push({ p: [cx + 4, 2.05, cz - 3.45], s: [0.5, 0.55, 0.5], c: K.bell })
  // market stall
  const st = placer(b, cx - 4, cz + 3.4, 0)
  st(0, 0.5, 0, [2.6, 1, 1], K.plank)
  st(-1.2, 1.4, -0.4, [0.15, 2.8, 0.15], K.log)
  st(1.2, 1.4, -0.4, [0.15, 2.8, 0.15], K.log)
  for (let i = 0; i < 5; i++) st(-1.2 + i * 0.6, 2.85, 0, [0.6, 0.12, 1.6], i % 2 ? '#e8e8e8' : '#c0392b')
  st(-0.7, 1.12, 0, [0.4, 0.25, 0.4], K.carrot)
  st(0, 1.12, 0, [0.4, 0.25, 0.4], '#c0392b')
  st(0.7, 1.12, 0, [0.4, 0.25, 0.4], K.hay)
  for (const [dx, dz] of [
    [-5, -5],
    [5, 5],
    [-5, 5],
    [5, -5],
  ] as const)
    lanternPost(o, cx + dx, cz + dz)
}

/** Crop field with a water channel down the middle and a log border. */
function farm(o: Out, x: number, z: number, w: number, d: number, crop: 'wheat' | 'carrot', seed: number) {
  const b = o.boxes
  b.push({ p: [x, 0.25, z], s: [w + 0.5, 0.5, d + 0.5], c: K.log })
  b.push({ p: [x, 0.3, z], s: [w, 0.5, d], c: K.farmland })
  b.push({ p: [x, 0.52, z], s: [0.5, 0.05, d], c: K.water })
  for (let i = -w / 2 + 0.5; i < w / 2; i += 0.6) {
    if (Math.abs(i) < 0.45) continue
    for (let j = -d / 2 + 0.4; j < d / 2; j += 0.6) {
      const h = 0.25 + rand(seed + i * 31 + j * 7) * 0.35
      const c = crop === 'wheat' ? K.wheat[Math.floor(rand(seed + i * 3 + j) * 3)]! : rand(seed + i + j * 5) < 0.3 ? K.carrot : '#5aa83c'
      b.push({ p: [x + i, 0.55 + h / 2, z + j], s: [0.35, h, 0.35], c })
    }
  }
}

/** Fenced pen with a few blocky animals and a water trough. */
function pen(o: Out, x0: number, z0: number, x1: number, z1: number) {
  fenceLine(o, x0, z0, x1, z0)
  fenceLine(o, x0, z1, x1, z1, [(x0 + x1) / 2 - 0.8, (x0 + x1) / 2 + 0.8])
  fenceLine(o, x0, z0, x0, z1)
  fenceLine(o, x1, z0, x1, z1)
  const b = o.boxes
  const animal = (x: number, z: number, r: number, kind: 'sheep' | 'pig' | 'cow') => {
    const a = placer(b, x, z, r)
    const body = kind === 'sheep' ? K.wool : kind === 'pig' ? K.pig : K.cowBody
    const head = kind === 'sheep' ? '#d8c9b5' : kind === 'pig' ? K.pig : K.cowBody
    a(0, 0.75, 0, [0.8, 0.7, 1.3], body)
    a(0, 1.0, 0.8, [0.55, 0.55, 0.55], head)
    if (kind === 'pig') a(0, 0.92, 1.1, [0.3, 0.2, 0.06], '#e08b88')
    if (kind === 'cow') {
      a(0.2, 0.9, 0.1, [0.42, 0.3, 0.6], K.cowSpot)
      a(0.25, 1.32, 0.8, [0.1, 0.12, 0.1], '#d8d8d8')
      a(-0.25, 1.32, 0.8, [0.1, 0.12, 0.1], '#d8d8d8')
    }
    a(0.08, 1.08, 1.08, [0.08, 0.08, 0.02], '#111111')
    a(-0.18, 1.08, 1.08, [0.08, 0.08, 0.02], '#111111')
    for (const [lx, lz] of [
      [-0.25, -0.45],
      [0.25, -0.45],
      [-0.25, 0.45],
      [0.25, 0.45],
    ] as const)
      a(lx, 0.2, lz, [0.22, 0.4, 0.22], kind === 'sheep' ? '#d8c9b5' : body)
  }
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  animal(cx - 2, cz - 1, 0.6, 'sheep')
  animal(cx + 1.5, cz - 1.5, -0.8, 'sheep')
  animal(cx - 0.5, cz + 1.2, 2.4, 'pig')
  animal(cx + 2.2, cz + 1, 3.6, 'cow')
  b.push({ p: [x0 + 1.2, 0.3, cz], s: [0.8, 0.6, 2], c: K.spruce })
  b.push({ p: [x0 + 1.2, 0.55, cz], s: [0.6, 0.06, 1.8], c: K.water })
  hay(o, x1 - 1, z0 + 1)
  hay(o, x1 - 2, z0 + 1)
  hay(o, x1 - 1.5, z0 + 1, 1.5)
}

function pond(o: Out, x: number, z: number, w: number, d: number) {
  const b = o.boxes
  b.push({ p: [x, 0.02, z], s: [w + 1, 0.04, d + 1], c: '#c9b98a' }) // sand rim
  b.push({ p: [x, 0.04, z], s: [w, 0.04, d], c: K.water })
  b.push({ p: [x, 0.05, z], s: [w - 1.5, 0.04, d - 1.5], c: K.waterLight })
  for (let i = 0; i < 4; i++) b.push({ p: [x - w / 3 + i * 1.3, 0.08, z + (i % 2 ? 0.7 : -0.6)], s: [0.6, 0.03, 0.6], c: '#3c8a2c' })
  for (let i = 0; i < 6; i++) b.push({ p: [x + w / 2 + 0.2, 0.6 + (i % 3) * 0.1, z - d / 2 + i * (d / 6)], s: [0.2, 1.2 + (i % 3) * 0.3, 0.2], c: '#7fbf5a' }) // reeds
}

/** Terraced grass hills (dirt sides) on the horizon. */
function hill(o: Out, x: number, z: number, w: number, d: number, tiers: number, seed: number) {
  for (let i = 0; i < tiers; i++) {
    const tw = w - i * (w / (tiers + 1))
    const td = d - i * (d / (tiers + 1))
    const y = i * 1.5
    const ox = (rand(seed + i) - 0.5) * 2
    const oz = (rand(seed + i * 3) - 0.5) * 2
    o.boxes.push({ p: [x + ox, y + 0.6, z + oz], s: [tw, 1.2, td], c: K.dirt })
    o.boxes.push({ p: [x + ox, y + 1.35, z + oz], s: [tw, 0.3, td], c: i === tiers - 1 && tiers > 3 ? '#9a9a9a' : K.grassTop })
  }
}

// --- layout ------------------------------------------------------------------

export function buildVillage(): Out {
  const o: Out = { boxes: [], lights: [] }

  // main path in front of the office (replaces the road), crossing paths to the square
  path(o, -70, (PATH_Z0 + PATH_Z1) / 2, 70, (PATH_Z0 + PATH_Z1) / 2, PATH_Z1 - PATH_Z0)
  path(o, 0, PATH_Z1, 0, 30, 2.4)
  // from the main path round to the office door (left wall)
  path(o, -20, 1.5, -20, PATH_Z0, 2)
  path(o, -21, 1.5, -15.2, 1.5, 2)
  for (let x = -60; x <= 60; x += 12) if (Math.abs(x) > 4) lanternPost(o, x, PATH_Z0 - 0.8)

  // village square across from the office
  square(o, 0, 36)
  path(o, -30, 36, -5.5, 36, 2)
  path(o, 5.5, 36, 30, 36, 2)
  path(o, 0, 41.5, 0, 56, 2)

  // houses around the square, facing the paths
  house(o, -12, 29.5, Math.PI, 1)
  house(o, 12, 29.5, Math.PI, 2, 'big')
  house(o, -12, 43, 0, 3, 'big')
  house(o, 12, 43, 0, 4)
  house(o, -24, 30, Math.PI, 5)
  house(o, 24, 30, Math.PI, 6)
  house(o, -24, 42, 0, 7)
  house(o, 24, 43, 0, 8, 'big')
  house(o, -8, 52, Math.PI / 2, 9)
  house(o, 8, 52, -Math.PI / 2, 10)
  house(o, -40, 36, Math.PI / 2, 11, 'big')
  house(o, 40, 36, -Math.PI / 2, 12)
  tower(o, 34, 50)

  // farms on the left (where the parking lot was) and behind
  farm(o, -27, -1, 9, 12, 'wheat', 1)
  farm(o, -27, 13, 9, 6, 'carrot', 2)
  farm(o, -40, 4, 8, 20, 'wheat', 3)
  path(o, -33, -8, -33, 17, 1.6)
  house(o, -27, -13, 0, 13) // farmer's house
  for (let i = 0; i < 3; i++) hay(o, -21.5, -9 + i * 1.1)
  hay(o, -21.5, -8.45, 1.5)

  // right side: animal pen, pond, a house and barrels where the shops were
  pen(o, 20, -6, 32, 4)
  pond(o, 26, 11.5, 8, 5)
  house(o, 38, -2, -Math.PI / 2, 14, 'big')
  house(o, 38, 10, -Math.PI / 2, 15)
  for (let i = 0; i < 3; i++) barrel(o, 35.5, 14.2 + i)
  path(o, 33, -12, 33, PATH_Z0, 1.6)

  // behind the office: a meadow with an allotment, woods, then hills
  farm(o, -6, -21, 10, 6, 'carrot', 4)
  farm(o, 8, -21, 10, 6, 'wheat', 5)
  house(o, 22, -22, 0, 16)
  house(o, -22, -24, 0, 17, 'big')
  flowers(o, 0, -27, 21, 8)
  flowers(o, 14, -28, 33, 6)

  // trees: woods behind and on the sides, a few in the village
  let s = 50
  for (let x = -66; x <= 66; x += 5.5) {
    for (const zr of [-34, -40]) {
      const tx = x + (rand(s) - 0.5) * 2.5
      const tz = zr + (rand(s + 1) - 0.5) * 3
      if (rand(s + 2) < 0.35) birch(o, tx, tz, s)
      else oak(o, tx, tz, s)
      s++
    }
  }
  for (const zr of [-26, -14, -2, 10, 22, 34, 46, 58]) {
    oak(o, -58 + (rand(s) - 0.5) * 3, zr, s++)
    birch(o, 58 + (rand(s) - 0.5) * 3, zr, s++)
  }
  for (const [x, z] of [
    [-18, 27],
    [18, 27],
    [-32, 46],
    [-17, 52],
    [17, 52],
    [46, 45],
    [-46, 22],
    [46, 22],
    [-14, -30],
    [30, -26],
  ] as const)
    oak(o, x, z, s++)
  for (const [x, z] of [
    [-6, 47],
    [6, 47],
    [-30, 26],
    [30, 26],
    [-46, 12],
    [44, 4],
  ] as const)
    flowers(o, x, z, s++)

  // horizon hills
  hill(o, -40, -62, 34, 18, 4, 1)
  hill(o, 0, -66, 40, 16, 5, 2)
  hill(o, 42, -60, 30, 20, 3, 3)
  hill(o, -78, -10, 18, 50, 4, 4)
  hill(o, 78, -6, 18, 46, 3, 5)
  return o
}

function useInstanced(boxes: Box[], material: THREE.Material, cast = true) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const col = new THREE.Color()
    boxes.forEach((b, i) => {
      q.setFromAxisAngle(up, b.r ?? 0)
      m.compose(new THREE.Vector3(...b.p), q, new THREE.Vector3(...b.s))
      mesh.setMatrixAt(i, m)
      if (b.c) mesh.setColorAt(i, col.set(b.c))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [boxes])
  return <instancedMesh ref={ref} args={[GEO.box, material, boxes.length]} castShadow={cast} receiveShadow />
}

export function Village() {
  const { boxes, lanterns } = useMemo(() => {
    const v = buildVillage()
    return {
      boxes: v.boxes,
      lanterns: v.lights.map((p): Box => ({ p, s: [0.26, 0.3, 0.26], c: '' })),
    }
  }, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), [])
  return (
    <group>
      {useInstanced(boxes, material)}
      {useInstanced(lanterns, GLOW.lamp, false)}
    </group>
  )
}
