import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { B, GEO, GLOW, NIGHT, glowTexture, rand } from './kit'

/**
 * A blocky downtown around the office: a street grid with lane markings and crosswalks, shops
 * with awnings on the near side, glass towers that climb into a skyline behind, parked and
 * driving cars, street lamps, traffic lights, planter trees and a small park with a fountain.
 *
 * Static boxes are one InstancedMesh each: structure, lit windows, dark windows and lamp glows.
 * Lit windows and lamps use emissive materials that the day/night cycle drives.
 */

type V3 = [number, number, number]
interface Box {
  p: V3
  s: V3
  c: string
  r?: number
}

/** Emissive city materials (lit windows); DayNight in Stage drives their intensity. */
export const CITY_GLOW: THREE.MeshStandardMaterial[] = []

const litWindow = new THREE.MeshStandardMaterial({ color: '#a9cde2', emissive: '#ffd88a', emissiveIntensity: 0, roughness: 0.3, flatShading: true })
CITY_GLOW.push(litWindow)
const darkWindow = new THREE.MeshStandardMaterial({ color: '#5f86a6', roughness: 0.3, metalness: 0.2, flatShading: true })

export const ROAD_FRONT_Z = 28
export const ROAD_BACK_Z = -28
export const ROAD_SIDE_X = 33
const ROAD_W = 9

const K = {
  asphalt: '#3b3e46',
  asphaltLight: '#454852',
  curb: '#c9c7c0',
  line: '#e9e9e4',
  yellow: '#e8b923',
  planter: '#7b7d82',
  trunk: '#6b4f2e',
  leaves: ['#3e8a3a', '#4a9a41', '#58ad4a'],
  grass: '#62b04b',
  pathway: '#d8d1c1',
  water: '#4aa3e0',
  stone: '#a7a9ae',
  metal: '#9aa0a8',
  dark: '#23252b',
  wheel: '#16171b',
  glassCar: '#9fc9e0',
  walls: ['#c9c2b6', '#8d98a6', '#a8553f', '#d9d4c7', '#5f6b7a', '#7fa0aa', '#e3c78a', '#b9bec6'],
  awnings: ['#c0392b', '#2f7fc0', '#2fa36b', '#e8a317', '#8e44ad'],
  cars: ['#c0392b', '#2f6fc0', '#e8e8e8', '#e8b923', '#2d3138', '#3a9a5b', '#d9d9d9', '#7a4fb0'],
}

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
  lit: Box[]
  dark: Box[]
}

// --- streets -------------------------------------------------------------------

function slab(o: Out, x0: number, z0: number, x1: number, z1: number, y: number, h: number, c: string) {
  o.boxes.push({ p: [(x0 + x1) / 2, y, (z0 + z1) / 2], s: [x1 - x0, h, z1 - z0], c })
}

/** Straight road with curbs and a dashed yellow centre line (gaps at crossings). */
function road(o: Out, alongX: boolean, centre: number, crossings: number[]) {
  const half = ROAD_W / 2
  const L = 90
  if (alongX) slab(o, -L, centre - half, L, centre + half, 0.02, 0.04, K.asphalt)
  else slab(o, centre - half, -L, centre + half, L, 0.02, 0.04, K.asphalt)
  for (const side of [-1, 1]) {
    const e = centre + side * (half + 0.15)
    if (alongX) slab(o, -L, e - 0.15, L, e + 0.15, 0.05, 0.1, K.curb)
    else slab(o, e - 0.15, -L, e + 0.15, L, 0.05, 0.1, K.curb)
  }
  for (let t = -L + 1; t < L; t += 3) {
    if (crossings.some((c) => Math.abs(t - c) < ROAD_W / 2 + 3)) continue
    if (alongX) o.boxes.push({ p: [t, 0.045, centre], s: [1.6, 0.02, 0.18], c: K.yellow })
    else o.boxes.push({ p: [centre, 0.045, t], s: [0.18, 0.02, 1.6], c: K.yellow })
  }
}

/** Zebra crossing: bars spread across a road; `at` is the position along it, `centre` its axis. */
function crosswalk(o: Out, alongX: boolean, centre: number, at: number) {
  for (let i = -3; i <= 3; i++) {
    const t = centre + i * 1.15
    if (alongX) o.boxes.push({ p: [at, 0.045, t], s: [2.6, 0.02, 0.6], c: K.line })
    else o.boxes.push({ p: [t, 0.045, at], s: [0.6, 0.02, 2.6], c: K.line })
  }
}

