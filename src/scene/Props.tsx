import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { B, C, GEO, GLOW, NIGHT, PAL, mat, rand } from './kit'
import { ARCADES, BEANBAGS, MEETING_ROOM, COLLAB, CUBE_BACK, KITCHEN, MEETING, PINGPONG, ROOM_BACK, ROOM_X, SOFA_X, TV_POS, buildingX } from './layout'

const LEFT_WALL = -ROOM_X

/** A small canvas texture repainted a few times a second (TV / arcade screens). */
function useAnimatedScreen(w: number, h: number, paint: (ctx: CanvasRenderingContext2D, frame: number) => void, fps = 4) {
  const { tex, ctx } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const tex = new THREE.CanvasTexture(canvas)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.colorSpace = THREE.SRGBColorSpace
    return { tex, ctx: canvas.getContext('2d')! }
  }, [w, h])
  const state = useMemo(() => ({ last: -1 }), [])
  useFrame(({ clock }) => {
    const frame = Math.floor(clock.elapsedTime * fps)
    if (frame === state.last) return
    state.last = frame
    paint(ctx, frame)
    tex.needsUpdate = true
  })
  return tex
}

/** Wall-mounted TV playing a little pixel "show" (sunset scene with a bouncing sprite). */
function WallTV() {
  const screen = useAnimatedScreen(32, 18, (ctx, f) => {
    const sky = ['#ff9a5a', '#ffb36b', '#ffcd7a', '#9fd3ff']
    for (let y = 0; y < 18; y++) {
      ctx.fillStyle = y < 10 ? sky[Math.min(3, Math.floor(y / 3))]! : y < 12 ? '#3d8f4a' : '#2d6b38'
      ctx.fillRect(0, y, 32, 1)
    }
    ctx.fillStyle = '#fff2a8'
    ctx.fillRect(22, 3, 4, 4)
    const x = (f * 2) % 40 - 6
    const hop = [0, 1, 2, 1][f % 4]!
    ctx.fillStyle = '#e04848'
    ctx.fillRect(x, 8 - hop, 4, 4)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x + 2, 9 - hop, 1, 1)
  })
  return (
    <group position={[LEFT_WALL + 0.12, 2.1, TV_POS[1]]} rotation={[0, Math.PI / 2, 0]}>
      <B p={[0, 0, 0]} s={[3.4, 2.0, 0.16]} c={PAL.ink} cast />
      <mesh geometry={GEO.plane} position={[0, 0.02, 0.09]} scale={[3.1, 1.75, 1]}>
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {/* media console under the TV */}
      <B p={[0, -1.6, 0.25]} s={[3.2, 0.5, 0.6]} c={PAL.woodDark} cast />
      <B p={[-0.8, -1.6, 0.56]} s={[0.6, 0.3, 0.02]} c={PAL.ink} />
      <B p={[0.8, -1.6, 0.56]} s={[0.6, 0.3, 0.02]} c={PAL.ink} />
      <B p={[1.2, -1.28, 0.25]} s={[0.4, 0.14, 0.3]} c={PAL.metal} />
    </group>
  )
}

function Sofa() {
  return (
    <group position={[SOFA_X - 0.25, 0, TV_POS[1]]}>
      <B p={[0, 0.25, 0]} s={[1.0, 0.5, 3.4]} c={PAL.teal} cast />
      <B p={[0.42, 0.75, 0]} s={[0.25, 0.75, 3.4]} c={PAL.tealDark} cast />
      <B p={[0, 0.5, -1.82]} s={[1.0, 0.45, 0.28]} c={PAL.tealDark} />
      <B p={[0, 0.5, 1.82]} s={[1.0, 0.45, 0.28]} c={PAL.tealDark} />
      <B p={[0.2, 0.62, -1.0]} s={[0.25, 0.4, 0.5]} c={PAL.amber} r={0.2} />
      <B p={[0.2, 0.62, 1.0]} s={[0.25, 0.4, 0.5]} c={PAL.brick} r={-0.2} />
      {/* rug + coffee table between sofa and TV */}
      <B p={[-2.0, 0.02, 0]} s={[3.2, 0.04, 4.2]} c={PAL.cream} />
      <B p={[-2.0, 0.03, 0]} s={[2.6, 0.04, 3.6]} c="#d98fb0" />
      <B p={[-2.0, 0.3, 0]} s={[1.1, 0.12, 1.8]} c={PAL.wood} cast />
      {[-0.7, 0.7].map((z) => (
        <B key={z} p={[-2.0, 0.14, z]} s={[0.9, 0.24, 0.1]} c={PAL.woodDark} />
      ))}
      <B p={[-2.2, 0.42, -0.4]} s={[0.3, 0.08, 0.2]} c={PAL.ink} />
      <C p={[-1.8, 0.45, 0.4]} rad={0.08} h={0.18} c={PAL.cream} />
    </group>
  )
}

