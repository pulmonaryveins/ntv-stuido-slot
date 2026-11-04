import type { Slot } from '../data'

export type XZ = [number, number]

/** Office floor: x in [-ROOM_X, ROOM_X], z in [ROOM_BACK, ROOM_FRONT]. Walls on the back (-z) and left (-x). */
export const ROOM_X = 20
export const ROOM_BACK = -16
export const ROOM_FRONT = 16
export const HUB: XZ = [0, 5]
/** Door in the left wall; avatars enter and leave through it. */
export const DOOR_Z = 1.5
export const EXIT: XZ = [-ROOM_X + 0.5, DOOR_Z]
/** Kitchen counter (coffee) against the back wall, back-left corner. Breaks happen here. */
export const KITCHEN: XZ = [-15, -15.55]
/** Path from the hub to the kitchen, down the aisle left of the workstation pods. */
export const KITCHEN_ROUTE: XZ[] = [HUB, [-11, 0], [-11, -12]]
/** Meeting room in the back-right corner: glass on its front and left sides, door on the left. */
export const MEETING: XZ = [15, -12.5]
export const MEETING_ROOM = { x0: 10, x1: ROOM_X, z0: ROOM_BACK, z1: -9, gap0: -12.4, gap1: -9.4 }
/** Long collaboration table at the front centre. */
export const COLLAB: XZ = [0, 12.5]
/** Render farm: server racks in a glass room centred on the back wall. */
export const RACKS: XZ = [0, -15.5]
/** Supplies corner on the right edge: printer and shelves. */
export const SUPPLIES: XZ = [19.2, -3]

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

export const TV_POS: XZ = [-ROOM_X + 0.1, 10]
export const SOFA_X = -15.6
/** Arcade machines in a row along the right edge, screens facing into the room (-x). */
export const ARCADES: XZ[] = [
  [ROOM_X - 0.8, 7],
  [ROOM_X - 0.8, 8.6],
  [ROOM_X - 0.8, 10.2],
]
export const PINGPONG: XZ = [14.5, 12.8]
export const BEANBAGS: XZ[] = [[-17.4, 14.4], [-15, 14.8]]

const W = -Math.PI / 2 // facing -x
const E = Math.PI / 2 // facing +x

const sofa = (z: number): LoungeSpot => ({ pos: [SOFA_X, z], facing: W, pose: 'sit', activity: 'tv', seatY: 0.5 })
const arcade = (p: XZ): LoungeSpot => ({ pos: [p[0] - 0.95, p[1]], facing: E, pose: 'stand', activity: 'game', seatY: 0 })
const bean = (p: XZ): LoungeSpot => ({ pos: p, facing: 0, pose: 'beanbag', activity: 'chill', seatY: 0.32 })

export const LOUNGE_SPOTS: LoungeSpot[] = [
  sofa(9),
  arcade(ARCADES[0]!),
  bean(BEANBAGS[0]!),
  { pos: [PINGPONG[0] - 1.7, PINGPONG[1]], facing: E, pose: 'stand', activity: 'pingpong', seatY: 0 },
  sofa(10),
  { pos: [PINGPONG[0] + 1.7, PINGPONG[1]], facing: W, pose: 'stand', activity: 'pingpong', seatY: 0 },
  arcade(ARCADES[1]!),
  bean(BEANBAGS[1]!),
  sofa(11),
  arcade(ARCADES[2]!),
]

export function loungeSpot(queueIndex: number): LoungeSpot {
  return LOUNGE_SPOTS[queueIndex % LOUNGE_SPOTS.length]!
}

