import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { B, C, GEO, NIGHT, PAL, glowTexture } from './kit'
import { COLLAB, KITCHEN, MEETING, ROOM_BACK, ROOM_X, SUPPLIES, buildingX } from './layout'
import { Stool } from './Furniture'

/**
 * Interior lighting and the extra props that fill the quiet corners of the office:
 * cove light strips under the wall fascia, soft pools of light on the floor, arc floor lamps,
 * a reading nook, a phone booth and a coat rack at the door. All light fades in with the night.
 */

type XZ = [number, number]

/** Floor light pools: centre, radius, strength. Night only; additive, so they glow on the carpet. */
const POOLS: { p: XZ; r: number; k: number }[] = [
  { p: [buildingX(0), -2.6], r: 6.5, k: 1 },
  { p: [buildingX(1), -2.6], r: 6.5, k: 1 },
  { p: [KITCHEN[0] + 1, -12], r: 7, k: 0.9 },
  { p: [-16.5, -2], r: 5, k: 0.8 },
  { p: [-16.5, 11], r: 6.5, k: 0.8 },
  { p: [15.5, 11], r: 6.5, k: 0.8 },
  { p: [MEETING[0], MEETING[1]], r: 6.5, k: 0.9 },
  { p: [COLLAB[0], COLLAB[1]], r: 7, k: 0.9 },
  { p: [0, 5], r: 10, k: 0.5 },
  { p: [-6.5, -13], r: 4.5, k: 0.8 },
  { p: [7, -13], r: 4, k: 0.7 },
]

/** Extra point lights (no shadows), on top of the zone lights in Props.tsx; kept few because every lit material pays for each one. */
const LIGHTS: { p: [number, number, number]; k: number }[] = [
  { p: [-16.5, 3, -2], k: 0.7 },
  { p: [0, 3.2, 5], k: 0.7 },
  { p: [SUPPLIES[0] - 1, 3, SUPPLIES[1]], k: 0.6 },
]

const FLOOR_LAMPS: XZ[] = [
  [-19.3, -6],
  [-9.7, -2.5],
  [9.7, -2.5],
  [-6.4, 12.5],
  [6.4, 12.5],
  [-9.2, -13.2],
  [9.4, -13.4],
]