/** Arcade cabinet with a flickering pixel game on screen (faces the camera, +z). */
function Arcade({ p, hue }: { p: [number, number]; hue: number }) {
  const screen = useAnimatedScreen(16, 12, (ctx, f) => {
    ctx.fillStyle = '#0b0b1e'
    ctx.fillRect(0, 0, 16, 12)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `hsl(${(hue + i * 50) % 360} 90% 60%)`
      ctx.fillRect(2 + i * 3, 1 + ((f + i) % 3), 2, 1)
    }
    ctx.fillStyle = '#7dff8a'
    ctx.fillRect(4 + (f % 8), 10, 3, 1)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(5 + (f % 8), 5 + (f % 4), 1, 1)
  }, 6)
  const body = `hsl(${hue} 55% 42%)`
  return (
    // Built facing +z, turned to face into the room (-x) from the right edge.
    <group position={[p[0], 0, p[1]]} rotation={[0, -Math.PI / 2, 0]}>
      <B p={[0, 0.85, 0]} s={[1.0, 1.7, 0.9]} c={body} cast />
      <B p={[0, 1.95, -0.05]} s={[1.0, 0.5, 0.8]} c={PAL.ink} cast />
      <mesh geometry={GEO.plane} position={[0, 1.55, 0.46]} rotation={[-0.15, 0, 0]} scale={[0.8, 0.6, 1]}>
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      <B p={[0, 1.08, 0.58]} s={[1.0, 0.1, 0.35]} c={PAL.ink} />
      <B p={[-0.2, 1.17, 0.6]} s={[0.08, 0.14, 0.08]} c={PAL.brick} />
      <B p={[0.15, 1.15, 0.62]} s={[0.1, 0.06, 0.1]} c={PAL.amber} />
      <B p={[0.32, 1.15, 0.58]} s={[0.1, 0.06, 0.1]} c={PAL.teal} />
      <mesh geometry={GEO.box} material={GLOW.lamp} position={[0, 2.12, 0.36]} scale={[0.9, 0.18, 0.04]} />
    </group>
  )
}

function PingPong() {
  return (
    <group position={[PINGPONG[0], 0, PINGPONG[1]]}>
      <B p={[0, 0.75, 0]} s={[2.6, 0.08, 1.5]} c="#2e7d5b" cast />
      <B p={[0, 0.8, 0]} s={[2.6, 0.02, 0.04]} c={PAL.white} />
      <B p={[0, 0.88, 0]} s={[0.04, 0.16, 1.6]} c={PAL.cream} />
      {[[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]].map(([x, z]) => (
        <B key={`${x}${z}`} p={[x!, 0.36, z!]} s={[0.08, 0.72, 0.08]} c={PAL.ink} />
      ))}
      <Ball />
    </group>
  )
}

/** Ping-pong ball bouncing across the net. */
function Ball() {
  const ref = useMemo(() => ({ mesh: null as THREE.Mesh | null }), [])
  useFrame(({ clock }) => {
    const m = ref.mesh
    if (!m) return
    const t = clock.elapsedTime * 1.4
    const phase = t % 2
    const x = phase < 1 ? -1.0 + phase * 2 : 1.0 - (phase - 1) * 2
    m.position.set(x, 0.85 + Math.abs(Math.sin(phase * Math.PI)) * 0.35, Math.sin(t * 1.7) * 0.3)
  })
  return <mesh ref={(m) => void (ref.mesh = m)} geometry={GEO.box} material={mat(PAL.white)} scale={0.08} />
}

function BeanBag({ p, c }: { p: [number, number]; c: string }) {
  return (
    <group position={[p[0], 0, p[1]]}>
      <B p={[0, 0.2, 0]} s={[1.0, 0.4, 1.0]} c={c} cast />
      {/* backrest behind the sitter, who faces +z (toward the camera) */}
      <B p={[0, 0.5, -0.35]} s={[0.9, 0.5, 0.3]} c={c} cast />
    </group>
  )
}

