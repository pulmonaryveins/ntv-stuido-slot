import { describe, expect, it } from 'vitest'
import { recentDevices } from './recentDevices'
import { createSeedState, SEED_IDS } from '../data/seed'
import type { ActivityEntry } from '../data/types'

const claim = (id: number, user: string, device: string): ActivityEntry => ({
  id,
  slot_id: 1,
  user_id: user,
  action: 'claim',
  meta: { device_name: device },
  created_at: '2026-10-29T10:00:00.000Z',
})

describe('recent devices', () => {
  it('saved device first, then devices from recent claims; case-insensitive, own claims only', () => {
    const snap = createSeedState(Date.parse('2026-10-29T10:00:00Z'))
    snap.activity = [
      claim(3, SEED_IDS.lena, 'C1'),
      claim(2, SEED_IDS.lena, 'h7'), // same as the saved H7
      claim(1, SEED_IDS.maya, 'D4'), // someone else's
      claim(0, SEED_IDS.lena, 'J2'),
    ]
    expect(recentDevices(snap, SEED_IDS.lena)).toEqual(['H7', 'C1', 'J2'])
  })

  it('is empty without a user', () => {
    expect(recentDevices(createSeedState(0), null)).toEqual([])
  })
})
