import { rand } from './kit'
import { CUBE_BACK, CUBE_FRONT, CUBE_W, DOOR_Z, RACKS, ROOM_BACK, ROOM_FRONT, ROOM_X, buildingX } from './layout'
import { VoxelWorld, cell, type BlockType } from './voxel'

const WALL_H = 11 // blocks (5.5 units)
const BAY = 8 // blocks between steel columns
const WINDOW_J0 = 3 // window rows: 1.5 to 4.5 units
const WINDOW_J1 = 8

/** Static blocky office: floor slab, back + left walls with windows and a door, server racks. */
export function buildWorld(): VoxelWorld {
  const w = new VoxelWorld()
  room(w)
  for (let b = 0; b < 2; b++) pod(w, b)
  serverRacks(w)
  return w
}

function room(w: VoxelWorld) {
  const i0 = cell(-ROOM_X)
  const i1 = cell(ROOM_X - 0.01)
  const k0 = cell(ROOM_BACK)
  const k1 = cell(ROOM_FRONT - 0.01)

  // Floor slab: office carpet tiles (2 units square, two shades) with a steel trim, concrete underneath (the diorama base).
  for (let i = i0; i <= i1; i++)
    for (let k = k0; k <= k1; k++) {
      const edge = i === i1 || k === k1
      w.set(i, -1, k, edge ? 'metal' : ((i >> 2) + (k >> 2)) % 2 === 0 ? 'carpetC' : 'carpetD')
      w.set(i, -2, k, 'concrete')
      w.set(i, -3, k, rand(i * 7 + k) < 0.2 ? 'stone' : 'concrete')
    }

  // Back wall (k0 - 1) and left wall (i0 - 1): cool grey plinth, off-white walls, a steel fascia.
  const wallBlock = (j: number): BlockType => (j < 2 ? 'plinth' : j < WALL_H - 1 ? 'wall' : 'metal')
  const backK = k0 - 1
  const leftI = i0 - 1
  for (let j = -3; j < WALL_H; j++) {
    const block = j < 0 ? 'concrete' : wallBlock(j)
    for (let i = leftI; i <= i1; i++) w.set(i, j, backK, block)
    for (let k = backK; k <= k1; k++) w.set(leftI, j, k, block)
  }

  // Steel columns every BAY blocks, and at the corners. Each bay between two columns either
  // holds one window or stays solid wall (for fixtures and the door).
  for (let j = 0; j < WALL_H; j++) {
    for (let i = leftI; i <= i1; i += BAY) w.set(i, j, backK, 'metal')
    for (let k = backK; k <= k1; k += BAY) w.set(leftI, j, k, 'metal')
    w.set(i1, j, backK, 'metal')
    w.set(leftI, j, k1, 'metal')
  }

  // Windows: one per bay, same size and height, centred mullion, steel sill. The bay is named by
  // the column cell on its low side. Solid bays: the kitchen, the server room, the meeting room
  // (back wall); the door, the posters and the TV (left wall).
  for (const c of [-25, -17, 7, 15]) window(w, c, backK, 'back')
  for (const c of [-25, -17, -9, 23]) window(w, c, leftI, 'left')

  featureWalls(w, backK, leftI)

  // Door opening in the left wall with a steel frame.
  const dk = cell(DOOR_Z)
  w.fill(leftI, leftI, 0, 4, dk - 1, dk + 1, 'metal')
  for (let j = 0; j < 4; j++) for (let k = dk - 1; k <= dk; k++) w.delete(leftI, j, k)
}

/** One window filling the bay that starts after column `c` (cell index along the wall). */
function window(w: VoxelWorld, c: number, wall: number, side: 'back' | 'left') {
  const set = (n: number, j: number, type: BlockType) => (side === 'back' ? w.set(n, j, wall, type) : w.set(wall, j, n, type))
  for (let n = c + 1; n < c + BAY; n++) {
    set(n, WINDOW_J0 - 1, 'metal') // sill
    for (let j = WINDOW_J0; j <= WINDOW_J1; j++) set(n, j, n === c + BAY / 2 ? 'metal' : 'glass')
  }
}

/** Teal feature bays (behind the server room and the TV lounge) and a steel kitchen splashback. */
function featureWalls(w: VoxelWorld, backK: number, leftI: number) {
  const paint = (i: number, j: number, k: number, type: BlockType) => {
    if (w.get(i, j, k) === 'wall') w.set(i, j, k, type)
  }
  const bay = (c: number, fn: (n: number) => void) => {
    for (let n = c + 1; n < c + BAY; n++) fn(n)
  }
  for (const c of [-9, -1]) bay(c, (i) => { for (let j = 2; j < WALL_H - 1; j++) paint(i, j, backK, 'tealDark') })
  for (const c of [-41, -33]) bay(c, (i) => { for (let j = 2; j < 6; j++) paint(i, j, backK, 'metal') })
  bay(15, (k) => { for (let j = 2; j < WALL_H - 1; j++) paint(leftI, j, k, 'tealDark') })
}

/** Carpet under one cubicle pod, exactly the pod's footprint, laid as alternating tiles. */
function pod(w: VoxelWorld, index: number) {
  const bx = buildingX(index)
  const i0 = cell(bx - CUBE_W)
  const i1 = cell(bx + CUBE_W - 0.01)
  const k0 = cell(CUBE_BACK)
  const k1 = cell(CUBE_FRONT - 0.01)
  for (let i = i0; i <= i1; i++)
    for (let k = k0; k <= k1; k++) w.set(i, -1, k, (i + k) % 2 === 0 ? 'carpetA' : 'carpetB')
}

/** Render farm: a row of server racks against the back wall (LEDs, vapor and fans are live meshes). */
function serverRacks(w: VoxelWorld) {
  const [rx, rz] = RACKS
  const i0 = cell(rx - 2)
  const i1 = cell(rx + 2 - 0.01)
  const k0 = cell(rz - 0.5)
  const k1 = cell(rz + 0.5 - 0.01)
  w.fill(i0 - 1, i1 + 1, -1, -1, k0, k1 + 1, 'stone')
  w.fill(i0, i1, 0, 5, k0, k1, 'rack')
  w.fill(i0, i1, 6, 6, k0, k1, 'metal')
}