function FloorLamp({ p }: { p: [number, number] }) {
  return (
    <group position={[p[0], 0, p[1]]}>
      <B p={[0, 0.04, 0]} s={[0.4, 0.08, 0.4]} c={PAL.ink} />
      <B p={[0, 1.1, 0]} s={[0.08, 2.1, 0.08]} c={PAL.ink} cast />
      <B p={[0, 2.3, 0]} s={[0.55, 0.4, 0.55]} c={PAL.amber} />
      <mesh geometry={GEO.box} material={GLOW.lamp} position={[0, 2.08, 0]} scale={[0.4, 0.06, 0.4]} />
    </group>
  )
}

const ART = [PAL.brick, PAL.amber, PAL.teal, '#d98fb0', '#8e6cd1', '#5b8def']

/** Framed pixel posters on the walls. */
function Poster({ p, w, h, seed, side = false }: { p: [number, number, number]; w: number; h: number; seed: number; side?: boolean }) {
  const cells = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ x: i % 4, y: Math.floor(i / 4), c: ART[Math.floor(rand(seed * 13 + i) * ART.length)]! })),
    [seed],
  )
  return (
    <group position={p} rotation={[0, side ? Math.PI / 2 : 0, 0]}>
      <B p={[0, 0, 0]} s={[w + 0.16, h + 0.16, 0.06]} c={PAL.ink} />
      {cells.map((c) => (
        <B key={`${c.x}-${c.y}`} p={[-w / 2 + (c.x + 0.5) * (w / 4), h / 2 - (c.y + 0.5) * (h / 3), 0.04]} s={[w / 4, h / 3, 0.02]} c={c.c} />
      ))}
    </group>
  )
}

// --- plants -----------------------------------------------------------------

type PlantKind = 'fiddle' | 'snake' | 'bush'

/** Potted plant: terracotta pot with a rim and soil, then leaves by variety. */
function Plant({ p, kind, s = 1 }: { p: [number, number]; kind: PlantKind; s?: number }) {
  const leaves = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; c: string; r: number }[] = []
    const greens = [PAL.leafDark, PAL.leaf, PAL.leafLight]
    if (kind === 'fiddle') {
      // tall stem with broad leaves stepping up and around
      for (let i = 0; i < 7; i++) {
        const a = i * 2.2
        out.push({ p: [Math.cos(a) * 0.22, 0.15 + i * 0.2, Math.sin(a) * 0.22], s: [0.32, 0.06, 0.22], c: greens[i % 3]!, r: a })
      }
      out.push({ p: [0, 1.55, 0], s: [0.24, 0.22, 0.24], c: PAL.leafLight, r: 0 })
    } else if (kind === 'snake') {
      // upright blades of different heights
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05
        const h = 0.5 + rand(i + 3) * 0.45
        out.push({ p: [Math.cos(a) * 0.12, h / 2, Math.sin(a) * 0.12], s: [0.08, h, 0.04], c: i % 2 ? '#4f8a3c' : '#6aa84f', r: a })
      }
    } else {
      // round leafy bush
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7
        out.push({ p: [Math.cos(a) * 0.12 * (i % 3), 0.12 + (i % 3) * 0.14, Math.sin(a) * 0.12 * (i % 3)], s: [0.32, 0.24, 0.32], c: greens[i % 3]!, r: a })
      }
    }
    return out
  }, [kind])
  const potH = kind === 'fiddle' ? 0.6 : 0.5
  return (
    <group position={[p[0], 0, p[1]]} scale={s}>
      <B p={[0, potH / 2, 0]} s={[0.5, potH, 0.5]} c="#c4683f" cast />
      <B p={[0, potH - 0.02, 0]} s={[0.56, 0.08, 0.56]} c="#a85631" />
      <B p={[0, potH + 0.01, 0]} s={[0.44, 0.03, 0.44]} c="#5a3d26" />
      {kind === 'fiddle' && <B p={[0, potH + 0.75, 0]} s={[0.05, 1.5, 0.05]} c={PAL.woodDark} />}
      {leaves.map((l, i) => (
        <B key={i} p={[l.p[0], l.p[1] + potH, l.p[2]]} s={l.s} c={l.c} r={l.r} cast />
      ))}
    </group>
  )
}