// --- street furniture -------------------------------------------------------------

/** Lamp post with its arm reaching one block-length toward (dx, dz): the side the road is on. */
function streetLamp(o: Out, x: number, z: number, dx: number, dz: number) {
  o.boxes.push({ p: [x, 0.15, z], s: [0.4, 0.3, 0.4], c: K.stone })
  o.boxes.push({ p: [x, 2.3, z], s: [0.16, 4.3, 0.16], c: K.dark })
  o.boxes.push({ p: [x + dx * 0.5, 4.4, z + dz * 0.5], s: [dx ? 1.1 : 0.14, 0.14, dz ? 1.1 : 0.14], c: K.dark })
  o.boxes.push({ p: [x + dx, 4.3, z + dz], s: [0.6, 0.1, 0.6], c: K.metal })
  o.lights.push([x + dx, 4.2, z + dz])
}

function trafficLight(o: Out, x: number, z: number) {
  o.boxes.push({ p: [x, 1.75, z], s: [0.18, 3.5, 0.18], c: K.dark })
  o.boxes.push({ p: [x, 3.6, z], s: [0.5, 1.3, 0.5], c: K.dark })
  const lamps = ['#d63a2f', '#e8b923', '#35b35a']
  lamps.forEach((c, i) => o.boxes.push({ p: [x, 4.05 - i * 0.42, z + 0.27], s: [0.28, 0.28, 0.06], c }))
}

function bench(o: Out, x: number, z: number, r = 0) {
  const b = placer(o.boxes, x, z, r)
  b(0, 0.45, 0, [1.6, 0.12, 0.5], '#8a5a34')
  b(0, 0.85, -0.22, [1.6, 0.4, 0.1], '#8a5a34')
  b(-0.7, 0.22, 0, [0.12, 0.44, 0.45], K.dark)
  b(0.7, 0.22, 0, [0.12, 0.44, 0.45], K.dark)
}

function cityTree(o: Out, x: number, z: number, seed: number) {
  const g = K.leaves
  o.boxes.push({ p: [x, 0.2, z], s: [1, 0.4, 1], c: K.planter })
  o.boxes.push({ p: [x, 1.2, z], s: [0.3, 1.6, 0.3], c: K.trunk })
  o.boxes.push({ p: [x, 2.5, z], s: [2, 1.4, 2], c: g[seed % 3]! })
  o.boxes.push({ p: [x, 3.4, z], s: [1.2, 0.8, 1.2], c: g[(seed + 1) % 3]! })
}

function hydrant(o: Out, x: number, z: number) {
  o.boxes.push({ p: [x, 0.3, z], s: [0.3, 0.6, 0.3], c: '#c0392b' })
  o.boxes.push({ p: [x, 0.62, z], s: [0.4, 0.1, 0.4], c: '#a52f24' })
}

/** Low concrete planter with a clipped hedge. */
function hedge(o: Out, x: number, z: number) {
  o.boxes.push({ p: [x, 0.3, z], s: [2.2, 0.6, 0.9], c: K.planter })
  o.boxes.push({ p: [x, 0.8, z], s: [2.0, 0.5, 0.7], c: K.leaves[0]! })
  o.boxes.push({ p: [x, 1.1, z], s: [1.7, 0.2, 0.55], c: K.leaves[2]! })
}

/** Hedge planter running along z (side of the office) instead of x. */
function hedgeSide(o: Out, x: number, z: number) {
  o.boxes.push({ p: [x, 0.3, z], s: [0.9, 0.6, 2.2], c: K.planter })
  o.boxes.push({ p: [x, 0.8, z], s: [0.7, 0.5, 2.0], c: K.leaves[1]! })
  o.boxes.push({ p: [x, 1.1, z], s: [0.55, 0.2, 1.7], c: K.leaves[2]! })
}

