import * as THREE from 'three'
import type { ThreeElements } from '@react-three/fiber'

// Shared low-poly geometries (unit sized; meshes scale them).
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  ico1: new THREE.IcosahedronGeometry(0.5, 1),
  dome: new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  ring: new THREE.RingGeometry(0.42, 0.5, 24),
  plane: new THREE.PlaneGeometry(1, 1),
}

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
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.02 })
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