/** Placed where they frame zones: corners, beside the door and TV, by the pods. */
const PLANTS: { p: [number, number]; kind: PlantKind; s?: number }[] = [
  { p: [-6.6, -8.9], kind: 'fiddle', s: 1.1 },
  { p: [12.9, -6.9], kind: 'bush' },
  { p: [-14.3, 0.2], kind: 'snake' },
  { p: [-14.3, 2.8], kind: 'snake' },
  { p: [-14.2, 9.3], kind: 'fiddle' },
  { p: [-10.6, -2.7], kind: 'bush', s: 0.9 },
  { p: [7.4, -2.7], kind: 'bush', s: 0.9 },
  { p: [-14.2, 12.9], kind: 'fiddle', s: 1.15 },
  { p: [14.2, 12.9], kind: 'fiddle', s: 1.15 },
  { p: [13.9, 7.2], kind: 'snake' },
  { p: [2.25, -8.4], kind: 'snake' },
  { p: [-6.2, 12.9], kind: 'bush' },
]

// --- zones ------------------------------------------------------------------

/** Kitchen in the back-left corner: counter with coffee machine and sink, fridge, water cooler. */
function Kitchen() {
  const [kx, kz] = KITCHEN
  return (
    <group>
      {/* base cabinets + worktop along the back wall */}
      <B p={[kx, 0.45, kz]} s={[6.4, 0.9, 0.9]} c="#b8945f" cast />
      <B p={[kx, 0.93, kz]} s={[6.5, 0.06, 1.0]} c={PAL.woodDark} />
      {[-2.4, -1.2, 0, 1.2, 2.4].map((dx) => (
        <B key={dx} p={[kx + dx, 0.5, kz + 0.46]} s={[0.06, 0.8, 0.02]} c="#6b4f2e" />
      ))}
      {/* coffee machine, mugs, sink, kettle */}
      <B p={[kx - 1.6, 1.25, kz - 0.1]} s={[0.6, 0.6, 0.5]} c={PAL.ink} cast />
      <B p={[kx - 1.6, 1.12, kz + 0.17]} s={[0.3, 0.1, 0.12]} c={PAL.metal} />
      <mesh geometry={GEO.box} material={GLOW.bulb} position={[kx - 1.45, 1.42, kz + 0.16]} scale={[0.08, 0.05, 0.02]} />
      {[-0.8, -0.55, -0.3].map((dx, i) => (
        <B key={dx} p={[kx + dx, 1.04, kz + 0.2]} s={[0.12, 0.16, 0.12]} c={[PAL.cream, PAL.brick, PAL.amber][i]!} />
      ))}
      <B p={[kx + 1.1, 0.94, kz]} s={[0.9, 0.04, 0.6]} c={PAL.metal} />
      <B p={[kx + 1.1, 1.15, kz - 0.25]} s={[0.06, 0.35, 0.06]} c={PAL.metal} />
      <C p={[kx + 2.3, 1.08, kz]} rad={0.11} h={0.26} c={PAL.teal} />
      {/* wall shelf with jars */}
      <B p={[kx, 2.1, kz - 0.32]} s={[4, 0.08, 0.35]} c={PAL.woodDark} />
      {[-1.4, -0.7, 0, 0.7, 1.4].map((dx, i) => (
        <B key={dx} p={[kx + dx, 2.28, kz - 0.32]} s={[0.22, 0.28, 0.22]} c={[PAL.amber, PAL.cream, PAL.teal, PAL.brick, PAL.cream][i]!} />
      ))}
      {/* fridge at the corner, water cooler at the far end */}
      <B p={[kx - 3.75, 1.05, kz + 0.05]} s={[1.0, 2.1, 0.95]} c="#e7ebee" cast />
      <B p={[kx - 3.75, 1.4, kz + 0.53]} s={[0.9, 0.02, 0.01]} c="#b8bec4" />
      <B p={[kx - 3.37, 1.15, kz + 0.54]} s={[0.04, 0.5, 0.03]} c={PAL.metalDark} />
      <group position={[kx + 3.9, 0, kz + 0.1]}>
        <B p={[0, 0.5, 0]} s={[0.5, 1.0, 0.5]} c="#e7ebee" cast />
        <B p={[0, 1.3, 0]} s={[0.4, 0.6, 0.4]} c="#8fc7ea" />
        <B p={[0, 0.85, 0.26]} s={[0.12, 0.06, 0.04]} c={PAL.brick} />
      </group>
      {/* bar stools */}
      {[-2.2, -0.9, 0.4].map((dx) => (
        <group key={dx} position={[kx + dx, 0, kz + 2.4]}>
          <B p={[0, 0.35, 0]} s={[0.06, 0.7, 0.06]} c={PAL.metal} />
          <B p={[0, 0.72, 0]} s={[0.4, 0.08, 0.4]} c={PAL.woodDark} />
          <B p={[0, 0.03, 0]} s={[0.36, 0.04, 0.36]} c={PAL.metalDark} />
        </group>
      ))}
    </group>
  )
}