/** Tall street tree with a layered crown, taller than the planter trees. */
function bigTree(o: Out, x: number, z: number, seed: number) {
  const g = K.leaves
  o.boxes.push({ p: [x, 0.2, z], s: [1.3, 0.4, 1.3], c: K.planter })
  o.boxes.push({ p: [x, 1.9, z], s: [0.45, 3.0, 0.45], c: K.trunk })
  o.boxes.push({ p: [x, 3.6, z], s: [3.0, 1.5, 3.0], c: g[seed % 3]! })
  o.boxes.push({ p: [x + 0.2, 4.7, z - 0.1], s: [2.0, 1.0, 2.0], c: g[(seed + 1) % 3]! })
  o.boxes.push({ p: [x - 0.1, 5.5, z + 0.1], s: [1.0, 0.7, 1.0], c: g[(seed + 2) % 3]! })
}

/** Raised flower bed with rows of coloured blooms. */
function flowerBed(o: Out, x: number, z: number, w: number, seed: number) {
  o.boxes.push({ p: [x, 0.2, z], s: [w, 0.4, 1.1], c: K.planter })
  o.boxes.push({ p: [x, 0.42, z], s: [w - 0.2, 0.08, 0.9], c: '#5b3d24' })
  const cols = ['#e04f5f', '#f2c230', '#c06bd8', '#ff8fb1', '#ffffff', '#5b8def']
  for (let i = 0; i < Math.floor(w / 0.45); i++)
    for (const dz of [-0.25, 0.25]) {
      o.boxes.push({ p: [x - w / 2 + 0.35 + i * 0.45, 0.62, z + dz], s: [0.08, 0.3, 0.08], c: '#3e8a2e' })
      o.boxes.push({ p: [x - w / 2 + 0.35 + i * 0.45, 0.82, z + dz], s: [0.2, 0.16, 0.2], c: cols[(seed + i + (dz > 0 ? 3 : 0)) % cols.length]! })
    }
}

function busStop(o: Out, x: number, z: number) {
  const b = placer(o.boxes, x, z)
  for (const dx of [-1.6, 1.6]) b(dx, 1.2, 0, [0.12, 2.4, 0.12], K.dark)
  b(0, 2.45, -0.2, [3.6, 0.12, 1.6], '#2f7fc0')
  b(0, 1.3, -0.85, [3.4, 1.8, 0.06], '#bfe2f3')
  b(0, 0.45, -0.4, [2.4, 0.1, 0.45], K.metal)
}

/** Parked car, nose toward local +x. */
function car(o: Out, x: number, z: number, r: number, c: string) {
  const b = placer(o.boxes, x, z, r)
  b(0, 0.5, 0, [2.3, 0.55, 1.1], c)
  b(-0.1, 1.0, 0, [1.2, 0.5, 0.96], K.glassCar)
  b(-0.1, 1.27, 0, [1.1, 0.06, 0.9], c)
  for (const dx of [-0.75, 0.75]) for (const dz of [-0.5, 0.5]) b(dx, 0.22, dz, [0.45, 0.45, 0.14], K.wheel)
}

// --- buildings ----------------------------------------------------------------------

/** A wall block with a grid of windows on the two faces the camera sees (+z and +x). */
function block(o: Out, x: number, z: number, w: number, d: number, y0: number, y1: number, color: string, seed: number, winFrom = 1.1) {
  o.boxes.push({ p: [x, (y0 + y1) / 2, z], s: [w, y1 - y0, d], c: color })
  const rows = Math.floor((y1 - y0 - winFrom - 0.4) / 1.5) + 1
  const nx = Math.max(1, Math.floor((w - 0.6) / 1.4))
  const nz = Math.max(1, Math.floor((d - 0.6) / 1.4))
  for (let r = 0; r < rows; r++) {
    const y = y0 + winFrom + r * 1.5
    for (let c = 0; c < nx; c++) {
      const lit = rand(seed * 131 + r * 17 + c * 3) < 0.5
      ;(lit ? o.lit : o.dark).push({ p: [x - ((nx - 1) * 1.4) / 2 + c * 1.4, y, z + d / 2 + 0.04], s: [0.8, 0.9, 0.1], c: '' })
    }
    for (let c = 0; c < nz; c++) {
      const lit = rand(seed * 71 + r * 13 + c * 5 + 9) < 0.5
      ;(lit ? o.lit : o.dark).push({ p: [x + w / 2 + 0.04, y, z - ((nz - 1) * 1.4) / 2 + c * 1.4], s: [0.1, 0.9, 0.8], c: '' })
    }
  }
}

