import { rand } from './kit'
import { CUBE_BACK, CUBE_FRONT, CUBE_W, DOOR_Z, RACKS, ROOM_BACK, ROOM_FRONT, ROOM_X, buildingX } from './layout'
import { VoxelWorld, cell, type BlockType } from './voxel'

const WALL_H = 11 // blocks (5.5 units)

/** Static blocky office: floor slab, back + left walls with windows and a door, cubicle carpets, server racks. */
export function buildWorld(buildingCount: number): VoxelWorld {
  const w = new VoxelWorld()
  room(w)
  for (let b = 0; b < Math.min(buildingCount, 2); b++) studio(w, b)
  serverRacks(w)
  return w
}

function room(w: VoxelWorld) {
  const i0 = cell(-ROOM_X)
  const i1 = cell(ROOM_X - 0.01)
  const k0 = cell(ROOM_BACK)
  const k1 = cell(ROOM_FRONT - 0.01)

  // Floor slab: oak planks with a dark trim, concrete underneath (the diorama base).
  for (let i = i0; i <= i1; i++)
    for (let k = k0; k <= k1; k++) {
      const edge = i === i1 || k === k1
      w.set(i, -1, k, edge ? 'planksDark' : 'oak')
      w.set(i, -2, k, 'concrete')
      w.set(i, -3, k, rand(i * 7 + k) < 0.2 ? 'stone' : 'concrete')
    }

  // Back wall (k0 - 1) and left wall (i0 - 1): brick base, plaster, dark trim on top.
  const wallBlock = (j: number): BlockType => (j < 3 ? 'brick' : j < WALL_H - 1 ? 'plaster' : 'planksDark')
  const backK = k0 - 1
  const leftI = i0 - 1
  for (let j = -3; j < WALL_H; j++) {
    const block = j < 0 ? 'concrete' : wallBlock(j)
    for (let i = leftI; i <= i1; i++) w.set(i, j, backK, block)
    for (let k = backK; k <= k1; k++) w.set(leftI, j, k, block)
  }

  // High loft windows (above the studio rooms) on the back wall, tall ones on the left wall.
  for (const [a, b] of [[-26, -19], [-14, -9], [9, 14], [19, 26]] as const) w.fill(a, b, 6, 9, backK, backK, 'glass')
  for (const [a, b] of [[-22, -16], [-10, -4]] as const) w.fill(leftI, leftI, 4, 8, a, b, 'glass')

  // Door opening in the left wall with a dark frame.
  const dk = cell(DOOR_Z)
  w.fill(leftI, leftI, 0, 4, dk - 1, dk + 1, 'planksDark')
  for (let j = 0; j < 4; j++) for (let k = dk - 1; k <= dk; k++) w.delete(leftI, j, k)
}

/**
 * Carpet under one cubicle pod, exactly the pod's footprint (both cubicles, back panel to the
 * open front), laid as alternating carpet tiles. The account colour lives on the partitions.
 */
function studio(w: VoxelWorld, index: number) {
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
  w.fill(i0, i1, 6, 6, k0, k1, 'concrete')
  // cable tray up the wall
  w.fill(i0, i1, 9, 9, k0 - 0, k0, 'concrete')
}