/** Meeting corner (back-right): table, four chairs, whiteboard on the back wall. */
function Meeting() {
  const [mx, mz] = MEETING
  const seats: { x: number; z: number; r: number }[] = [
    { x: -1.35, z: 0, r: Math.PI / 2 },
    { x: 1.35, z: 0, r: -Math.PI / 2 },
    { x: -0.5, z: -1.0, r: 0 },
    { x: 0.5, z: 1.0, r: Math.PI },
  ]
  return (
    <group>
      <B p={[mx, 0.74, mz]} s={[2.0, 0.12, 1.4]} c="#7a5a3c" cast />
      <B p={[mx, 0.37, mz]} s={[0.2, 0.7, 0.2]} c={PAL.metal} />
      <B p={[mx, 0.03, mz]} s={[0.9, 0.06, 0.9]} c={PAL.metalDark} />
      {seats.map((c, i) => (
        <group key={i} position={[mx + c.x, 0, mz + c.z]} rotation={[0, c.r, 0]}>
          <B p={[0, 0.25, 0]} s={[0.06, 0.5, 0.06]} c={PAL.metal} />
          <B p={[0, 0.5, 0]} s={[0.5, 0.1, 0.5]} c="#b8945f" />
          <B p={[0, 0.8, -0.23]} s={[0.5, 0.55, 0.08]} c="#7a5a3c" />
        </group>
      ))}
      <B p={[mx - 0.3, 0.8, mz + 0.1]} s={[0.4, 0.03, 0.3]} c={PAL.ink} />
      <B p={[mx + 0.4, 0.82, mz - 0.2]} s={[0.12, 0.1, 0.12]} c={PAL.cream} />
      {/* whiteboard on the back wall */}
      <group position={[mx, 1.55, MEETING_ROOM.z0 + 0.12]}>
        <B p={[0, 0, 0]} s={[2.6, 1.2, 0.05]} c={PAL.metal} />
        <B p={[0, 0, 0.03]} s={[2.46, 1.06, 0.02]} c="#fbfbf8" />
        <B p={[-0.6, 0.25, 0.045]} s={[0.9, 0.05, 0.01]} c="#3a6fd8" />
        <B p={[-0.75, 0.08, 0.045]} s={[0.6, 0.05, 0.01]} c="#3a6fd8" />
        <B p={[0.6, 0.05, 0.045]} s={[0.6, 0.45, 0.01]} c={PAL.amber} />
        <B p={[-0.3, -0.25, 0.045]} s={[1.3, 0.05, 0.01]} c="#d84a3a" />
      </group>
    </group>
  )
}

/** Printer and recycling bin beside the server racks. */
function PrintStation() {
  const x = LEFT_WALL + 0.7
  const z = -7.2
  return (
    <group>
      <B p={[x, 0.4, z]} s={[1.2, 0.8, 0.8]} c="#e7ebee" cast />
      <B p={[x, 0.9, z]} s={[1.2, 0.2, 0.8]} c={PAL.metalDark} />
      <B p={[x - 0.2, 1.02, z + 0.05]} s={[0.6, 0.04, 0.5]} c={PAL.white} />
      <B p={[x + 0.4, 1.02, z + 0.32]} s={[0.25, 0.04, 0.1]} c={PAL.ink} />
      <mesh geometry={GEO.box} material={GLOW.screen} position={[x + 0.42, 1.04, z + 0.34]} scale={[0.15, 0.02, 0.05]} />
      <B p={[x + 1.2, 0.35, z - 0.1]} s={[0.5, 0.7, 0.5]} c="#3b7d5c" />
    </group>
  )
}

