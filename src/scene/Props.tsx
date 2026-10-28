import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { B, C, GEO, GLOW, PAL, mat, rand } from './kit'
import { ARCADE_X, ARCADE_Z, BEANBAGS, CART, PINGPONG, ROOM_BACK, ROOM_X, SOFA_X, TV_POS } from './layout'

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
    <group position={[SOFA_X - 0.25, 0, 6.6]}>
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
function Arcade({ x, hue }: { x: number; hue: number }) {
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
    <group position={[x, 0, ARCADE_Z]}>
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

export function CoffeeCart() {
  return (
    <group position={[CART[0], 0, CART[1]]} rotation={[0, -0.5, 0]}>
      <B p={[0, 0.7, 0]} s={[1.8, 0.9, 1]} c={PAL.teal} cast />
      <B p={[0, 1.2, 0]} s={[1.9, 0.1, 1.1]} c={PAL.woodDark} />
      <C p={[-0.6, 0.25, 0.55]} rad={0.25} h={0.08} c={PAL.ink} rotation={[Math.PI / 2, 0, 0]} />
      <C p={[0.6, 0.25, 0.55]} rad={0.25} h={0.08} c={PAL.ink} rotation={[Math.PI / 2, 0, 0]} />
      <C p={[-0.5, 1.45, 0]} rad={0.18} h={0.4} c={PAL.metal} />
      <C p={[0.1, 1.35, 0.2]} rad={0.08} h={0.2} c={PAL.cream} />
      <C p={[0.35, 1.35, 0.2]} rad={0.08} h={0.2} c={PAL.amber} />
      <C p={[0, 1.6, -0.45]} rad={0.04} h={1.6} c={PAL.woodDark} />
      {[0, 1, 2, 3].map((i) => (
        <B key={i} p={[-0.75 + i * 0.5, 2.45, 0]} s={[0.5, 0.08, 1.4]} c={i % 2 ? PAL.cream : PAL.brick} r={0} cast />
      ))}
      <mesh geometry={GEO.ico} material={GLOW.bulb} position={[0, 2.25, 0.3]} scale={0.16} />
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

/** The lounge where waiting users hang out, plus wall decor. */
export function Lounge() {
  return (
    <group>
      <WallTV />
      <Sofa />
      {ARCADE_X.map((x, i) => (
        <Arcade key={x} x={x} hue={i ? 200 : 320} />
      ))}
      <PingPong />
      <BeanBag p={BEANBAGS[0]!} c="#d98fb0" />
      <BeanBag p={BEANBAGS[1]!} c="#8e6cd1" />
      <CoffeeCart />
      <FloorLamp p={[-12.4, 9.4]} />
      <FloorLamp p={[-12.4, 3.6]} />
      <FloorLamp p={[3.6, 12.6]} />
      {/* central rug where people walk through */}
      <B p={[0, 0.02, 6.6]} s={[7.5, 0.04, 5]} c={PAL.cream} />
      <B p={[0, 0.03, 6.6]} s={[6.9, 0.04, 4.4]} c="#c97b4f" />
      <B p={[0, 0.04, 6.6]} s={[5.2, 0.04, 2.8]} c="#e2b36a" />
      {/* posters */}
      <Poster p={[LEFT_WALL + 0.06, 2.4, -1.4]} w={1.6} h={1.2} seed={1} side />
      <Poster p={[LEFT_WALL + 0.06, 2.2, 1.6]} w={1.2} h={1.6} seed={2} side />
      <Poster p={[-8.25, 4.2, ROOM_BACK + 0.06]} w={1.6} h={1.0} seed={3} />
      <Poster p={[8.5, 4.2, ROOM_BACK + 0.06]} w={1.6} h={1.0} seed={4} />
    </group>
  )
}
