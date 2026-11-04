import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DiningChair, HighTable, Stool, Table, TaskChair } from './Furniture'
import { B, C, GEO, GLOW, NIGHT, PAL, mat, rand } from './kit'
import { ARCADES, BEANBAGS, MEETING_ROOM, SUPPLIES, COLLAB, CUBE_BACK, KITCHEN, MEETING, PINGPONG, ROOM_X, SOFA_X, TV_POS, buildingX } from './layout'

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

/** Drinks/snack vending machine on the right edge, front facing into the room (-x). */
function Vending({ p, body }: { p: [number, number]; body: string }) {
  return (
    <group position={[p[0], 0, p[1]]} rotation={[0, -Math.PI / 2, 0]}>
      <B p={[0, 1.0, 0]} s={[1.1, 2.0, 0.9]} c={body} cast />
      <B p={[0, 1.2, 0.46]} s={[0.78, 1.2, 0.04]} c={PAL.ink} />
      <mesh geometry={GEO.box} material={GLOW.screen} position={[0, 1.2, 0.485]} scale={[0.7, 1.12, 0.01]} />
      {[0.95, 1.25, 1.55].map((y) => (
        <group key={y}>
          {[-0.24, 0, 0.24].map((x, i) => (
            <B key={x} p={[x, y, 0.5]} s={[0.14, 0.2, 0.03]} c={[PAL.brick, PAL.amber, PAL.teal][(i + Math.round(y * 4)) % 3]!} />
          ))}
        </group>
      ))}
      <B p={[0.42, 1.2, 0.47]} s={[0.1, 0.5, 0.04]} c={PAL.metalDark} />
      <B p={[0, 0.3, 0.46]} s={[0.7, 0.2, 0.04]} c={PAL.ink} />
      <B p={[0, 1.93, 0.2]} s={[1.0, 0.1, 0.5]} c={PAL.metalDark} />
    </group>
  )
}

/** Two-seat bench with a steel frame and a slate cushion, facing -x. */
function Bench({ p }: { p: [number, number] }) {
  return (
    <group position={[p[0], 0, p[1]]} rotation={[0, -Math.PI / 2, 0]}>
      <B p={[0, 0.42, 0]} s={[1.8, 0.14, 0.5]} c="#4b5870" cast />
      <B p={[0, 0.8, -0.22]} s={[1.8, 0.5, 0.1]} c="#4b5870" cast />
      {[-0.8, 0.8].map((x) => (
        <B key={x} p={[x, 0.2, 0]} s={[0.08, 0.4, 0.46]} c={PAL.metalDark} />
      ))}
    </group>
  )
}

