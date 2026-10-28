import type { Slot } from '../data'

export type XZ = [number, number]

/** Office floor: x in [-ROOM_X, ROOM_X], z in [ROOM_BACK, ROOM_FRONT]. Walls on the back (-z) and left (-x). */
export const ROOM_X = 15
export const ROOM_BACK = -12.5
export const ROOM_FRONT = 13.5
export const HUB: XZ = [0, 4.2]
/** Door in the left wall; avatars enter and leave through it. */
export const DOOR_Z = 1.5
export const EXIT: XZ = [-ROOM_X + 0.5, DOOR_Z]
/** Kitchen counter (coffee) against the back wall, back-left corner. Breaks happen here. */
export const KITCHEN: XZ = [-10.6, -12.05]
/** Path from the hub to the kitchen through the centre aisle between the cubicle pods. */
export const KITCHEN_ROUTE: XZ[] = [HUB, [0, -1.6], [0, -8.6], [-6, -9.6]]
/** Meeting corner (round table) in the back-right. */
export const MEETING: XZ = [10.6, -9.2]
/** Long collaboration table at the front centre. */
export const COLLAB: XZ = [0, 9.8]
/** Server-rack corner (render farm) centred against the back wall. */
export const RACKS: XZ = [0, -12]

export type LoungePose = 'sit' | 'beanbag' | 'stand'
export type LoungeActivity = 'tv' | 'game' | 'chill' | 'pingpong'

/** Where waiting users hang out, in the order queue positions take them. */
export interface LoungeSpot {
  pos: XZ
  /** Facing angle (atan2(dx, dz) convention used by avatars). */
  facing: number
  pose: LoungePose
  activity: LoungeActivity
  /** Seat height for sitting poses. */
  seatY: number
}

export const TV_POS: XZ = [-14.9, 7]
export const SOFA_X = -10.6
export const ARCADE_Z = 4.4
export const ARCADE_X = [9.4, 10.8, 12.2]
export const PINGPONG: XZ = [10.8, 10]
export const BEANBAGS: XZ[] = [[-12.4, 11.6], [-10, 11.9]]

const W = -Math.PI / 2 // facing -x
const E = Math.PI / 2 // facing +x
const N = Math.PI // facing -z

const sofa = (z: number): LoungeSpot => ({ pos: [SOFA_X, z], facing: W, pose: 'sit', activity: 'tv', seatY: 0.5 })
const arcade = (x: number): LoungeSpot => ({ pos: [x, ARCADE_Z + 0.95], facing: N, pose: 'stand', activity: 'game', seatY: 0 })
const bean = (p: XZ): LoungeSpot => ({ pos: p, facing: 0, pose: 'beanbag', activity: 'chill', seatY: 0.32 })

export const LOUNGE_SPOTS: LoungeSpot[] = [
  sofa(6),
  arcade(ARCADE_X[0]!),
  bean(BEANBAGS[0]!),
  { pos: [PINGPONG[0] - 1.7, PINGPONG[1]], facing: E, pose: 'stand', activity: 'pingpong', seatY: 0 },
  sofa(7),
  { pos: [PINGPONG[0] + 1.7, PINGPONG[1]], facing: W, pose: 'stand', activity: 'pingpong', seatY: 0 },
  arcade(ARCADE_X[1]!),
  bean(BEANBAGS[1]!),
  sofa(8),
  arcade(ARCADE_X[2]!),
]

export function loungeSpot(queueIndex: number): LoungeSpot {
  return LOUNGE_SPOTS[queueIndex % LOUNGE_SPOTS.length]!
}

/** Building index 0 = left (first account), 1 = right. */
export function buildingX(index: number) {
  return index === 0 ? -6 : 6
}
// Grid-aligned to the 0.5-unit voxels: floor spans z in [-6.5, 0].
export const BUILDING_Z = -3.25
export const BUILDING_W = 8
export const BUILDING_D = 6.5

export interface DeskSpot {
  slotId: number
  building: number
  /** -1 = desk on the building's left, +1 = right. */
  side: number
  desk: XZ
  chair: XZ
  knock: XZ
  route: XZ[]
}

/** Desk placement for each slot, derived from account order and slot number. */
/** Cubicle geometry: back panel along z = CUBE_BACK, open toward +z (the camera). */
export const CUBE_BACK = -6.0
// Snapped to the 0.5-unit voxel grid so the carpet tiles line up with the partitions.
export const CUBE_FRONT = -3
export const CUBE_W = 4

export function deskSpots(slots: Slot[], accountIds: number[]): Map<number, DeskSpot> {
  const map = new Map<number, DeskSpot>()
  for (const s of slots) {
    const building = Math.max(0, Math.min(1, accountIds.indexOf(s.account_id)))
    const bx = buildingX(building)
    const side = s.slot_number % 2 === 1 ? -1 : 1
    const dx = bx + side * (CUBE_W / 2)
    // Work surface against the back panel; the user sits facing it (back to the camera).
    const desk: XZ = [dx, CUBE_BACK + 0.5]
    const chair: XZ = [dx, CUBE_BACK + 1.5]
    map.set(s.id, {
      slotId: s.id,
      building,
      side,
      desk,
      chair,
      knock: [dx, CUBE_FRONT + 0.5],
      route: [HUB, [dx, CUBE_FRONT + 1.6], chair],
    })
  }
  return map
}


/** Where people on break stand, along the kitchen counter (they face it). */
export function cartSpot(index: number): XZ {
  return [KITCHEN[0] - 2.2 + (index % 4) * 1.3, KITCHEN[1] + 1.55]
}
