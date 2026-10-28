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
    for (const a of anchors.values()) {
      if (!a.el) continue
      v.copy(a.pos).project(camera)
      const onScreen = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2
      a.el.style.visibility = onScreen ? 'visible' : 'hidden'
      if (!onScreen) continue
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      a.el.style.transform = `translate(${x}px, ${y}px) translate(${a.shiftX * 100}%, -100%)`
    }
  })
  return null
}