function roofTop(o: Out, x: number, z: number, w: number, d: number, y: number, seed: number) {
  o.boxes.push({ p: [x, y + 0.2, z], s: [w + 0.3, 0.4, d + 0.3], c: K.metal })
  const ac = Math.floor(rand(seed) * 3) + 1
  for (let i = 0; i < ac; i++) {
    const ax = x + (rand(seed + i * 3) - 0.5) * (w - 2)
    const az = z + (rand(seed + i * 7) - 0.5) * (d - 2)
    o.boxes.push({ p: [ax, y + 0.8, az], s: [1.2, 0.8, 1], c: '#d4d6da' })
    o.boxes.push({ p: [ax, y + 1.25, az], s: [0.7, 0.1, 0.7], c: K.dark })
  }
  if (rand(seed + 5) < 0.35) {
    o.boxes.push({ p: [x, y + 2.6, z], s: [0.12, 4.4, 0.12], c: K.dark })
    o.lights.push([x, y + 4.9, z])
  }
}

/** Office or apartment tower, with a setback upper section when tall. */
function tower(o: Out, x: number, z: number, w: number, d: number, h: number, seed: number) {
  const color = K.walls[seed % K.walls.length]!
  o.boxes.push({ p: [x, 0.5, z], s: [w + 0.3, 1, d + 0.3], c: '#5d6068' })
  if (h > 16) {
    const h1 = Math.round(h * 0.62)
    block(o, x, z, w, d, 1, h1, color, seed)
    block(o, x, z, w * 0.68, d * 0.68, h1, h, color, seed + 50)
    roofTop(o, x, z, w * 0.68, d * 0.68, h, seed)
  } else {
    block(o, x, z, w, d, 1, h, color, seed)
    roofTop(o, x, z, w, d, h, seed)
  }
}

/** Low shop: lit storefront, an awning over the pavement, and a couple of floors above. */
function shop(o: Out, x: number, z: number, w: number, d: number, h: number, seed: number) {
  const color = K.walls[seed % K.walls.length]!
  o.boxes.push({ p: [x, 0.5, z], s: [w + 0.2, 1, d + 0.2], c: '#5d6068' })
  block(o, x, z, w, d, 1, h, color, seed, 3.0)
  o.lit.push({ p: [x, 2.0, z + d / 2 + 0.05], s: [w - 1.6, 1.4, 0.1], c: '' })
  o.boxes.push({ p: [x - w / 2 + 0.6, 1.5, z + d / 2 + 0.06], s: [0.9, 1.8, 0.1], c: '#2b2d33' })
  const awn = K.awnings[seed % K.awnings.length]!
  for (let i = 0; i < Math.floor((w - 0.6) / 0.8); i++) {
    const ax = x - (w - 0.8) / 2 + 0.4 + i * 0.8
    o.boxes.push({ p: [ax, 2.95, z + d / 2 + 0.7], s: [0.8, 0.12, 1.4], c: i % 2 ? '#f4f1e8' : awn })
  }
  roofTop(o, x, z, w, d, h, seed)
}

// --- park ---------------------------------------------------------------------------

