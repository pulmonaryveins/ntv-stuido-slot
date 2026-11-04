import { useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * DOM overlays pinned to 3D points. Overlay elements live in the normal React tree
 * (outside the Canvas); the projector moves them every frame. This replaces drei <Html>,
 * whose per-element React roots race on unmount under React 19 and drop plates.
 */
interface Anchor {
  pos: THREE.Vector3
  el: HTMLElement | null
  /** Horizontal shift as a fraction of the element width (-1 = left of point, -0.5 = centred). */
  shiftX: number
}

export const anchors = new Map<string, Anchor>()

/** Ref callback registering an overlay element at a world position. */
export function useAnchor(key: string, x: number, y: number, z: number, shiftX = -0.5) {
  return useCallback(
    (el: HTMLElement | null) => {
      if (el) {
        const existing = anchors.get(key)
        if (existing) Object.assign(existing, { el, shiftX })
        else anchors.set(key, { pos: new THREE.Vector3(x, y, z), el, shiftX })
        el.style.visibility = 'hidden'
      } else {
        anchors.delete(key)
      }
    },
    [key, x, y, z, shiftX],
  )
}

/** Moves an anchor (e.g. a speech bubble following a walking avatar). */
export function setAnchorPos(key: string, x: number, y: number, z: number) {
  anchors.get(key)?.pos.set(x, y, z)
}

const v = new THREE.Vector3()

export function AnchorProjector() {
  const { camera, size } = useThree()
  useFrame(() => {
    // Pass 1 reads only (projection + element sizes); pass 2 writes. Interleaving reads and
    // writes would force a layout per overlay per frame.
    type Item = { a: Anchor; el: HTMLElement; desk: boolean; on: boolean; x: number; y: number; w: number; h: number; s: number }
    const items: Item[] = []
    // Desk plates shrink with the zoom (the desks get closer together on screen) and switch to a
    // one-line compact form when small, so zooming out never buries the office under cards.
    const baseZoom = Math.min(size.width / 56, size.height / 40)
    const plateScale = THREE.MathUtils.clamp(camera.zoom / (baseZoom * 1.6), 0.7, 1)
    const compact = camera.zoom < baseZoom * 1.4
    for (const [key, a] of anchors) {
      const el = a.el
      if (!el) continue
      v.copy(a.pos).project(camera)
      const on = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2
      const desk = key.startsWith('desk:')
      const s = desk ? plateScale : 1
      if (desk && (el.dataset.compact === '1') !== compact) el.dataset.compact = compact ? '1' : ''
      const w = el.offsetWidth * s
      const h = el.offsetHeight * s
      const px = ((v.x + 1) / 2) * size.width
      const py = ((1 - v.y) / 2) * size.height
      items.push({ a, el, desk, on, x: px + a.shiftX * w, y: py - h, w, h, s })
    }

    // Desk plates: nearer (lower) plates keep their place; plates behind move up until clear.
    const plates = items.filter((i) => i.desk && i.on).sort((p, q) => q.y - p.y)
    const GAP = 4
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i]!
      for (let pass = 0; pass < plates.length; pass++) {
        let moved = false
        for (let j = 0; j < i; j++) {
          const q = plates[j]!
          if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h + GAP && q.y < p.y + p.h + GAP) {
            p.y = q.y - p.h - GAP
            moved = true
          }
        }
        if (!moved) break
      }
    }

    for (const i of items) {
      const vis = i.on ? 'visible' : 'hidden'
      if (i.el.style.visibility !== vis) i.el.style.visibility = vis
      if (i.on) i.el.style.transform = `translate(${Math.round(i.x)}px, ${Math.round(i.y)}px)${i.s !== 1 ? ` scale(${i.s.toFixed(3)})` : ''}`
    }
  })
  return null
}
