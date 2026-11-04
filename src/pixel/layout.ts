import type { Slot } from '../data'

/**
 * Cozy ¾ top-down office, in logical pixels (drawn at this size, scaled up with nearest-
 * neighbour). A tall back wall with shelves, windows and a coffee station; a lounge on the
 * left where the waiting list sits; two rows of desks on the right (one per Adobe account);
 * printer and break table at the front; door in the bottom wall. A central aisle
 * (x = AISLE_X) connects everything.
 */
export const W = 400
export const H = 300
export const FRAME = 8
export const WALL_H = 64
export const FLOOR_TOP = FRAME + WALL_H
export const FLOOR_BOTTOM = H - FRAME - 6
export const AISLE_X = 194

export type P = { x: number; y: number }

/** A place someone can be: the point, which way they face, whether they sit, and how to get there. */
export interface Spot {
  p: P
  face: 'up' | 'down' | 'left' | 'right'
  sit: boolean
  /** Waypoints from the aisle to the spot (empty if a straight walk from the aisle is clear). */
  via: P[]
}

// --- desks ---------------------------------------------------------------------

export const ROWS = { x0: 228, x1: 388, ys: [122, 204] as const }
export const DESK_W = 58
/** Desk top face height; the front face below it is DESK_FRONT tall. */
export const DESK_TOP = 14
export const DESK_FRONT = 14

export interface DeskLayout {
  slotId: number
  account: number
  index: number
  /** Whole desk (top face + front face). */
  desk: { x: number; y: number; w: number; h: number }
  /** Front face of the desk, where the name plate goes. */
  panel: { x: number; y: number; w: number; h: number }
  seat: Spot
  knock: Spot
}

export function deskLayouts(slots: Slot[], accountIds: number[]): DeskLayout[] {
  return slots.map((s) => {
    const account = Math.max(0, Math.min(1, accountIds.indexOf(s.account_id)))
    const index = s.slot_number % 2 === 1 ? 0 : 1
    const y = ROWS.ys[account]!
    const x = ROWS.x0 + 8 + index * (DESK_W + 16)
    const cx = x + DESK_W / 2
    return {
      slotId: s.id,
      account,
      index,
      desk: { x, y, w: DESK_W, h: DESK_TOP + DESK_FRONT },
      panel: { x: x + 3, y: y + DESK_TOP + 2, w: DESK_W - 6, h: DESK_FRONT - 4 },
      // sit behind the desk facing the room, reached along the gap behind the desks
      seat: { p: { x: cx, y: y + 2 }, face: 'down', sit: true, via: [{ x: cx, y: y - 10 }] },
      knock: { p: { x: cx, y: y + DESK_TOP + DESK_FRONT + 14 }, face: 'up', sit: false, via: [] },
    }
  })
}

// --- lounge (waiting list) ------------------------------------------------------

export const LOUNGE = { rug: { x: 22, y: 100, w: 134, h: 98 }, sofa: { x: 46, y: 96, w: 86 }, table: { x: 66, y: 136, w: 46 } }
export const ARMCHAIRS = [
  { x: 26, y: 146, face: 'right' as const },
  { x: 132, y: 146, face: 'left' as const },
]

/** Waiting seats in queue order: the sofa (3 seats), then the two armchairs. */
export const WAIT_SEATS: Spot[] = [
  ...[0, 1, 2].map((i) => {
    const x = LOUNGE.sofa.x + 15 + i * 28
    return { p: { x, y: 116 }, face: 'down' as const, sit: true, via: [{ x, y: 128 }] }
  }),
  { p: { x: ARMCHAIRS[0]!.x + 11, y: 166 }, face: 'right', sit: true, via: [{ x: ARMCHAIRS[0]!.x + 11, y: 186 }] },
  { p: { x: ARMCHAIRS[1]!.x + 11, y: 166 }, face: 'left', sit: true, via: [{ x: ARMCHAIRS[1]!.x + 11, y: 186 }] },
]
/** Overflow once the seats are full. */
export const WAIT_STAND: Spot[] = [
  { p: { x: 172, y: 150 }, face: 'left', sit: false, via: [] },
  { p: { x: 172, y: 172 }, face: 'left', sit: false, via: [] },
  { p: { x: 90, y: 212 }, face: 'up', sit: false, via: [] },
]

// --- idle spots -----------------------------------------------------------------

export const COFFEE = { x: 116, w: 64 }
export const PRINTER = { x: 232, y: 254 }
export const BREAK_TABLE = { x: 334, y: 262 }

export const IDLE_SPOTS: Spot[] = [
  { p: { x: 132, y: 94 }, face: 'up', sit: false, via: [{ x: 132, y: 90 }] }, // coffee station
  { p: { x: 160, y: 94 }, face: 'up', sit: false, via: [{ x: 160, y: 90 }] },
  { p: { x: 34, y: 92 }, face: 'up', sit: false, via: [{ x: 34, y: 88 }] }, // bookshelf
  { p: { x: 296, y: 92 }, face: 'up', sit: false, via: [] }, // bookshelf
  { p: { x: 237, y: 90 }, face: 'up', sit: false, via: [] }, // window
  { p: { x: 334, y: 92 }, face: 'up', sit: false, via: [] }, // filing cabinet
  { p: { x: 44, y: 240 }, face: 'left', sit: false, via: [] }, // water cooler
  { p: { x: 272, y: 270 }, face: 'left', sit: false, via: [] }, // printer
  { p: { x: 298, y: 272 }, face: 'right', sit: false, via: [] }, // break table
  { p: { x: 194, y: 160 }, face: 'down', sit: false, via: [] },
  { p: { x: 160, y: 262 }, face: 'right', sit: false, via: [] },
]

/** Door in the bottom wall; people enter and leave here. */
export const DOOR: P = { x: 200, y: FLOOR_BOTTOM + 3 }

/**
 * Walk from one spot to another: back out along the old spot's waypoints, along the aisle,
 * then in along the new spot's waypoints. Keeps people off the furniture.
 */
export function route(from: { p: P; via: P[] }, to: Spot): P[] {
  const fromY = from.via[0]?.y ?? from.p.y
  const toY = to.via[0]?.y ?? to.p.y
  return [...[...from.via].reverse(), { x: AISLE_X, y: fromY }, { x: AISLE_X, y: toY }, ...to.via, to.p]
}