function park(o: Out, x0: number, z0: number, x1: number, z1: number) {
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  slab(o, x0, z0, x1, z1, 0.04, 0.06, K.grass)
  slab(o, cx - 1, z0, cx + 1, z1, 0.08, 0.04, K.pathway)
  slab(o, x0, cz - 1, x1, cz + 1, 0.08, 0.04, K.pathway)
  // fountain
  slab(o, cx - 2.8, cz - 2.8, cx + 2.8, cz + 2.8, 0.3, 0.5, K.stone)
  slab(o, cx - 2.3, cz - 2.3, cx + 2.3, cz + 2.3, 0.57, 0.1, K.water)
  o.boxes.push({ p: [cx, 1.1, cz], s: [0.7, 1.4, 0.7], c: K.stone })
  o.boxes.push({ p: [cx, 1.95, cz], s: [0.25, 0.4, 0.25], c: '#9fd3f2' })
  for (const [dx, dz, r] of [[-3.8, 0, Math.PI / 2], [3.8, 0, -Math.PI / 2], [0, 3.8, Math.PI], [0, -3.8, 0]] as const) bench(o, cx + dx, cz + dz, r)
  let s = 300
  for (const [dx, dz] of [[-7, -9], [7, -9], [-7, 9], [7, 9], [-8, -3], [8, 3], [0, -11], [0, 11]] as const) {
    if (cx + dx > x0 + 1 && cx + dx < x1 - 1) cityTree(o, cx + dx, cz + dz, s++)
  }
  for (let i = 0; i < 12; i++) {
    const fx = x0 + 1 + rand(i + 11) * (x1 - x0 - 2)
    const fz = z0 + 1 + rand(i * 5 + 3) * (z1 - z0 - 2)
    if (Math.abs(fx - cx) < 2 || Math.abs(fz - cz) < 2) continue
    o.boxes.push({ p: [fx, 0.3, fz], s: [0.2, 0.2, 0.2], c: ['#e04f5f', '#f2c230', '#c06bd8', '#ffffff'][i % 4]! })
  }
}

// --- layout -------------------------------------------------------------------------

export function buildCity(): Out {
  const o: Out = { boxes: [], lights: [], lit: [], dark: [] }

  road(o, true, ROAD_FRONT_Z, [ROAD_SIDE_X, -ROAD_SIDE_X])
  road(o, true, ROAD_BACK_Z, [ROAD_SIDE_X, -ROAD_SIDE_X])
  road(o, false, ROAD_SIDE_X, [ROAD_FRONT_Z, ROAD_BACK_Z])
  road(o, false, -ROAD_SIDE_X, [ROAD_FRONT_Z, ROAD_BACK_Z])
  // intersections: a slightly lighter patch, crosswalks on all four arms, a signal on the near corner
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const ix = sx * ROAD_SIDE_X
      const iz = sz * ROAD_FRONT_Z
      slab(o, ix - ROAD_W / 2, iz - ROAD_W / 2, ix + ROAD_W / 2, iz + ROAD_W / 2, 0.025, 0.05, K.asphaltLight)
      crosswalk(o, true, iz, ix - 6.2)
      crosswalk(o, true, iz, ix + 6.2)
      crosswalk(o, false, ix, iz - 6.2)
      crosswalk(o, false, ix, iz + 6.2)
      trafficLight(o, ix - sx * 5.2, iz - sz * 5.2)
    }

  // pavement furniture between the office and the front road
  let s = 10
  for (let x = -54; x <= 54; x += 9) {
    if (Math.abs(Math.abs(x) - ROAD_SIDE_X) < 7) continue
    streetLamp(o, x, 21.2, 0, 1)
    if (Math.abs(x) > 12) cityTree(o, x + 4.5, 21.5, s++)
  }
  for (let x = -18; x <= 18; x += 6) if (Math.abs(x) > 3) hedge(o, x, 17.6)
  // a little greenery around the office: a tree at each corner, a few side hedges, two flower beds
  s = 500
  for (const sx of [-1, 1]) {
    for (const z of [-12, 9]) hedgeSide(o, sx * 24.3, z)
    bigTree(o, sx * 24.8, 19.8, s++)
    bigTree(o, sx * 24.8, -20, s++)
    flowerBed(o, sx * 11, 19.4, 4.2, s++)
  }
  bench(o, -9, 21.6, Math.PI)
  bench(o, 9, 21.6, Math.PI)
  hydrant(o, -13, 22.3)
  busStop(o, 14, 33.8)
  for (let x = -54; x <= 54; x += 9) {
    if (Math.abs(Math.abs(x) - ROAD_SIDE_X) < 7) continue
    streetLamp(o, x + 4, 34.8, 0, -1)
  }
  for (const sx of [-1, 1]) for (let z = -18; z <= 18; z += 9) streetLamp(o, sx * 26.2, z, sx, 0)
  for (let x = -54; x <= 54; x += 9) {
    if (Math.abs(Math.abs(x) - ROAD_SIDE_X) < 7) continue
    streetLamp(o, x, -21.2, 0, -1)
  }

  // parked cars along the front road's curbs and the side roads
  const spots = [-48, -41, -17, -10, 4, 22, 46, 53]
  spots.forEach((x, i) => {
    if (Math.abs(Math.abs(x) - ROAD_SIDE_X) < 7) return
    car(o, x, ROAD_FRONT_Z - 3.3, 0, K.cars[i % K.cars.length]!)
    if (i % 2 === 0) car(o, x + 3, ROAD_FRONT_Z + 3.3, Math.PI, K.cars[(i + 3) % K.cars.length]!)
  })
  for (const [x, z, r] of [[ROAD_SIDE_X - 3.3, 6, Math.PI / 2], [ROAD_SIDE_X - 3.3, -12, Math.PI / 2], [-ROAD_SIDE_X + 3.3, 10, -Math.PI / 2], [-ROAD_SIDE_X + 3.3, -6, -Math.PI / 2]] as const)
    car(o, x, z, r, K.cars[Math.floor(rand(x * 3 + z) * K.cars.length)]!)

  // shops facing the front road with apartments behind them (kept low so the office stays in view)
  let seed = 100
  for (let x = -70; x < 72; ) {
    const w = 6 + Math.floor(rand(seed) * 3) * 1.5
    const cx = x + w / 2
    x += w + 0.6
    if (Math.abs(Math.abs(cx) - ROAD_SIDE_X) < ROAD_W / 2 + w / 2 + 1) continue
    shop(o, cx, 40.5, w, 8, 6 + Math.floor(rand(seed + 1) * 4) * 1.5, seed)
    tower(o, cx + (rand(seed + 2) - 0.5), 51, w + 1, 9, 10 + Math.floor(rand(seed + 3) * 6) * 2, seed + 7)
    seed++
  }

  // park on the right, then mid-rise towers beyond it
  park(o, 41, -15, 63, 19)
  for (let z = -20; z <= 22; z += 11) {
    if (Math.abs(z - ROAD_FRONT_Z) < 7) continue
    tower(o, 72, z, 8, 9, 9 + Math.floor(rand(z * 7) * 4) * 2, 200 + z)
  }
  for (let z = -40; z <= 36; z += 12) tower(o, 90, z, 9, 10, 18 + Math.floor(rand(z * 3 + 1) * 6) * 3, 250 + z)

  // left block: towers climbing away from the office
  for (let z = -22; z <= 22; z += 11) tower(o, -44, z, 8, 9, 14 + Math.floor(rand(z * 5) * 6) * 3, 300 + z)
  for (let z = -48; z <= 40; z += 12) tower(o, -64, z, 9, 10, 22 + Math.floor(rand(z) * 6) * 3, 340 + z)

  // behind the office: two rows of towers rising into a skyline
  seed = 400
  for (let x = -76; x <= 76; x += 11) {
    if (Math.abs(Math.abs(x) - ROAD_SIDE_X) < ROAD_W / 2 + 6) continue
    tower(o, x, -40, 9, 8, 16 + Math.floor(rand(seed) * 6) * 3, seed)
    tower(o, x + 4, -55, 10, 9, 26 + Math.floor(rand(seed + 1) * 8) * 3, seed + 1)
    seed += 2
  }
  return o
}