export function OfficeLighting() {
  const cove = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff4de', emissive: '#ffe2b0', emissiveIntensity: 0.3, flatShading: true }), [])
  const shade = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#ffd27a', emissiveIntensity: 0.2, flatShading: true }), [])
  const map = useMemo(glowTexture, [])
  const glow = useMemo(
    () => new THREE.MeshBasicMaterial({ map, color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [map],
  )
  const wallMap = useMemo(() => {
    // vertical falloff: bright under the cove strip, fading down the wall
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 64)
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const wash = useMemo(
    () => new THREE.MeshBasicMaterial({ map: wallMap, color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [wallMap],
  )
  const halo = useMemo(
    () => new THREE.MeshBasicMaterial({ map, color: '#ffe2b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [map],
  )
  const { camera } = useThree()
  const halos = useRef<THREE.Group>(null)
  const lampPools = useRef<THREE.Group>(null)
  const pools = useRef<THREE.Group>(null)
  const lights = useRef<(THREE.PointLight | null)[]>([])
  useFrame(() => {
    const n = NIGHT.value
    cove.emissiveIntensity = 0.3 + n * 2.6
    shade.emissiveIntensity = 0.2 + n * 2.4
    glow.opacity = n * 0.55
    wash.opacity = n * 0.5
    halo.opacity = n * 0.85
    if (halos.current) {
      halos.current.visible = n > 0.02
      halos.current.children.forEach((h) => h.quaternion.copy(camera.quaternion))
    }
    if (pools.current) pools.current.visible = n > 0.02
    if (lampPools.current) lampPools.current.visible = n > 0.02
    lights.current.forEach((l, i) => {
      if (!l) return
      l.intensity = n * 42 * LIGHTS[i]!.k
      l.visible = n > 0.02
    })
  })
  const len = ROOM_X * 2
  return (
    <group>
      {/* cove strips under the fascia along the back and left walls, with a steel bracket line */}
      <B p={[0, 4.82, ROOM_BACK + 0.05]} s={[len - 0.2, 0.08, 0.1]} c={PAL.metalDark} />
      <mesh geometry={GEO.box} material={cove} position={[0, 4.76, ROOM_BACK + 0.07]} scale={[len - 0.4, 0.06, 0.06]} />
      <B p={[-ROOM_X + 0.05, 4.82, 0]} s={[0.1, 0.08, 31.8]} c={PAL.metalDark} />
      <mesh geometry={GEO.box} material={cove} position={[-ROOM_X + 0.07, 4.76, 0]} scale={[0.06, 0.06, 31.6]} />

      {/* the cove strips wash the walls below them with warm light */}
      <mesh geometry={GEO.plane} material={wash} position={[0, 3.0, ROOM_BACK + 0.03]} scale={[len - 0.4, 3.6, 1]} renderOrder={3} />
      <mesh geometry={GEO.plane} material={wash} position={[-ROOM_X + 0.03, 3.0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[31.6, 3.6, 1]} renderOrder={3} />

      {/* soft pools of light on the floor at night */}
      <group ref={pools}>
        {POOLS.map((pl, i) => (
          <mesh key={i} geometry={GEO.plane} material={glow} position={[pl.p[0], 0.05 + i * 0.001, pl.p[1]]} rotation={[-Math.PI / 2, 0, 0]} scale={[pl.r * 2.6 * pl.k, pl.r * 2.6 * pl.k, 1]} renderOrder={3} />
        ))}
      </group>

      {/* each floor lamp throws its own pool and has a halo around its shade */}
      <group ref={lampPools}>
        {FLOOR_LAMPS.map(([x, z], i) => (
          <mesh key={i} geometry={GEO.plane} material={glow} position={[x + 0.4, 0.06, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[5, 5, 1]} renderOrder={4} />
        ))}
      </group>
      <group ref={halos}>
        {FLOOR_LAMPS.map(([x, z], i) => (
          <mesh key={i} geometry={GEO.plane} material={halo} position={[x + 0.4, 1.9, z]} scale={[2.2, 2.2, 1]} renderOrder={5} />
        ))}
      </group>

      {LIGHTS.map((l, i) => (
        <pointLight key={i} ref={(r) => void (lights.current[i] = r)} position={l.p} color="#ffd7a1" intensity={0} distance={12} decay={2} />
      ))}

      {/* arc floor lamps: weighted base, slim stem, a curved arm and a glowing drum shade */}
      {FLOOR_LAMPS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <C p={[0, 0.03, 0]} rad={0.26} h={0.06} c={PAL.metalDark} />
          <B p={[0, 1.0, 0]} s={[0.05, 2.0, 0.05]} c={PAL.metal} cast />
          <B p={[0.2, 2.05, 0]} s={[0.4, 0.05, 0.05]} c={PAL.metal} />
          <C p={[0.4, 1.92, 0]} rad={0.24} h={0.3} c="#f7efdc" />
          <mesh geometry={GEO.box} material={shade} position={[0.4, 1.78, 0]} scale={[0.4, 0.04, 0.4]} />
          <mesh geometry={GEO.box} material={shade} position={[0.4, 2.08, 0]} scale={[0.3, 0.03, 0.3]} />
        </group>
      ))}
    </group>
  )
}

/** Armchair: upholstered seat and back with solid arms and short steel feet. Faces +z. */
function ArmChair({ p, c, r = 0 }: { p: XZ; c: string; r?: number }) {
  return (
    <group position={[p[0], 0, p[1]]} rotation={[0, r, 0]}>
      {[-0.3, 0.3].flatMap((x) => [-0.25, 0.25].map((z) => <B key={`${x}${z}`} p={[x, 0.07, z]} s={[0.06, 0.14, 0.06]} c={PAL.metalDark} />))}
      <B p={[0, 0.3, 0]} s={[0.78, 0.24, 0.72]} c={c} cast />
      <B p={[0, 0.5, 0.06]} s={[0.5, 0.14, 0.5]} c={c} />
      <B p={[0, 0.7, -0.3]} s={[0.78, 0.6, 0.14]} c={c} cast />
      {[-0.36, 0.36].map((x) => (
        <B key={x} p={[x, 0.5, 0]} s={[0.12, 0.3, 0.72]} c={c} />
      ))}
    </group>
  )
}

function SideTable({ p, top = '#e4e7eb', items = true }: { p: XZ; top?: string; items?: boolean }) {
  return (
    <group position={[p[0], 0, p[1]]}>
      <C p={[0, 0.03, 0]} rad={0.24} h={0.06} c={PAL.metalDark} />
      <C p={[0, 0.3, 0]} rad={0.04} h={0.6} c={PAL.metal} />
      <C p={[0, 0.62, 0]} rad={0.32} h={0.05} c={top} cast />
      {items && (
        <group>
          <C p={[0.1, 0.7, 0.05]} rad={0.06} h={0.12} c={PAL.cream} />
          <B p={[-0.12, 0.66, -0.06]} s={[0.22, 0.03, 0.16]} c={PAL.teal} r={0.3} />
        </group>
      )}
    </group>
  )
}

/** Reading nook against the back wall: low shelf with books, two armchairs, a side table and a rug. */
function ReadingNook() {
  const x = -6.5
  const z = ROOM_BACK + 0.5
  const books = ['#c0392b', '#2f6db5', '#e9b44c', '#3c8527', '#8e6cd1', '#2fa59a']
  return (
    <group>
      <B p={[x, 0.01, z + 2.2]} s={[4.6, 0.03, 3.4]} c="#cfd5db" />
      <B p={[x, 0.03, z + 2.2]} s={[4.2, 0.03, 3.0]} c="#6b7f9c" />
      {/* low shelf along the wall with books and a plant on top */}
      <B p={[x, 0.45, z]} s={[3.8, 0.9, 0.5]} c="#eceff2" cast />
      <B p={[x, 0.05, z + 0.02]} s={[3.8, 0.1, 0.5]} c={PAL.metalDark} />
      <B p={[x, 0.92, z]} s={[3.9, 0.05, 0.56]} c={PAL.metal} />
      {[-1.2, 0, 1.2].map((dx) => (
        <B key={dx} p={[x + dx, 0.5, z + 0.26]} s={[1.1, 0.7, 0.02]} c="#b6bdc5" />
      ))}
      {books.map((c, i) => (
        <B key={i} p={[x - 1.5 + i * 0.16, 1.14, z]} s={[0.12, 0.38 - (i % 3) * 0.05, 0.3]} c={c} />
      ))}
      <B p={[x + 1.4, 1.05, z]} s={[0.4, 0.22, 0.4]} c="#c4683f" />
      <B p={[x + 1.4, 1.3, z]} s={[0.36, 0.3, 0.36]} c={PAL.leaf} />
      {/* seating */}
      <ArmChair p={[x - 1.1, z + 1.9]} c="#4b6084" r={0.25} />
      <ArmChair p={[x + 1.1, z + 1.9]} c="#2fa59a" r={-0.25} />
      <SideTable p={[x, z + 1.9]} />
    </group>
  )
}

/** Phone booth: three glass walls on a steel frame with a stool, a shelf and a small lamp. Opens to +z. */
function PhoneBooth() {
  const x = 7.2
  const z = ROOM_BACK + 1.3
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#bfe3f2', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false }), [])
  const h = 2.5
  const w = 1.9
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.02, 0]} s={[w + 0.2, 0.04, w + 0.2]} c="#6b7f9c" />
      {[[-w / 2, -w / 2], [w / 2, -w / 2], [-w / 2, w / 2], [w / 2, w / 2]].map(([dx, dz], i) => (
        <B key={i} p={[dx!, h / 2, dz!]} s={[0.1, h, 0.1]} c={PAL.metalDark} cast />
      ))}
      <B p={[0, h + 0.05, 0]} s={[w + 0.2, 0.1, w + 0.2]} c={PAL.metalDark} />
      <mesh geometry={GEO.box} material={glass} position={[-w / 2, h / 2, 0]} scale={[0.04, h - 0.1, w]} renderOrder={1} />
      <mesh geometry={GEO.box} material={glass} position={[w / 2, h / 2, 0]} scale={[0.04, h - 0.1, w]} renderOrder={1} />
      <mesh geometry={GEO.box} material={glass} position={[0, h / 2, -w / 2]} scale={[w, h - 0.1, 0.04]} renderOrder={1} />
      <B p={[0, 1.25, w / 2]} s={[w, 0.06, 0.06]} c={PAL.metal} />
      {/* inside: shelf-desk on the back glass, a stool, a laptop and a lamp */}
      <B p={[0, 1.0, -w / 2 + 0.3]} s={[1.4, 0.06, 0.5]} c="#e4e7eb" cast />
      <B p={[-0.1, 1.12, -w / 2 + 0.3]} s={[0.4, 0.03, 0.28]} c={PAL.metal} />
      <B p={[-0.1, 1.24, -w / 2 + 0.17]} s={[0.4, 0.22, 0.02]} c={PAL.ink} />
      <B p={[0.5, 1.12, -w / 2 + 0.3]} s={[0.1, 0.18, 0.1]} c={PAL.amber} />
      <group position={[0, 0, -w / 2 + 0.85]}>
        <Stool c={PAL.amber} h={0.62} />
      </group>
    </group>
  )
}

/** Coat rack and umbrella stand just inside the front door. */
function CoatRack() {
  const colors = ['#c0392b', '#2f6db5', '#3b7d5c', '#e9b44c']
  return (
    <group position={[-ROOM_X + 0.7, 0, -0.4]}>
      <C p={[0, 0.03, 0]} rad={0.3} h={0.06} c={PAL.metalDark} />
      <B p={[0, 0.95, 0]} s={[0.06, 1.9, 0.06]} c={PAL.metal} cast />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.4
        return <B key={i} p={[Math.cos(a) * 0.14, 1.78, Math.sin(a) * 0.14]} s={[0.3, 0.04, 0.04]} r={-a} c={PAL.metalDark} />
      })}
      {/* two coats */}
      <B p={[0.22, 1.35, 0.1]} s={[0.1, 0.8, 0.34]} c="#4b5870" cast />
      <B p={[-0.15, 1.4, -0.2]} s={[0.1, 0.7, 0.3]} c="#b3312c" />
      {/* umbrella bin */}
      <C p={[0.5, 0.28, 0.1]} rad={0.2} h={0.56} c={PAL.metalDark} />
      {colors.map((c, i) => (
        <B key={c} p={[0.42 + (i % 2) * 0.16, 0.7, 0.04 + Math.floor(i / 2) * 0.14]} s={[0.04, 0.5, 0.04]} c={c} />
      ))}
    </group>
  )
}

export function Extras() {
  return (
    <group>
      <OfficeLighting />
      <ReadingNook />
      <PhoneBooth />
      <CoatRack />
    </group>
  )
}