/** Long collaboration table with stools at the front centre (the walkway stays clear). */
function CollabTable() {
  const [cx, cz] = COLLAB
  return (
    <group>
      <B p={[cx, 0.02, cz]} s={[6.4, 0.04, 3.4]} c="#7f8da3" />
      <B p={[cx, 0.03, cz]} s={[5.8, 0.04, 2.8]} c="#9aa7bb" />
      <B p={[cx, 0.76, cz]} s={[4.4, 0.08, 1.3]} c={PAL.wood} cast />
      {[-2, 2].map((dx) => (
        <B key={dx} p={[cx + dx, 0.37, cz]} s={[0.1, 0.72, 1.1]} c={PAL.metalDark} />
      ))}
      {[-1.5, -0.5, 0.5, 1.5].flatMap((dx) =>
        [-1, 1].map((sz) => (
          <group key={`${dx}${sz}`} position={[cx + dx, 0, cz + sz * 1.05]}>
            <B p={[0, 0.25, 0]} s={[0.06, 0.5, 0.06]} c={PAL.metal} />
            <B p={[0, 0.52, 0]} s={[0.42, 0.08, 0.42]} c={sz < 0 ? PAL.teal : PAL.amber} />
          </group>
        )),
      )}
      <B p={[cx - 1.2, 0.82, cz + 0.2]} s={[0.5, 0.03, 0.35]} c={PAL.ink} />
      <B p={[cx + 0.8, 0.82, cz - 0.2]} s={[0.35, 0.02, 0.25]} c={PAL.white} r={0.3} />
      <B p={[cx + 1.6, 0.86, cz + 0.1]} s={[0.12, 0.14, 0.12]} c={PAL.brick} />
    </group>
  )
}

// --- night lighting ----------------------------------------------------------


const LIGHT_POOLS: { p: [number, number, number]; k: number }[] = [
  { p: [buildingX(0), 3.2, CUBE_BACK + 1.4], k: 1 },
  { p: [buildingX(1), 3.2, CUBE_BACK + 1.4], k: 1 },
  { p: [COLLAB[0], 3.0, COLLAB[1]], k: 0.9 },
  { p: [KITCHEN[0], 3.0, KITCHEN[1] + 1.6], k: 0.9 },
  { p: [MEETING[0], 3.0, MEETING[1]], k: 0.8 },
  { p: [SOFA_X - 1.5, 2.8, TV_POS[1]], k: 0.8 },
  { p: [12, 3.0, (ARCADES[1]![1] + PINGPONG[1]) / 2], k: 0.8 },
]

/**
 * Office lighting that switches on at night: pendant fixtures over every work zone plus warm
 * point lights (no shadows) whose intensity follows the night factor.
 */
function OfficeLights() {
  const lights = useMemo(() => LIGHT_POOLS.map(() => ({ ref: null as THREE.PointLight | null })), [])
  useFrame(() => {
    const n = NIGHT.value
    lights.forEach((l, i) => {
      if (!l.ref) return
      l.ref.intensity = n * 32 * LIGHT_POOLS[i]!.k
      l.ref.visible = n > 0.02
    })
  })
  return (
    <group>
      {/* No visible pendants: without a ceiling their cables read as poles standing in the room. */}
      {LIGHT_POOLS.map((l, i) => (
        <pointLight
          key={i}
          ref={(r) => void (lights[i]!.ref = r)}
          position={l.p}
          color="#ffd7a1"
          intensity={0}
          distance={12}
          decay={2}
        />
      ))}
    </group>
  )
}

/** The office furniture by zone, plus wall decor and plants. */
export function Lounge() {
  return (
    <group>
      {/* TV lounge (front-left) */}
      <WallTV />
      <Sofa />
      <BeanBag p={BEANBAGS[0]!} c="#d98fb0" />
      <BeanBag p={BEANBAGS[1]!} c="#8e6cd1" />
      <FloorLamp p={[SOFA_X - 0.3, TV_POS[1] - 2.3]} />
      <FloorLamp p={[SOFA_X - 0.3, TV_POS[1] + 2.3]} />
      {/* game corner (front-right) */}
      {ARCADES.map((p, i) => (
        <Arcade key={i} p={p} hue={[320, 200, 40][i]!} />
      ))}
      <PingPong />
      {/* work support */}
      <Kitchen />
      <Meeting />
      <PrintStation />
      <CollabTable />
      {PLANTS.map((pl, i) => (
        <Plant key={i} {...pl} />
      ))}
      <OfficeLights />
      {/* posters: beside the door and the TV, and between the back windows */}
      <Poster p={[LEFT_WALL + 0.06, 2.3, 3.7]} w={1.0} h={1.3} seed={1} side />
      <Poster p={[LEFT_WALL + 0.06, 2.3, 10.7]} w={1.4} h={1.0} seed={2} side />
      <Poster p={[-5.1, 2.5, ROOM_BACK + 0.06]} w={1.2} h={0.9} seed={3} />
      <Poster p={[9.6, 2.3, ROOM_BACK + 0.06]} w={1.0} h={0.8} seed={4} />
    </group>
  )
}