// --- rendering ----------------------------------------------------------------------

/**
 * Light from the street lamps at night: a wide soft pool on the ground, a brighter warm core
 * under the lamp, and a halo around the lamp head. All fade in with the night factor.
 */
function LampPools({ points }: { points: V3[] }) {
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)]
  const map = useMemo(glowTexture, [])
  const ground = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  const halo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const make = (color: string) =>
    new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const mats = useMemo(() => [make('#ffb95e'), make('#ffe2a8'), make('#ffd48a')], [map]) // eslint-disable-line react-hooks/exhaustive-deps
  const { camera } = useThree()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const sizes = [11, 4.5, 2.4]
    refs.forEach((r, k) => {
      const mesh = r.current
      if (!mesh) return
      points.forEach(([x, y, z], i) => {
        const pos = k === 2 ? new THREE.Vector3(x, y, z) : new THREE.Vector3(x, 0.115 + k * 0.002, z)
        q.copy(k === 2 ? camera.quaternion : new THREE.Quaternion())
        mesh.setMatrixAt(i, m.compose(pos, q, new THREE.Vector3(sizes[k]!, sizes[k]!, sizes[k]!)))
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [points, camera]) // eslint-disable-line react-hooks/exhaustive-deps
  const lastQ = useRef(new THREE.Quaternion(0, 0, 0, 0))
  useFrame(() => {
    // Halos are billboards: re-aim them whenever the camera turns (the user can orbit).
    const halos = refs[2]!.current
    if (halos && !lastQ.current.equals(camera.quaternion)) {
      lastQ.current.copy(camera.quaternion)
      const m = new THREE.Matrix4()
      points.forEach(([x, y, z], i) => halos.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), camera.quaternion, new THREE.Vector3(2.4, 2.4, 2.4))))
      halos.instanceMatrix.needsUpdate = true
    }
    const n = NIGHT.value
    const level = [0.55, 0.7, 0.9]
    refs.forEach((r, k) => {
      mats[k]!.opacity = n * level[k]!
      if (r.current) r.current.visible = n > 0.02
    })
  })
  return (
    <>
      {[0, 1, 2].map((k) => (
        <instancedMesh key={k} ref={refs[k]} args={[k === 2 ? halo : ground, mats[k], points.length]} renderOrder={2 + k} frustumCulled={false} />
      ))}
    </>
  )
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

