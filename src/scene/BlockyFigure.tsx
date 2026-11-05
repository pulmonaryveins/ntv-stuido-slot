import { useMemo } from 'react'
import * as THREE from 'three'
import type { Look } from '../lib/look'
import { ATLAS, atlasLayout, buildAtlas, partSize, type Face, type Patch, type PartName, type Rect } from '../lib/skin'

export type LimbKey = 'legL' | 'legR' | 'armL' | 'armR'
type LimbRef = (k: LimbKey) => (o: THREE.Object3D | null) => void

/** World units per skin pixel: 32 px tall = 1.6 units. */
const P = 0.05
/** Hip height (top of the legs), used by the avatars to sit on seats. */
export const HIP_Y = 12 * P

// ---------------------------------------------------------------------------- materials

const materials = new Map<string, THREE.MeshStandardMaterial>()

/** One material per look: the whole skin is a single 64x64 pixel texture. */
function skinMaterial(look: Look): THREE.MeshStandardMaterial {
  const key = JSON.stringify(look)
  const hit = materials.get(key)
  if (hit) return hit
  const grid = buildAtlas(look)
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS
  canvas.height = ATLAS
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < ATLAS; y++)
    for (let x = 0; x < ATLAS; x++) {
      const c = grid[y]![x]
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(x, y, 1, 1)
    }
  const map = new THREE.CanvasTexture(canvas)
  map.magFilter = THREE.NearestFilter
  map.minFilter = THREE.NearestFilter
  map.generateMipmaps = false
  map.colorSpace = THREE.SRGBColorSpace
  // alphaTest: the outer hair/hat layer is see-through where it has no pixels.
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.95, metalness: 0 })
  materials.set(key, m)
  return m
}

// ---------------------------------------------------------------------------- geometry

const FACE_ORDER: Face[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'] // BoxGeometry group order
const geometries = new Map<string, THREE.BoxGeometry>()

/** A box whose six faces sample the given atlas rects. */
function mappedBox(w: number, h: number, d: number, rects: Record<Face, Rect>): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  FACE_ORDER.forEach((face, i) => {
    const r = rects[face]
    for (let j = 0; j < 4; j++) {
      const k = i * 4 + j
      const u = uv.getX(k)
      const v = uv.getY(k)
      uv.setXY(k, (r.x + u * r.w) / ATLAS, 1 - (r.y + (1 - v) * r.h) / ATLAS)
    }
  })
  uv.needsUpdate = true
  return g
}

function partGeometry(part: PartName, slim: boolean): THREE.BoxGeometry {
  const key = `${part}:${slim}`
  let g = geometries.get(key)
  if (!g) {
    const [w, h, d] = partSize(part, slim)
    // The outer (hat) layer sits half a pixel outside the head on every side.
    const grow = part === 'hat' ? P * 0.6 : 0
    g = mappedBox(w * P + grow, h * P + grow, d * P + grow, atlasLayout(slim).parts[part])
    geometries.set(key, g)
  }
  return g
}

/** Unit cube coloured by a flat patch (scaled per block). Patch rects depend on the arm width. */
function patchGeometry(patch: Patch, slim: boolean): THREE.BoxGeometry {
  const key = `patch:${patch}:${slim}`
  let g = geometries.get(key)
  if (!g) {
    const r = atlasLayout(slim).patches[patch]
    const inner = { x: r.x + 0.5, y: r.y + 0.5, w: r.w - 1, h: r.h - 1 }
    g = mappedBox(1, 1, 1, { px: inner, nx: inner, py: inner, ny: inner, pz: inner, nz: inner })
    geometries.set(key, g)
  }
  return g
}

type V3 = [number, number, number]
type Block = { patch: Patch; p: V3; s: V3 | number }

