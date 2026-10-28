import * as THREE from 'three'
import type { ThreeElements } from '@react-three/fiber'

// Shared geometries (unit sized; meshes scale them). Voxel style: every round shape is a
// block, so props built from cylinders/cones/spheres all come out cubic.
const unitBox = new THREE.BoxGeometry(1, 1, 1)
export const GEO = {
  box: unitBox,
  cyl: unitBox,
  cyl6: unitBox,
  cone: unitBox,
  ico: unitBox,
  ico1: unitBox,
  dome: unitBox,
  /** Square outline ring (4 segments, rotated so the sides are axis-aligned). */
  ring: new THREE.RingGeometry(0.42, 0.5, 4, 1, Math.PI / 4),
  plane: new THREE.PlaneGeometry(1, 1),
}

/** Subtle 16x16 pixel noise, tinted by each material colour, for the blocky look. */
const pixelNoise = (() => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const v = 226 + Math.floor(rand(x * 16 + y + 5) * 30)
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(x, y, 1, 1)
    }
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
})()

// Original warm "studio town" palette.
export const PAL = {
  grass: '#8cc265',
  grassDark: '#6fa94f',
  soil: '#a8754a',
  soilDark: '#8a5b38',
  rock: '#7d7a85',
  rockDark: '#5f5c69',
  wood: '#c98e55',
  woodDark: '#9c6a3c',
  plank: '#dcae78',
  brick: '#c4664a',
  brickDark: '#a24f39',
  plaster: '#f1e4cf',
  teal: '#2fa59a',
  tealDark: '#227c74',
  amber: '#f0a63a',
  cream: '#fff4de',
  metal: '#9aa3ad',
  metalDark: '#5d6670',
  ink: '#2b2a33',
  stone: '#cfc6b5',
  stoneDark: '#b2a893',
  leaf: '#5fae5a',
  leafLight: '#86c765',
  leafDark: '#3f8a4a',
  fruit: '#ef6b4a',
  solar: '#2c4a7a',
  white: '#ffffff',
  skin: ['#f2c7a5', '#d9a07a', '#b97b55', '#8d5a3b', '#f5d6bd'],
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()

/** Shared flat-shaded material per colour. */
export function mat(color: string): THREE.MeshStandardMaterial {
  let m = matCache.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, map: pixelNoise, roughness: 0.95, metalness: 0 })
    matCache.set(color, m)
  }
  return m
}

/** Glowing materials whose emissive intensity follows the day/night cycle. */
export const GLOW = {
  window: new THREE.MeshStandardMaterial({ color: '#ffe6a8', emissive: '#ffcf6b', emissiveIntensity: 0, flatShading: true }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#ffd27a', emissiveIntensity: 0.2, flatShading: true }),
  bulb: new THREE.MeshStandardMaterial({ color: '#ffe9b0', emissive: '#ffb84d', emissiveIntensity: 0.3, flatShading: true }),
  screen: new THREE.MeshStandardMaterial({ color: '#bfe8ff', emissive: '#7cc8ff', emissiveIntensity: 0.6, flatShading: true }),
  screenOff: new THREE.MeshStandardMaterial({ color: '#33363f', flatShading: true }),
}

/** Current night factor (0 day .. 1 night), eased; written by DayNight every frame. */
export const NIGHT = { value: 0 }

/** Server rack LEDs (blinked by the render farm). */
export const LED = ['#53e07b', '#ffb547', '#58b7ff'].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1, flatShading: true }),
)

type V3 = [number, number, number]
type MeshProps = Omit<ThreeElements['mesh'], 'args'>

/** Box centred at p with size s. */
export function B({ p, s, c, r = 0, cast = false, ...rest }: { p: V3; s: V3; c: string; r?: number; cast?: boolean } & MeshProps) {
  return (
    <mesh geometry={GEO.box} material={mat(c)} position={p} scale={s} rotation={[0, r, 0]} castShadow={cast} receiveShadow {...rest} />
  )
}

/** Cylinder centred at p, radius rad, height h. */
export function C({ p, rad, h, c, seg6 = false, cast = false, ...rest }: { p: V3; rad: number; h: number; c: string; seg6?: boolean; cast?: boolean } & MeshProps) {
  return (
    <mesh
      geometry={seg6 ? GEO.cyl6 : GEO.cyl}
      material={mat(c)}
      position={p}
      scale={[rad * 2, h, rad * 2]}
      castShadow={cast}
      receiveShadow
      {...rest}
    />
  )
}

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function hashString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