/** Recycling bin. */
function Bin({ p, c }: { p: [number, number]; c: string }) {
  return (
    <group position={[p[0], 0, p[1]]}>
      <B p={[0, 0.4, 0]} s={[0.5, 0.8, 0.5]} c={c} cast />
      <B p={[0, 0.82, 0]} s={[0.56, 0.06, 0.56]} c={PAL.metalDark} />
      <B p={[0, 0.7, 0.26]} s={[0.3, 0.08, 0.02]} c={PAL.ink} />
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
// Plants at the corners and between zones, never in a walkway.
const PLANTS: { p: [number, number]; kind: PlantKind; s?: number }[] = [
  { p: [-9.6, -15.3], kind: 'fiddle', s: 1.15 },
  { p: [8.6, -15.3], kind: 'snake' },
  { p: [-19.3, 3.4], kind: 'snake' },
  { p: [-19.3, 6.2], kind: 'fiddle' },
  { p: [-19.2, 15.3], kind: 'fiddle', s: 1.15 },
  { p: [19.2, 15.3], kind: 'fiddle', s: 1.15 },
  { p: [19.3, 4.6], kind: 'snake' },
  { p: [19.3, -7.6], kind: 'bush' },
  { p: [-11, 15.3], kind: 'bush' },
  { p: [11, 15.3], kind: 'bush' },
]

// --- zones ------------------------------------------------------------------

/** Pantry dining table: laminate top on steel legs, two chairs on each long side, napkins and a mug. */
function PantryTable({ p, seed }: { p: [number, number]; seed: number }) {
  const len = 2.2
  const seats = [-1, 1].flatMap((side) => [-0.55, 0.55].map((dx, i) => ({ dx, side, c: [PAL.teal, PAL.amber, '#4b6084', PAL.brick][(seed + i + (side > 0 ? 2 : 0)) % 4]! })))
  return (
    <group position={[p[0], 0, p[1]]}>
      <Table w={len} d={1.0} />
      {seats.map((s, i) => (
        <group key={i} position={[s.dx, 0, s.side * 0.85]} rotation={[0, s.side > 0 ? Math.PI : 0, 0]}>
          <DiningChair c={s.c} />
        </group>
      ))}
      <B p={[0, 0.82, 0]} s={[0.14, 0.1, 0.14]} c={PAL.white} />
      <C p={[-0.6, 0.83, 0.2]} rad={0.06} h={0.12} c={PAL.cream} />
      <C p={[0.6, 0.83, -0.2]} rad={0.06} h={0.12} c={seed % 2 ? PAL.amber : PAL.cream} />
      {seed % 2 === 0 && <B p={[0.3, 0.9, 0.2]} s={[0.12, 0.22, 0.12]} c={PAL.leaf} />}
    </group>
  )
}

/** Pantry in the back-left corner: full kitchen run, upper cabinets, fridge, water cooler and a high-top table. */
function Kitchen() {
  const [kx, kz] = KITCHEN
  const wallZ = kz - 0.5
  return (
    <group>
      {/* base cabinets with doors and handles, steel worktop, kick plate */}
      <B p={[kx, 0.45, kz]} s={[6.4, 0.9, 0.9]} c="#eceff2" cast />
      <B p={[kx, 0.05, kz + 0.02]} s={[6.4, 0.1, 0.9]} c={PAL.metalDark} />
      <B p={[kx, 0.93, kz]} s={[6.5, 0.06, 1.0]} c={PAL.metal} />
      {[-2.4, -1.2, 0, 1.2, 2.4].map((dx) => (
        <group key={dx}>
          <B p={[kx + dx - 0.6, 0.5, kz + 0.46]} s={[0.02, 0.78, 0.02]} c="#b6bdc5" />
          <B p={[kx + dx - 0.15, 0.62, kz + 0.47]} s={[0.04, 0.22, 0.03]} c={PAL.metalDark} />
        </group>
      ))}
      {/* upper cabinets (left) and an open shelf with jars (right) */}
      {[-1, 0, 1].map((i) => (
        <group key={i}>
          <B p={[kx - 1.7 + i * 1.0, 2.5, wallZ + 0.22]} s={[0.98, 0.95, 0.44]} c="#eceff2" cast />
          <B p={[kx - 1.7 + i * 1.0 + 0.4, 2.35, wallZ + 0.45]} s={[0.04, 0.3, 0.03]} c={PAL.metalDark} />
        </group>
      ))}
      <B p={[kx + 1.55, 2.2, wallZ + 0.18]} s={[2.6, 0.08, 0.35]} c={PAL.metalDark} />
      {[-0.9, -0.45, 0, 0.45, 0.9].map((dx, i) => (
        <B key={dx} p={[kx + 1.55 + dx, 2.4, wallZ + 0.18]} s={[0.22, 0.28, 0.22]} c={[PAL.amber, PAL.cream, PAL.teal, PAL.brick, PAL.cream][i]!} />
      ))}
      {/* coffee machine, mugs on a tray */}
      <B p={[kx - 1.6, 1.25, kz - 0.1]} s={[0.6, 0.6, 0.5]} c={PAL.ink} cast />
      <B p={[kx - 1.6, 1.12, kz + 0.17]} s={[0.3, 0.1, 0.12]} c={PAL.metal} />
      <mesh geometry={GEO.box} material={GLOW.bulb} position={[kx - 1.45, 1.42, kz + 0.16]} scale={[0.08, 0.05, 0.02]} />
      <B p={[kx - 0.55, 0.97, kz + 0.2]} s={[0.9, 0.03, 0.4]} c={PAL.metalDark} />
      {[-0.8, -0.55, -0.3].map((dx, i) => (
        <B key={dx} p={[kx + dx, 1.07, kz + 0.2]} s={[0.12, 0.16, 0.12]} c={[PAL.cream, PAL.brick, PAL.amber][i]!} />
      ))}
      {/* sink with a tall faucet, dish rack beside it */}
      <B p={[kx + 0.7, 0.95, kz]} s={[1.0, 0.04, 0.62]} c={PAL.metalDark} />
      <B p={[kx + 0.7, 0.96, kz]} s={[0.84, 0.03, 0.48]} c="#8f969f" />
      <B p={[kx + 0.7, 1.3, kz - 0.28]} s={[0.05, 0.7, 0.05]} c={PAL.metal} />
      <B p={[kx + 0.7, 1.62, kz - 0.14]} s={[0.05, 0.05, 0.3]} c={PAL.metal} />
      <B p={[kx + 1.55, 1.05, kz + 0.05]} s={[0.55, 0.14, 0.4]} c="#cfd5db" />
      {[-0.18, 0, 0.18].map((dx) => (
        <B key={dx} p={[kx + 1.55 + dx, 1.22, kz + 0.05]} s={[0.04, 0.2, 0.3]} c={PAL.white} />
      ))}
      {/* microwave, toaster, fruit bowl, paper towels */}
      <B p={[kx + 2.45, 1.18, kz - 0.05]} s={[0.7, 0.4, 0.5]} c={PAL.ink} cast />
      <B p={[kx + 2.38, 1.18, kz + 0.21]} s={[0.46, 0.28, 0.02]} c="#2b3d4a" />
      <B p={[kx + 2.7, 1.18, kz + 0.21]} s={[0.1, 0.28, 0.02]} c="#8b929b" />
      <B p={[kx + 3.0, 1.06, kz]} s={[0.4, 0.22, 0.3]} c="#cfd5db" />
      <B p={[kx + 3.0, 1.2, kz]} s={[0.3, 0.04, 0.05]} c={PAL.ink} />
      <C p={[kx - 2.6, 1.0, kz + 0.1]} rad={0.2} h={0.1} c={PAL.cream} />
      {[PAL.brick, PAL.amber, PAL.leaf].map((c, i) => (
        <B key={i} p={[kx - 2.68 + i * 0.1, 1.1, kz + 0.1 + (i % 2) * 0.05]} s={[0.1, 0.1, 0.1]} c={c} />
      ))}
      <C p={[kx - 3.0, 1.1, kz]} rad={0.07} h={0.3} c={PAL.white} />
      {/* wall clock and a small corkboard */}
      <B p={[kx + 2.9, 3.4, wallZ + 0.05]} s={[0.6, 0.6, 0.06]} c={PAL.metalDark} />
      <B p={[kx + 2.9, 3.4, wallZ + 0.09]} s={[0.5, 0.5, 0.02]} c={PAL.white} />
      <B p={[kx + 2.9, 3.5, wallZ + 0.11]} s={[0.04, 0.2, 0.01]} c={PAL.ink} />
      <B p={[kx + 2.95, 3.4, wallZ + 0.11]} s={[0.14, 0.04, 0.01]} c={PAL.ink} />
      <B p={[kx - 1.0, 3.4, wallZ + 0.05]} s={[1.3, 0.8, 0.05]} c={PAL.metalDark} />
      <B p={[kx - 1.0, 3.4, wallZ + 0.08]} s={[1.2, 0.7, 0.02]} c="#c9a36b" />
      {NOTES.map(([dx, dy, c], i) => (
        <B key={i} p={[kx - 1.0 + dx, 3.4 + dy, wallZ + 0.1]} s={[0.2, 0.2, 0.01]} c={c} />
      ))}
      {/* tall fridge at the corner (double door, handles), water cooler at the far end */}
      <B p={[kx - 3.75, 1.05, kz + 0.05]} s={[1.0, 2.1, 0.95]} c="#e7ebee" cast />
      <B p={[kx - 3.75, 1.4, kz + 0.53]} s={[0.9, 0.02, 0.01]} c="#b8bec4" />
      <B p={[kx - 3.37, 1.15, kz + 0.54]} s={[0.04, 0.5, 0.03]} c={PAL.metalDark} />
      <B p={[kx - 3.37, 1.75, kz + 0.54]} s={[0.04, 0.3, 0.03]} c={PAL.metalDark} />
      <group position={[kx + 3.9, 0, kz + 0.1]}>
        <B p={[0, 0.5, 0]} s={[0.5, 1.0, 0.5]} c="#e7ebee" cast />
        <B p={[0, 1.3, 0]} s={[0.4, 0.6, 0.4]} c="#8fc7ea" />
        <B p={[0, 0.85, 0.26]} s={[0.12, 0.06, 0.04]} c={PAL.brick} />
        <B p={[0, 0.65, 0.26]} s={[0.12, 0.06, 0.04]} c="#3b8aa8" />
      </group>
      {/* recycling and general waste bins beside the cooler */}
      <B p={[kx + 3.4, 0.35, kz + 1.0]} s={[0.45, 0.7, 0.45]} c="#3b7d5c" cast />
      <B p={[kx + 3.4, 0.72, kz + 1.0]} s={[0.5, 0.05, 0.5]} c={PAL.metalDark} />
      <B p={[kx + 3.9, 0.35, kz + 1.0]} s={[0.45, 0.7, 0.45]} c="#2f6db5" cast />
      <B p={[kx + 3.9, 0.72, kz + 1.0]} s={[0.5, 0.05, 0.5]} c={PAL.metalDark} />
      {/* dining area: four tables in two rows, clear of the break line along the counter and the walkway on the right */}
      <PantryTable p={[kx - 2.6, kz + 4.35]} seed={0} />
      <PantryTable p={[kx + 0.8, kz + 4.35]} seed={1} />
      <PantryTable p={[kx - 2.6, kz + 6.75]} seed={2} />
      <PantryTable p={[kx + 0.8, kz + 6.75]} seed={3} />
    </group>
  )
}

const NOTES: [number, number, string][] = [
  [-0.4, 0.15, '#f7e26b'],
  [0, -0.1, '#f59fb5'],
  [0.35, 0.12, '#8fd3f0'],
  [-0.2, -0.15, '#b6e388'],
]
/** Meeting room (back-right): long conference table with six chairs and a wall TV on the back wall. */
function Meeting() {
  const [mx, mz] = MEETING
  const screen = useAnimatedScreen(32, 18, (ctx, f) => {
    // A pixel slide deck: title bar, bullet lines and a bar chart that grows and steps.
    ctx.fillStyle = '#eef2f6'
    ctx.fillRect(0, 0, 32, 18)
    ctx.fillStyle = '#2f6db5'
    ctx.fillRect(0, 0, 32, 3)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(2, 1, 10, 1)
    ctx.fillStyle = '#4b5870'
    for (let i = 0; i < 4; i++) ctx.fillRect(2, 5 + i * 3, 7 + ((i * 3) % 5), 1)
    const bars = ['#2fa59a', '#e9b44c', '#d84a3a', '#5b8def']
    for (let i = 0; i < 4; i++) {
      const h = 3 + ((i * 5 + f) % 7)
      ctx.fillStyle = bars[i]!
      ctx.fillRect(18 + i * 3, 16 - h, 2, h)
    }
    ctx.fillStyle = '#8b929b'
    ctx.fillRect(17, 16, 13, 1)
  }, 1)
  const seats = [-1.8, 0, 1.8].flatMap((x) => [
    { x, z: -1.1, r: 0 },
    { x, z: 1.1, r: Math.PI },
  ])
  return (
    <group>
      {/* conference table: long laminate top with a steel edge band, trestle legs and a cable grommet */}
      <group position={[mx, 0, mz]}>
        <Table w={5.6} d={1.5} />
      </group>
      {seats.map((c, i) => (
        <group key={i} position={[mx + c.x, 0, mz + c.z]} rotation={[0, c.r, 0]}>
          <TaskChair c="#4b5870" trim="#3a4558" head />
        </group>
      ))}
      {/* on the table: speakerphone, laptops, notepads, water jug */}
      <B p={[mx, 0.8, mz]} s={[0.3, 0.04, 0.3]} c={PAL.ink} />
      <B p={[mx, 0.83, mz]} s={[0.1, 0.02, 0.1]} c={PAL.teal} />
      {[-1.8, 1.8].map((dx) => (
        <group key={dx}>
          <B p={[mx + dx, 0.8, mz - 0.45]} s={[0.4, 0.03, 0.28]} c={PAL.metal} />
          <B p={[mx + dx, 0.9, mz - 0.6]} s={[0.4, 0.2, 0.02]} c={PAL.ink} />
          <B p={[mx + dx, 0.8, mz + 0.45]} s={[0.3, 0.02, 0.22]} c={PAL.white} r={dx * 0.05} />
        </group>
      ))}
      <B p={[mx - 0.8, 0.86, mz + 0.1]} s={[0.12, 0.14, 0.12]} c="#8fc7ea" />
      <B p={[mx + 0.8, 0.84, mz - 0.1]} s={[0.12, 0.1, 0.12]} c={PAL.cream} />
      {/* wall TV with a media credenza, on the back wall */}
      <group position={[mx, 2.3, MEETING_ROOM.z0 + 0.12]}>
        <B p={[0, 0, 0]} s={[3.8, 2.1, 0.12]} c={PAL.ink} cast />
        <mesh geometry={GEO.plane} position={[0, 0, 0.07]} scale={[3.6, 1.9, 1]}>
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
        <B p={[0, -1.12, 0.02]} s={[0.5, 0.14, 0.06]} c={PAL.metalDark} />
      </group>
      <B p={[mx, 0.4, MEETING_ROOM.z0 + 0.35]} s={[3.6, 0.8, 0.5]} c="#3d424b" cast />
      <B p={[mx, 0.82, MEETING_ROOM.z0 + 0.35]} s={[3.7, 0.04, 0.55]} c={PAL.metal} />
      <B p={[mx + 1.2, 0.96, MEETING_ROOM.z0 + 0.35]} s={[0.4, 0.2, 0.3]} c={PAL.ink} />
    </group>
  )
}

/** Supplies corner on the right edge: printer, recycling bin and two shelves of folders. */
function PrintStation() {
  const [sx, sz] = SUPPLIES
  const x = sx - 0.9
  const z = sz
  return (
    <group>
      {[-2.2, 2.2].map((dz) => (
        <group key={dz} position={[sx, 0, sz + dz]}>
          <B p={[0, 1.1, 0]} s={[0.7, 2.2, 1.6]} c="#3d424b" cast />
          {[0.45, 1.05, 1.65].map((y, i) => (
            <group key={y}>
              <B p={[-0.36, y, 0]} s={[0.04, 0.06, 1.5]} c="#23262c" />
              {[-0.5, -0.2, 0.1, 0.4].map((bz, j) => (
                <B key={bz} p={[-0.2, y + 0.22, bz]} s={[0.3, 0.38, 0.2]} c={['#c0392b', '#2f6db5', '#e9b44c', '#3c8527'][(i + j) % 4]!} />
              ))}
            </group>
          ))}
        </group>
      ))}
      <B p={[x, 0.4, z]} s={[1.2, 0.8, 0.8]} c="#e7ebee" cast />
      <B p={[x, 0.9, z]} s={[1.2, 0.2, 0.8]} c={PAL.metalDark} />
      <B p={[x - 0.2, 1.02, z + 0.05]} s={[0.6, 0.04, 0.5]} c={PAL.white} />
      <B p={[x + 0.4, 1.02, z + 0.32]} s={[0.25, 0.04, 0.1]} c={PAL.ink} />
      <mesh geometry={GEO.box} material={GLOW.screen} position={[x + 0.42, 1.04, z + 0.34]} scale={[0.15, 0.02, 0.05]} />
      <B p={[x + 1.2, 0.35, z - 0.1]} s={[0.5, 0.7, 0.5]} c="#3b7d5c" />
    </group>
  )
}

/** Casual breakout area at the front centre: three high-top tables with stools (walkway stays clear). */
function CollabTable() {
  const [cx, cz] = COLLAB
  return (
    <group>
      {/* carpet inlay with a light border */}
      <B p={[cx, 0.02, cz]} s={[10.6, 0.04, 4.4]} c="#cfd5db" />
      <B p={[cx, 0.03, cz]} s={[10.2, 0.04, 4.0]} c="#3f5170" />
      <B p={[cx, 0.04, cz]} s={[9.4, 0.04, 3.2]} c="#4b6084" />
      {[-3.2, 0, 3.2].map((dx, t) => (
        <group key={dx} position={[cx + dx, 0, cz]}>
          <HighTable />
          {[-0.85, 0.85].map((dz) => (
            <group key={dz} position={[0, 0, dz]}>
              <Stool c={[PAL.teal, PAL.amber, '#4b6084'][(t + (dz > 0 ? 1 : 0)) % 3]!} />
            </group>
          ))}
          <C p={[0.15, 1.19, 0.1]} rad={0.06} h={0.12} c={PAL.cream} />
          {t === 1 && <B p={[-0.15, 1.16, -0.1]} s={[0.3, 0.02, 0.22]} c={PAL.ink} />}
          {t !== 1 && <B p={[-0.2, 1.22, 0]} s={[0.12, 0.18, 0.12]} c={t === 0 ? PAL.leaf : PAL.leafLight} />}
        </group>
      ))}
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
  { p: [16, 3.0, (ARCADES[1]![1] + PINGPONG[1]) / 2], k: 0.8 },
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
      l.ref.intensity = n * 55 * LIGHT_POOLS[i]!.k
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
          distance={16}
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
      <Vending p={[ROOM_X - 0.7, 1.6]} body="#c0392b" />
      <Vending p={[ROOM_X - 0.7, 2.85]} body="#2f6db5" />
      <Bench p={[ROOM_X - 0.5, 13.2]} />
      <Bin p={[ROOM_X - 0.5, 5.9]} c="#3b7d5c" />
      <Bin p={[ROOM_X - 0.5, 11.6]} c="#2f6db5" />
      {/* work support */}
      <Kitchen />
      <Meeting />
      <PrintStation />
      <CollabTable />
      {PLANTS.map((pl, i) => (
        <Plant key={i} {...pl} />
      ))}
      <OfficeLights />
      {/* posters on the solid wall bays */}
      <Poster p={[LEFT_WALL + 0.06, 2.3, 4.9]} w={1.0} h={1.3} seed={1} side />
      <Poster p={[LEFT_WALL + 0.06, 2.3, -13.6]} w={1.4} h={1.0} seed={2} side />
    </group>
  )
}
