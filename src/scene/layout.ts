import type { Slot } from '../data'

export type XZ = [number, number]

/** Office floor: x in [-ROOM_X, ROOM_X], z in [ROOM_BACK, ROOM_FRONT]. Walls on the back (-z) and left (-x). */
export const ROOM_X = 15
export const ROOM_BACK = -12.5
export const ROOM_FRONT = 13.5
export const HUB: XZ = [0, 4.2]
/** Door in the left wall; avatars enter and leave through it. */
export const DOOR_Z = 11.5
export const EXIT: XZ = [-ROOM_X + 0.5, DOOR_Z]
export const CART: XZ = [5.2, 6.2]
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

export const TV_POS: XZ = [-14.9, 6.4]
export const SOFA_X = -10.6
export const ARCADE_Z = 1.6
export const ARCADE_X = [10.2, 11.6]
export const PINGPONG: XZ = [6.2, 10.4]
export const BEANBAGS: XZ[] = [[1.4, 11.6], [-2.2, 11.9]]

const W = -Math.PI / 2 // facing -x
const E = Math.PI / 2 // facing +x
const N = Math.PI // facing -z

const sofa = (z: number): LoungeSpot => ({ pos: [SOFA_X, z], facing: W, pose: 'sit', activity: 'tv', seatY: 0.5 })
const arcade = (x: number): LoungeSpot => ({ pos: [x, ARCADE_Z + 0.95], facing: N, pose: 'stand', activity: 'game', seatY: 0 })
const bean = (p: XZ): LoungeSpot => ({ pos: p, facing: 0, pose: 'beanbag', activity: 'chill', seatY: 0.32 })

export const LOUNGE_SPOTS: LoungeSpot[] = [
  sofa(5.6),
  arcade(ARCADE_X[0]!),
  bean(BEANBAGS[0]!),
  { pos: [PINGPONG[0] - 1.7, PINGPONG[1]], facing: E, pose: 'stand', activity: 'pingpong', seatY: 0 },
  sofa(6.6),
  { pos: [PINGPONG[0] + 1.7, PINGPONG[1]], facing: W, pose: 'stand', activity: 'pingpong', seatY: 0 },
  arcade(ARCADE_X[1]!),
  bean(BEANBAGS[1]!),
  sofa(7.6),
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
export function deskSpots(slots: Slot[], accountIds: number[]): Map<number, DeskSpot> {
  const map = new Map<number, DeskSpot>()
  for (const s of slots) {
    const building = Math.max(0, Math.min(1, accountIds.indexOf(s.account_id)))
    const bx = buildingX(building)
    const side = s.slot_number % 2 === 1 ? -1 : 1
    const dx = bx + side * 1.9
    const desk: XZ = [dx, -3.4]
    const chair: XZ = [dx, -4.55]
    const aisle = bx + side * 3.25
    map.set(s.id, {
      slotId: s.id,
      building,
      side,
      desk,
      chair,
      knock: [dx, -2.15],
      route: [HUB, [bx, -0.6], [aisle, -2.2], [aisle, -4.55], chair],
    })
  }
  return map
}


export function cartSpot(index: number): XZ {
  const a = 2.4 + index * 0.7
  return [CART[0] + Math.cos(a) * 1.5, CART[1] + Math.sin(a) * 1.5]
}
