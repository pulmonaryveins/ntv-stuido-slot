import type { Slot } from '../data'

export type XZ = [number, number]

export const ISLAND_RADIUS = 14
export const HUB: XZ = [0, 4.2]
export const EXIT: XZ = [0, 13.2]
export const CART: XZ = [5.2, 6.2]
export const TOWER: XZ = [0, -9.5]

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

export function queueSpot(index: number): XZ {
  return [-2 - index * 1.0, 3.6]
}

export function cartSpot(index: number): XZ {
  const a = 2.4 + index * 0.7
  return [CART[0] + Math.cos(a) * 1.5, CART[1] + Math.sin(a) * 1.5]
}