const LANES = [
  { z: ROAD_FRONT_Z - 1.1, dir: 1, speed: 4.5, start: -30, color: K.cars[0]! },
  { z: ROAD_FRONT_Z - 1.1, dir: 1, speed: 4.5, start: 35, color: K.cars[3]! },
  { z: ROAD_FRONT_Z + 1.1, dir: -1, speed: 5.5, start: 10, color: K.cars[1]! },
]

/** Cars driving along the front road, one per lane slot (parked still when motion is reduced). */
function Traffic({ reducedMotion }: { reducedMotion: boolean }) {
  const cars = useRef<(THREE.Group | null)[]>([])
  const x = useRef(LANES.map((l) => l.start))
  useFrame((_, dt) => {
    LANES.forEach((l, i) => {
      if (!reducedMotion) x.current[i] = ((x.current[i]! + l.dir * l.speed * Math.min(dt, 0.1) + 270) % 180) - 90
      cars.current[i]?.position.set(x.current[i]!, 0, l.z)
    })
  })
  return (
    <group>
      {LANES.map((l, i) => (
        <group key={i} ref={(g) => void (cars.current[i] = g)} rotation={[0, l.dir === 1 ? 0 : Math.PI, 0]} position={[l.start, 0, l.z]}>
          <B p={[0, 0.5, 0]} s={[2.3, 0.55, 1.1]} c={l.color} cast />
          <B p={[-0.1, 1.0, 0]} s={[1.2, 0.5, 0.96]} c={K.glassCar} cast />
          <B p={[-0.1, 1.27, 0]} s={[1.1, 0.06, 0.9]} c={l.color} />
          {([-0.75, 0.75] as const).flatMap((dx) => ([-0.5, 0.5] as const).map((dz) => <B key={`${dx}${dz}`} p={[dx, 0.22, dz]} s={[0.45, 0.45, 0.14]} c={K.wheel} />))}
          <B p={[1.16, 0.5, 0.35]} s={[0.04, 0.12, 0.2]} c="#fff1c9" />
          <B p={[1.16, 0.5, -0.35]} s={[0.04, 0.12, 0.2]} c="#fff1c9" />
        </group>
      ))}
    </group>
  )
}

export function City({ reducedMotion }: { reducedMotion: boolean }) {
  const { boxes, lanterns, lit, dark, pools } = useMemo(() => {
    const c = buildCity()
    return {
      boxes: c.boxes,
      lanterns: c.lights.map((p): Box => ({ p, s: p[1] < 6 ? [0.6, 0.14, 0.6] : [0.3, 0.14, 0.3], c: '' })),
      pools: c.lights.filter((p) => p[1] < 6),
      lit: c.lit,
      dark: c.dark,
    }
  }, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), [])
  return (
    <group>
      {useInstanced(boxes, material)}
      {useInstanced(lit, litWindow, false)}
      {useInstanced(dark, darkWindow, false)}
      {useInstanced(lanterns, GLOW.lamp, false)}
      <LampPools points={pools} />
      <Traffic reducedMotion={reducedMotion} />
    </group>
  )
}
