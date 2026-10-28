import { rand } from './kit'
import { BUILDING_D, BUILDING_W, BUILDING_Z, ISLAND_RADIUS, TOWER, buildingX } from './layout'
import { S, VoxelWorld, cell, type BlockType } from './voxel'

/** Tree spots (world x, z) around the island edge. */
export const TREES: [number, number][] = [
  [-12, 0.5], [-11.5, -5], [11.6, 1], [12, -4.5], [-6, 10], [6.6, 10.5], [-3.2, 11.5],
  [3, 11.8], [-12.4, 3.5], [8, -9.6], [-8.4, -9.4], [11, 9], [-4, 7.6],
]
const BUSHES: [number, number][] = [
  [-2.2, 1.0], [2.2, 1.0], [-4.6, 9.4], [1.8, 9.6], [9.8, -1.2], [-9.8, -1.2], [-1.8, 12.2],
  [6.5, 2.6], [-6.6, 2.4], [10.6, 3.6], [-3.4, -8.4], [3.6, -8.2], [7.8, 8.6], [-11, 8],
]

const centre = (n: number) => (n + 0.5) * S

/** Static blocky world: floating island, plaza, two studios, render tower, trees. */
export function buildWorld(buildingCount: number): VoxelWorld {
  const w = new VoxelWorld()
  island(w)
  for (let b = 0; b < Math.min(buildingCount, 2); b++) studio(w, b)
  tower(w)
  TREES.forEach(([x, z], n) => tree(w, cell(x), cell(z), n))
  BUSHES.forEach(([x, z], n) => bush(w, cell(x), cell(z), n))
  return w
}

function island(w: VoxelWorld) {
  const R = Math.round(ISLAND_RADIUS / S)
  for (let i = -R; i <= R; i++) {
    for (let k = -R; k <= R; k++) {
      const d = Math.hypot(i + 0.5, k + 0.5) + (rand(i * 131 + k * 7) - 0.5) * 1.6
      if (d > R) continue
      const x = centre(i)
      const z = centre(k)
      const plaza = (x / 4.6) ** 2 + ((z - 3.6) / 3.1) ** 2 <= 1
      const path = Math.abs(x) <= 0.75 && z > 5 && z < R * S - 0.6
      w.set(i, -1, k, plaza || path ? 'cobble' : 'grass')
      w.set(i, -2, k, 'dirt')
      w.set(i, -3, k, rand(i * 3 + k) < 0.15 ? 'stone' : 'dirt')
      // Stepped underside: deeper toward the centre.
      const depth = 4 + Math.floor((R - d) * 0.55)
      for (let j = -4; j >= -depth; j--) w.set(i, j, k, j < -10 && rand(i + k * 9 + j) < 0.5 ? 'rock' : 'stone')
    }
  }
  // A few floating rock chunks under the edge.
  for (let n = 0; n < 7; n++) {
    const a = (n / 7) * Math.PI * 2 + 0.4
    const ci = Math.round((Math.cos(a) * (R + 3)) | 0)
    const ck = Math.round((Math.sin(a) * (R + 3)) | 0)
    const cj = -8 - Math.floor(rand(n) * 6)
    const size = 1 + Math.floor(rand(n + 20) * 2)
    w.fill(ci - size, ci + size, cj - size, cj + size, ck - size, ck + size, 'rock')
  }
}

function studio(w: VoxelWorld, index: number) {
  const bx = buildingX(index)
  const outer = index === 0 ? -1 : 1
  const i0 = cell(bx - BUILDING_W / 2)
  const i1 = cell(bx + BUILDING_W / 2 - 0.01)
  const k0 = cell(BUILDING_Z - BUILDING_D / 2)
  const k1 = cell(BUILDING_Z + BUILDING_D / 2 - 0.01)
  const sideI = outer < 0 ? i0 : i1
  const innerI = outer < 0 ? i1 : i0
  const H = 7 // wall height in blocks (3.5 units)

  // plank floor flush with the ground, darker border
  for (let i = i0; i <= i1; i++)
    for (let k = k0; k <= k1; k++) w.set(i, -1, k, i === i0 || i === i1 || k === k0 || k === k1 ? 'planksDark' : 'planks')

  // back wall + outer side wall: brick base, plaster top, beam, windows
  const wallBlock = (j: number): BlockType => (j < 3 ? 'brick' : j < H - 1 ? 'plaster' : 'planksDark')
  for (let j = 0; j < H; j++) {
    for (let i = i0; i <= i1; i++) w.set(i, j, k0, wallBlock(j))
    for (let k = k0; k <= k1; k++) w.set(sideI, j, k, wallBlock(j))
  }
  // windows (2x2 glass) in the back wall and the side wall
  for (const off of [3, 7, 11]) w.fill(i0 + off, i0 + off + 1, 3, 4, k0, k0, 'glass')
  w.fill(sideI, sideI, 3, 4, k0 + 5, k0 + 7, 'glass')
  // corner posts at the open front
  w.fill(innerI, innerI, 0, H - 1, k1, k1, 'log')
  w.fill(sideI, sideI, 0, H - 1, k1, k1, 'log')
  // teal awning above the back wall
  for (let i = i0; i <= i1; i++) w.set(i, H, k0 + 1, 'teal')
  // shelf + plant inside, by the inner back corner
  const shelfI = innerI - outer * 1
  w.fill(shelfI - 1, shelfI, 0, 1, k0 + 1, k0 + 1, 'planksDark')
  w.set(shelfI, 2, k0 + 1, 'leaves')
}

