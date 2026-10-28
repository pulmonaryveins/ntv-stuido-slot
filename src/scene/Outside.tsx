import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { B, GEO, GLOW, PAL, mat, rand } from './kit'

/** Street-side outside the office: ground, pavement, road, lamps, trees, cars and a skyline. */

const ROAD_Z0 = 19
const ROAD_Z1 = 25

function pixelTexture(colors: string[], seed: number, repeat: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = colors[Math.floor(rand(seed * 977 + x * 16 + y) * colors.length)]!
      ctx.fillRect(x, y, 1, 1)
    }
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Ground() {
  const grass = useMemo(() => pixelTexture(['#6dbf4b', '#64b345', '#78c957', '#5aa83c'], 1, 120), [])
  const paving = useMemo(() => {
    const t = pixelTexture(['#c9c3b8', '#bfb9ae', '#d2ccc1'], 2, 1)
    t.repeat.set(36, 34)
    return t
  }, [])
  const asphalt = useMemo(() => {
    const t = pixelTexture(['#4a4b52', '#45464d', '#505158', '#3f4047'], 3, 1)
    t.repeat.set(200, 6)
    return t
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {/* pavement around the building */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0.75]} receiveShadow>
        <planeGeometry args={[36, ROAD_Z0 * 2 - 1.5]} />
        <meshStandardMaterial map={paving} roughness={1} />
      </mesh>
      {/* road with a dashed centre line and kerbs */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, (ROAD_Z0 + ROAD_Z1) / 2]} receiveShadow>
        <planeGeometry args={[240, ROAD_Z1 - ROAD_Z0]} />
        <meshStandardMaterial map={asphalt} roughness={1} />
      </mesh>
      {Array.from({ length: 40 }, (_, i) => (
        <B key={i} p={[-120 + i * 6, 0, (ROAD_Z0 + ROAD_Z1) / 2]} s={[2.4, 0.02, 0.18]} c="#f2e6b8" />
      ))}
      <B p={[0, 0.05, ROAD_Z0]} s={[240, 0.12, 0.25]} c="#9d978c" />
      <B p={[0, 0.05, ROAD_Z1]} s={[240, 0.12, 0.25]} c="#9d978c" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, ROAD_Z1 + 1.5]}>
        <planeGeometry args={[240, 3]} />
        <meshStandardMaterial map={paving} roughness={1} />
      </mesh>
    </group>
  )
}

function StreetLamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.06, 0]} s={[0.35, 0.12, 0.35]} c={PAL.ink} />
      <B p={[0, 1.8, 0]} s={[0.12, 3.6, 0.12]} c={PAL.ink} cast />
      <B p={[0, 3.6, 0.4]} s={[0.1, 0.1, 0.8]} c={PAL.ink} />
      <B p={[0, 3.55, 0.8]} s={[0.4, 0.2, 0.4]} c={PAL.ink} />
      <mesh geometry={GEO.box} material={GLOW.lamp} position={[0, 3.43, 0.8]} scale={[0.32, 0.06, 0.32]} />
    </group>
  )
}

function Tree({ x, z, seed }: { x: number; z: number; seed: number }) {
  const h = 2 + rand(seed) * 1.6
  const greens = [PAL.leafDark, PAL.leaf, PAL.leafLight]
  return (
    <group position={[x, 0, z]}>
      <B p={[0, h / 2, 0]} s={[0.45, h, 0.45]} c="#6b4a2e" cast />
      <B p={[0, h + 0.6, 0]} s={[2.2, 1.3, 2.2]} c={greens[seed % 3]!} cast />
      <B p={[0, h + 1.45, 0]} s={[1.4, 0.6, 1.4]} c={greens[(seed + 1) % 3]!} cast />
      <B p={[0.6, h + 0.3, 0.5]} s={[1.0, 0.8, 1.0]} c={greens[(seed + 2) % 3]!} />
    </group>
  )
}

const CAR_COLORS = ['#d9534f', '#5b8def', '#f2c230', '#3d9970', '#e8e8e8', '#8e6cd1']

function Car({ color }: { color: string }) {
  return (
    <group>
      <B p={[0, 0.45, 0]} s={[2.6, 0.55, 1.2]} c={color} cast />
      <B p={[-0.1, 0.92, 0]} s={[1.5, 0.45, 1.1]} c={color} cast />
      <B p={[0.25, 0.93, 0]} s={[0.55, 0.38, 1.12]} c="#a9d6ee" />
      <B p={[-0.55, 0.93, 0]} s={[0.55, 0.38, 1.12]} c="#a9d6ee" />
      {[[-0.85, 0.6], [0.85, 0.6], [-0.85, -0.6], [0.85, -0.6]].map(([x, z]) => (
        <B key={`${x}${z}`} p={[x!, 0.2, z!]} s={[0.45, 0.4, 0.2]} c={PAL.ink} />
      ))}
      <mesh geometry={GEO.box} material={GLOW.lamp} position={[1.31, 0.5, 0.38]} scale={[0.02, 0.14, 0.22]} />
      <mesh geometry={GEO.box} material={GLOW.lamp} position={[1.31, 0.5, -0.38]} scale={[0.02, 0.14, 0.22]} />
    </group>
  )
}