/** Building index 0 = left (first account), 1 = right. */
export function buildingX(index: number) {
  // Both pods in the middle of the floor, with an aisle between them.
  return index === 0 ? -5 : 5
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
export const CUBE_BACK = -4.0
// Snapped to the 0.5-unit voxel grid so the carpet tiles line up with the partitions.
export const CUBE_FRONT = -1
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

export type IdleActivity = LoungeActivity | 'meeting' | 'collab' | 'racks' | 'dining' | 'print' | 'vend' | 'roam'

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
const viaMeetingDoor = (p: XZ): XZ[] => [HUB, [10, 0], [9.2, -10.9], [11, -10.9], p]
const faceTo = (from: XZ, to: XZ) => Math.atan2(to[0] - from[0], to[1] - from[1])
const around = (c: XZ, dx: number, dz: number, activity: IdleActivity, back: boolean): IdleSpot => {
  const pos: XZ = [c[0] + dx, c[1] + dz]
  // Meeting room: enter through its door; render farm: go round the front of the pods.
  const route: XZ[] =
    activity === 'meeting' ? viaMeetingDoor(pos) : activity === 'racks' ? [HUB, [0, 0], [0, -6], pos] : back ? viaAisle(pos) : [HUB, pos]
  return { pos, facing: faceTo(pos, c), activity, pose: 'stand', seatY: 0, route }
}
const fromLounge = (l: LoungeSpot): IdleSpot => ({ ...l, route: [HUB, l.pos] })
const roam = (pos: XZ, facing: number): IdleSpot => ({ pos, facing, activity: 'roam', pose: 'stand', seatY: 0, route: [HUB, pos] })

const PI = Math.PI
const seat = (pos: XZ, facing: number, activity: IdleActivity, seatY: number, route: XZ[]): IdleSpot => ({ pos, facing, activity, pose: 'sit', seatY, route })
const stand = (pos: XZ, facing: number, activity: IdleActivity, route: XZ[] = [HUB, pos]): IdleSpot => ({ pos, facing, activity, pose: 'stand', seatY: 0, route })

/** Conference table chairs: three a side. Near side (toward the door) faces -z, far side +z. */
const MEETING_SEATS: IdleSpot[] = [-1.8, 0, 1.8].flatMap((dx) => {
  const x = MEETING[0] + dx
  const [, mz] = MEETING
  return [
    seat([x, mz + 1.1], PI, 'meeting', 0.55, [HUB, [10, 0], [9.2, -10.9], [11, -10.9], [x, mz + 1.9], [x, mz + 1.1]]),
    seat([x, mz - 1.1], 0, 'meeting', 0.55, [HUB, [10, 0], [9.2, -10.9], [11, -10.9], [11.2, mz], [11.2, mz - 1.9], [x, mz - 1.9], [x, mz - 1.1]]),
  ]
})

/** Pantry dining chairs (see PantryTable in Props.tsx): the counter-side row and the front row. */
const DINING_SEATS: IdleSpot[] = [KITCHEN[0] - 2.6, KITCHEN[0] + 0.8].flatMap((tx) =>
  [-0.55, 0.55].flatMap((dx) => {
    const x = tx + dx
    const z1 = KITCHEN[1] + 4.35
    const z2 = KITCHEN[1] + 6.75
    return [
      seat([x, z1 - 0.85], 0, 'dining', 0.55, [HUB, [-11, 0], [-11, z1 - 1.0], [x, z1 - 1.0], [x, z1 - 0.85]]),
      seat([x, z2 + 0.85], PI, 'dining', 0.55, [HUB, [-11, 0], [-11, z2 + 1.4], [x, z2 + 1.4], [x, z2 + 0.85]]),
    ]
  }),
)

/** Breakout stools at the three high-top tables (see CollabTable in Props.tsx). */
const COLLAB_SEATS: IdleSpot[] = [-3.2, 0, 3.2].flatMap((dx) => {
  const x = COLLAB[0] + dx
  const z = COLLAB[1]
  const side = dx > 0 ? x - 1.6 : x + 1.6
  return [
    seat([x, z - 0.85], 0, 'collab', 0.82, [HUB, [x, z - 2.4], [x, z - 0.85]]),
    seat([x, z + 0.85], PI, 'collab', 0.82, [HUB, [side, z - 1.8], [side, z + 1.8], [x, z + 1.8], [x, z + 0.85]]),
  ]
})

/** First LOUNGE_SPOTS.length entries mirror the lounge, so index i < that is lounge spot i. */
export const IDLE_SPOTS: IdleSpot[] = [
  ...LOUNGE_SPOTS.map(fromLounge),
  ...COLLAB_SEATS,
  ...MEETING_SEATS,
  ...DINING_SEATS,
  // at the printer and the two vending machines on the right edge, facing them (+x)
  stand([SUPPLIES[0] - 1.9, SUPPLIES[1]], PI / 2, 'print'),
  stand([ROOM_X - 1.9, 1.6], PI / 2, 'vend'),
  stand([ROOM_X - 1.9, 2.85], PI / 2, 'vend'),
  around(MEETING, -3.7, 0, 'meeting', true),
  around(MEETING, 3.7, 0, 'meeting', true),
  around(MEETING, 0, 2.1, 'meeting', true),
  around(RACKS, 0, 1.9, 'racks', true),
  around(RACKS, -2.2, 1.9, 'racks', true),
  roam([-6, 5], 0.6),
  roam([6, 5], -0.8),
  roam([-8, 8.5], 2.2),
  roam([8, 8.5], -2.2),
  roam([0, 7.8], 0),
  roam([-11, 3], 1.4),
  roam([11, 3], -1.4),
  roam([-6, 13], 3),
  roam([7, 13.5], 3.4),
]

export function idleSpot(choice: number): IdleSpot {
  return IDLE_SPOTS[choice % IDLE_SPOTS.length]!
}