function tower(w: VoxelWorld) {
  const [tx, tz] = TOWER
  const i0 = cell(tx - 1.5)
  const i1 = cell(tx + 1.5 - 0.01)
  const k0 = cell(tz - 1.5)
  const k1 = cell(tz + 1.5 - 0.01)
  w.fill(i0 - 1, i1 + 1, 0, 0, k0 - 1, k1 + 1, 'stone')
  w.fill(i0, i1, 1, 8, k0, k1, 'brick')
  w.fill(i0 - 1, i1 + 1, 9, 9, k0 - 1, k1 + 1, 'planksDark')
  w.fill(i0, i1, 10, 13, k0, k1, 'plaster')
  w.fill(i0 + 1, i0 + 2, 11, 12, k1, k1, 'glass')
  w.fill(i1 - 2, i1 - 1, 11, 12, k1, k1, 'glass')
  w.fill(i0 - 1, i1 + 1, 14, 14, k0 - 1, k1 + 1, 'tealDark')
  // stepped roof
  for (let step = 0; step < 3; step++) w.fill(i0 + step, i1 - step, 15 + step, 15 + step, k0 + step, k1 - step, 'teal')
  // chimney (smoke rises from its top, see RenderFarm CHIMNEY_TOP)
  w.fill(i1, i1, 15, 19, k0 + 1, k0 + 1, 'brick')
  // generator + tank blocks beside the tower
  w.fill(i1 + 2, i1 + 3, 0, 1, k0 + 2, k0 + 4, 'tealDark')
  w.fill(i0 - 4, i0 - 3, 0, 2, k0 + 3, k0 + 4, 'stone')
  w.fill(i0 - 4, i0 - 3, 3, 3, k0 + 3, k0 + 4, 'amber')
}

function tree(w: VoxelWorld, i: number, k: number, seed: number) {
  const h = 3 + Math.floor(rand(seed) * 3)
  for (let j = 0; j < h; j++) w.set(i, j, k, 'log')
  const r = seed % 3 === 0 ? 1 : 2
  for (let a = -r; a <= r; a++)
    for (let b = -r; b <= r; b++)
      for (let c = 0; c <= r + 1; c++) {
        const corner = Math.abs(a) === r && Math.abs(b) === r
        if (corner && rand(seed * 31 + a * 7 + b * 3 + c) < 0.7) continue
        if (c === r + 1 && (Math.abs(a) === r || Math.abs(b) === r)) continue
        w.set(i + a, h - 1 + c, k + b, 'leaves')
      }
}

function bush(w: VoxelWorld, i: number, k: number, seed: number) {
  w.fill(i, i + (seed % 2), 0, 0, k, k + 1, 'leaves')
  if (seed % 3 === 0) w.set(i, 1, k, 'leaves')
}

/** A flat blocky cloud as its own small world (it drifts as a group). */
export function cloudWorld(seed: number): VoxelWorld {
  const w = new VoxelWorld()
  const blobs = 2 + Math.floor(rand(seed) * 3)
  for (let n = 0; n < blobs; n++) {
    const ci = Math.floor((rand(seed * 7 + n) - 0.5) * 10)
    const ck = Math.floor((rand(seed * 11 + n) - 0.5) * 6)
    const wi = 3 + Math.floor(rand(seed * 13 + n) * 4)
    const wk = 2 + Math.floor(rand(seed * 17 + n) * 3)
    w.fill(ci - wi, ci + wi, 0, n === 0 ? 1 : 0, ck - wk, ck + wk, 'cloud')
  }
  return w
}