/** One car driving along the far lane, wrapping around. */
function MovingCar({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const g = ref.current
    if (!g || reducedMotion) return
    g.position.x -= dt * 6
    if (g.position.x < -70) g.position.x = 70
  })
  return (
    <group ref={ref} position={[40, 0, ROAD_Z1 - 1.5]} rotation={[0, Math.PI, 0]}>
      <Car color="#f07f3c" />
    </group>
  )
}

/** Lit-window facade texture: daytime glass plus a mask of windows that glow at night. */
function facade(seed: number, wide: number, tall: number) {
  const make = (lit: boolean) => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = lit ? '#000000' : ['#8a93a3', '#a39686', '#7d8798', '#9a8f8a'][seed % 4]!
    ctx.fillRect(0, 0, 32, 32)
    for (let y = 2; y < 32; y += 4)
      for (let x = 2; x < 32; x += 4) {
        const on = rand(seed * 131 + x * 7 + y) < 0.55
        ctx.fillStyle = lit ? (on ? '#ffd27a' : '#000000') : '#c9dcec'
        ctx.fillRect(x, y, 2, 2)
      }
    const tex = new THREE.CanvasTexture(canvas)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(wide / 4, tall / 4)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }
  return { map: make(false), emissiveMap: make(true) }
}

/** Night glow of the skyline windows; DayNight sets the intensity. */
export const CITY_GLOW: THREE.MeshStandardMaterial[] = []

function Skyscraper({ x, z, w, d, h, seed }: { x: number; z: number; w: number; d: number; h: number; seed: number }) {
  const material = useMemo(() => {
    const { map, emissiveMap } = facade(seed, Math.max(w, d), h)
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: '#ffd27a', emissiveIntensity: 0, roughness: 0.9 })
    CITY_GLOW.push(m)
    return m
  }, [seed, w, d, h])
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.box} material={material} position={[0, h / 2, 0]} scale={[w, h, d]} />
      <mesh geometry={GEO.box} material={mat('#5d6670')} position={[0, h + 0.3, 0]} scale={[w * 0.9, 0.6, d * 0.9]} />
      {seed % 3 === 0 && <mesh geometry={GEO.box} material={mat('#9aa3ad')} position={[w * 0.2, h + 1.6, 0]} scale={[0.25, 2.2, 0.25]} />}
    </group>
  )
}

export function Outside({ reducedMotion }: { reducedMotion: boolean }) {
  const skyline = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number; seed: number }[] = []
    let seed = 1
    // behind the back wall
    for (let x = -60; x <= 60; x += 9) out.push({ x: x + rand(seed) * 3, z: -42 - rand(seed + 1) * 14, w: 6 + rand(seed + 2) * 5, d: 6 + rand(seed + 3) * 4, h: 10 + rand(seed++ * 5) * 26, seed })
    // left of the building
    for (let z = -30; z <= 30; z += 10) out.push({ x: -44 - rand(seed) * 12, z: z + rand(seed + 1) * 3, w: 6 + rand(seed + 2) * 4, d: 6 + rand(seed + 3) * 5, h: 9 + rand(seed++ * 7) * 22, seed })
    // across the street, set back
    for (let x = -50; x <= 50; x += 12) {
      if (Math.abs(x) < 20) continue
      out.push({ x, z: 38 + rand(seed) * 6, w: 7 + rand(seed + 2) * 3, d: 6, h: 6 + rand(seed++ * 3) * 10, seed })
    }
    return out
  }, [])

  return (
    <group>
      <Ground />
      {[-28, -18, 18, 28, 38, -38].map((x) => (
        <StreetLamp key={x} x={x} z={ROAD_Z0 - 0.6} />
      ))}
      {[-4, 6].map((x) => (
        <StreetLamp key={`b${x}`} x={x} z={ROAD_Z0 - 0.6} />
      ))}
      {/* trees: behind, beside and across the street (never in front of the office) */}
      {[
        [-22, -8], [-24, 4], [-21, 12], [22, -10], [24, 2], [21, 11], [-12, -20], [0, -21], [12, -20],
        [-30, 30], [-14, 30], [14, 30], [30, 30],
      ].map(([x, z], i) => (
        <Tree key={i} x={x!} z={z!} seed={i} />
      ))}
      {/* bench + bike rack beside the entrance side */}
      <group position={[-19, 0, 2]} rotation={[0, Math.PI / 2, 0]}>
        <B p={[0, 0.45, 0]} s={[1.8, 0.1, 0.5]} c={PAL.wood} cast />
        <B p={[0, 0.8, -0.22]} s={[1.8, 0.4, 0.08]} c={PAL.wood} />
        <B p={[-0.75, 0.22, 0]} s={[0.1, 0.44, 0.45]} c={PAL.ink} />
        <B p={[0.75, 0.22, 0]} s={[0.1, 0.44, 0.45]} c={PAL.ink} />
      </group>
      {[0, 1, 2].map((i) => (
        <B key={i} p={[-19, 0.4, 5 + i * 0.6]} s={[0.08, 0.8, 0.5]} c={PAL.metal} />
      ))}
      {/* parked cars along the kerb */}
      {[-32, -24, 24, 33].map((x, i) => (
        <group key={x} position={[x, 0, ROAD_Z0 + 1.3]}>
          <Car color={CAR_COLORS[i % CAR_COLORS.length]!} />
        </group>
      ))}
      <MovingCar reducedMotion={reducedMotion} />
      {skyline.map((b, i) => (
        <Skyscraper key={i} {...b} />
      ))}
    </group>
  )
}
