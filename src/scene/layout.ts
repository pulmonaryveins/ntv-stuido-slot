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
/** Path from the hub to the kitchen, passing left of the workstation pods. */
export const KITCHEN_ROUTE: XZ[] = [HUB, [-4, -4], [-7, -8.6]]
/** Meeting room in the front-right corner (glass walls on its back and left sides). */
export const MEETING: XZ = [11.5, 10.2]
export const MEETING_ROOM = { x0: 8, x1: ROOM_X, z0: 6.5, z1: ROOM_FRONT, gap0: 6.8, gap1: 11.2 }
/** Long collaboration table at the front edge, between the lounge and the meeting room. */
export const COLLAB: XZ = [1, 10.8]
/** Render farm: server racks in a glass room in the back-right corner. */
export const RACKS: XZ = [12.9, -12]

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
/** Arcade machines in a row along the right edge, screens facing into the room (-x). */
export const ARCADES: XZ[] = [
  [14.2, -5],
  [14.2, -3.4],
  [14.2, -1.8],
]
export const PINGPONG: XZ = [10.2, 1.6]
export const BEANBAGS: XZ[] = [[-12.4, 11.6], [-10, 11.9]]

const W = -Math.PI / 2 // facing -x
const E = Math.PI / 2 // facing +x

const sofa = (z: number): LoungeSpot => ({ pos: [SOFA_X, z], facing: W, pose: 'sit', activity: 'tv', seatY: 0.5 })
const arcade = (p: XZ): LoungeSpot => ({ pos: [p[0] - 0.95, p[1]], facing: E, pose: 'stand', activity: 'game', seatY: 0 })
const bean = (p: XZ): LoungeSpot => ({ pos: p, facing: 0, pose: 'beanbag', activity: 'chill', seatY: 0.32 })

export const LOUNGE_SPOTS: LoungeSpot[] = [
  sofa(6),
  arcade(ARCADES[0]!),
  bean(BEANBAGS[0]!),
  { pos: [PINGPONG[0] - 1.7, PINGPONG[1]], facing: E, pose: 'stand', activity: 'pingpong', seatY: 0 },
  sofa(7),
  { pos: [PINGPONG[0] + 1.7, PINGPONG[1]], facing: W, pose: 'stand', activity: 'pingpong', seatY: 0 },
  arcade(ARCADES[1]!),
  bean(BEANBAGS[1]!),
  sofa(8),
  arcade(ARCADES[2]!),
]

export function loungeSpot(queueIndex: number): LoungeSpot {
  return LOUNGE_SPOTS[queueIndex % LOUNGE_SPOTS.length]!
}

/** Building index 0 = left (first account), 1 = right. */
export function buildingX(index: number) {
  // Both pods sit side by side against the back wall, between the kitchen and the render farm.
  return index === 0 ? -2 : 6.5
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
export const CUBE_BACK = -12.0
// Snapped to the 0.5-unit voxel grid so the carpet tiles line up with the partitions.
export const CUBE_FRONT = -9
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

export type IdleActivity = LoungeActivity | 'meeting' | 'collab' | 'racks' | 'roam'

/** One thing an idle user can be doing: a lounge activity, a table, the racks or just wandering. */
export interface IdleSpot {
  pos: XZ
  facing: number
  activity: IdleActivity
  pose: LoungePose
  seatY: number
  /** Way points from the hub (the aisle between the pods leads to the back of the room). */
  route: XZ[]
}

const viaAisle = (p: XZ): XZ[] => [HUB, p]
const viaMeetingDoor = (p: XZ): XZ[] => [HUB, [6.6, 9], [8.6, 9], p]
const faceTo = (from: XZ, to: XZ) => Math.atan2(to[0] - from[0], to[1] - from[1])
const around = (c: XZ, dx: number, dz: number, activity: IdleActivity, back: boolean): IdleSpot => {
  const pos: XZ = [c[0] + dx, c[1] + dz]
  // Meeting room: enter through its door; render farm: go round the front of the pods.
  const route: XZ[] =
    activity === 'meeting' ? viaMeetingDoor(pos) : activity === 'racks' ? [HUB, [11.2, -7], pos] : back ? viaAisle(pos) : [HUB, pos]
  return { pos, facing: faceTo(pos, c), activity, pose: 'stand', seatY: 0, route }
}
const fromLounge = (l: LoungeSpot): IdleSpot => ({ ...l, route: [HUB, l.pos] })
const roam = (pos: XZ, facing: number): IdleSpot => ({ pos, facing, activity: 'roam', pose: 'stand', seatY: 0, route: [HUB, pos] })

/** First LOUNGE_SPOTS.length entries mirror the lounge, so index i < that is lounge spot i. */
export const IDLE_SPOTS: IdleSpot[] = [
  ...LOUNGE_SPOTS.map(fromLounge),
  around(COLLAB, -1.8, -1.4, 'collab', false),
  around(COLLAB, 1.8, 1.4, 'collab', false),
  around(COLLAB, 0, -1.4, 'collab', false),
  around(MEETING, -2, 0, 'meeting', true),
  around(MEETING, 2, 0, 'meeting', true),
  around(MEETING, 0, 2, 'meeting', true),
  around(RACKS, 0, 1.9, 'racks', true),
  around(RACKS, -2.2, 1.9, 'racks', true),
  roam([-4, 6.5], 0.6),
  roam([4.5, 6.5], -0.8),
  roam([-5, 9.5], 2.2),
  roam([5, 9.5], -2.2),
  roam([0, 6.8], 0),
  roam([-7.5, 2.8], 1.4),
  roam([7.5, 2.4], -1.4),
  roam([-4.8, 12.3], 3),
  roam([5.8, 12.6], 3.4),
]

export function idleSpot(choice: number): IdleSpot {
  return IDLE_SPOTS[choice % IDLE_SPOTS.length]!
}