/** Blocks that stick out of the skin: hair volume, brims, crown points. */
function extras(look: Look): Block[] {
  const out: Block[] = []
  const hair = (p: V3, s: V3 | number) => out.push({ patch: 'hair', p, s })
  switch (look.hairStyle) {
    case 2: // long hair down the back
      hair([0, 1.1, -0.115], [0.36, 0.22, 0.03])
      break
    case 3:
      hair([-0.12, 1.65, 0.05], 0.1)
      hair([0.02, 1.68, 0.1], 0.1)
      hair([0.13, 1.65, -0.03], 0.09)
      hair([-0.02, 1.66, -0.12], 0.1)
      break
    case 4:
      hair([0, 1.66, -0.01], [0.08, 0.1, 0.42])
      break
    case 5:
      hair([0, 1.66, -0.11], [0.15, 0.12, 0.15])
      break
    case 6:
      hair([0, 1.3, -0.235], [0.09, 0.28, 0.07])
      out.push({ patch: 'hatc', p: [0, 1.46, -0.235], s: [0.1, 0.04, 0.08] })
      break
    case 8:
      hair([0, 1.635, 0], [0.44, 0.05, 0.44])
      break
  }
  switch (look.accessory) {
    case 1:
      out.push({ patch: 'ink', p: [0, 1.64, 0], s: [0.47, 0.04, 0.07] })
      out.push({ patch: 'ink', p: [-0.235, 1.4, 0], s: [0.06, 0.15, 0.15] })
      out.push({ patch: 'ink', p: [0.235, 1.4, 0], s: [0.06, 0.15, 0.15] })
      break
    case 3:
      out.push({ patch: 'white', p: [0, 1.65, 0], s: 0.09 })
      break
    case 4:
      out.push({ patch: 'hatc', p: [0, 1.565, 0.29], s: [0.4, 0.03, 0.17] })
      break
    case 5:
      out.push({ patch: 'gold', p: [0, 1.645, 0], s: [0.42, 0.06, 0.42] })
      for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18], [0, 0.18]] as const) out.push({ patch: 'gold', p: [x, 1.7, z], s: 0.06 })
      out.push({ patch: 'gem', p: [0, 1.645, 0.212], s: [0.06, 0.035, 0.01] })
      break
    case 6:
      out.push({ patch: 'hardhat', p: [0, 1.56, 0], s: [0.5, 0.03, 0.5] })
      out.push({ patch: 'lamp', p: [0, 1.585, 0.226], s: [0.1, 0.07, 0.03] })
      break
    case 7:
      out.push({ patch: 'pink', p: [0.23, 1.53, -0.05], s: [0.03, 0.08, 0.08] })
      break
  }
  return out
}

/**
 * Custom block character: a pixel skin (lib/skin.ts) on block-game proportions. Feet at the
 * origin, 1.6 units tall. Limbs are groups pivoting at the hips and shoulders; pass `limbRef`
 * to animate them.
 */
export function BlockyFigure({ look, limbRef }: { look: Look; limbRef?: LimbRef }) {
  const slim = look.gender === 1
  const material = useMemo(() => skinMaterial(look), [look])
  const blocks = useMemo(() => extras(look), [look])
  const ref = (k: LimbKey) => limbRef?.(k)
  const armX = 0.2 + ((slim ? 3 : 4) * P) / 2
  const g = (part: PartName) => partGeometry(part, slim)
  return (
    <>
      <group ref={ref('legL')} position={[-0.1, HIP_Y, 0]}>
        <mesh geometry={g('leg')} material={material} position={[0, -0.3, 0]} castShadow />
      </group>
      <group ref={ref('legR')} position={[0.1, HIP_Y, 0]}>
        <mesh geometry={g('leg')} material={material} position={[0, -0.3, 0]} castShadow />
      </group>
      <mesh geometry={g('body')} material={material} position={[0, 0.9, 0]} castShadow />
      <group ref={ref('armL')} position={[-armX, 1.15, 0]}>
        <mesh geometry={g('arm')} material={material} position={[0, -0.25, 0]} castShadow />
      </group>
      <group ref={ref('armR')} position={[armX, 1.15, 0]}>
        <mesh geometry={g('arm')} material={material} position={[0, -0.25, 0]} castShadow />
      </group>
      <mesh geometry={g('head')} material={material} position={[0, 1.4, 0]} castShadow />
      <mesh geometry={g('hat')} material={material} position={[0, 1.4, 0]} />
      {blocks.map((b, i) => (
        <mesh key={i} geometry={patchGeometry(b.patch, slim)} material={material} position={b.p} scale={b.s} />
      ))}
    </>
  )
}
