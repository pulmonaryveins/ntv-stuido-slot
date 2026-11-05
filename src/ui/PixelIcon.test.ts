import { describe, expect, it } from 'vitest'
import { ICON_DEFS } from './PixelIcon'

describe('pixel icons', () => {
  it('are all exactly 12x12 and every pixel has a colour', () => {
    for (const [name, icon] of Object.entries(ICON_DEFS)) {
      expect(icon.rows, name).toHaveLength(12)
      for (const [y, row] of icon.rows.entries()) {
        expect(row.length, `${name} row ${y}`).toBe(12)
        for (const ch of row) if (ch !== '.' && ch !== 'k') expect(icon.pal[ch], `${name} colour '${ch}'`).toBeDefined()
      }
    }
  })
})
