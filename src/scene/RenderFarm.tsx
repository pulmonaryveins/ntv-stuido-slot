import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { B, C, GEO, GLOW, LED, PAL, mat, rand } from './kit'
import { TOWER } from './layout'

const SMOKE_POOL = 28
const CHIMNEY_TOP: [number, number, number] = [TOWER[0] + 1.1, 9.4, TOWER[1] - 0.6]

/** Render-farm tower: server LEDs blink, smoke and turbines scale with active renders. */
export function RenderFarm({ renders, reducedMotion }: { renders: number; reducedMotion: boolean }) {
  const [tx, tz] = TOWER
  const leds = useMemo(() => {
    const out: { p: [number, number, number]; m: number }[] = []
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 4; col++) out.push({ p: [tx - 0.75 + col * 0.5, 1.2 + row * 0.55, tz + 1.42], m: (row * 4 + col) % 3 })
    return out
  }, [tx, tz])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    LED.forEach((m, i) => {
      const rate = 1.5 + i + renders * 1.5
      m.emissiveIntensity = reducedMotion ? 0.8 : 0.3 + (Math.sin(t * rate + i * 2) > 0 ? 1.2 : 0)
    })
  })

  return (
    <group>
      {/* tower */}
      <B p={[tx, 0.3, tz]} s={[3.8, 0.6, 3.4]} c={PAL.stoneDark} />
      <B p={[tx, 2.6, tz]} s={[2.6, 4.2, 2.8]} c={PAL.brick} cast />
      <B p={[tx, 5.1, tz]} s={[2.9, 0.3, 3.1]} c={PAL.woodDark} cast />
      <B p={[tx, 6.4, tz]} s={[2.3, 2.3, 2.4]} c={PAL.plaster} cast />
      <B p={[tx, 7.65, tz]} s={[2.7, 0.25, 2.8]} c={PAL.tealDark} cast />
      <mesh geometry={GEO.cone} material={mat(PAL.teal)} position={[tx, 8.4, tz]} rotation={[0, Math.PI / 4, 0]} scale={[3.4, 1.3, 3.4]} castShadow />
      {/* server bay with LEDs */}
      <B p={[tx, 2.6, tz + 1.38]} s={[2.2, 3.4, 0.06]} c={PAL.ink} />
      {leds.map((l, i) => (
        <mesh key={i} geometry={GEO.box} material={LED[l.m]} position={l.p} scale={[0.32, 0.08, 0.04]} />
      ))}
      {/* glowing upper windows */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} geometry={GEO.box} material={GLOW.window} position={[tx + x, 6.5, tz + 1.21]} scale={[0.6, 0.9, 0.04]} />
      ))}
      {/* chimney */}
      <C p={[CHIMNEY_TOP[0], 7.6, CHIMNEY_TOP[2]]} rad={0.32} h={3.6} c={PAL.brickDark} cast />
      <C p={[CHIMNEY_TOP[0], 9.45, CHIMNEY_TOP[2]]} rad={0.4} h={0.2} c={PAL.ink} />
      {/* pipes + generator */}
      <C p={[tx - 2.2, 0.7, tz + 0.6]} rad={0.5} h={1.4} c={PAL.metal} cast />
      <B p={[tx - 2.2, 1.5, tz + 0.6]} s={[0.9, 0.2, 0.9]} c={PAL.amber} />
      <B p={[tx + 2.3, 0.6, tz + 0.4]} s={[1.0, 1.2, 1.4]} c={PAL.tealDark} cast />
      <B p={[tx + 1.6, 1.0, tz + 0.4]} s={[0.6, 0.12, 0.12]} c={PAL.metalDark} />
      <Smoke renders={renders} reducedMotion={reducedMotion} />
      <Turbine p={[-4.8, -10.6]} renders={renders} reducedMotion={reducedMotion} h={6.5} />
      <Turbine p={[5.0, -10.2]} renders={renders} reducedMotion={reducedMotion} h={5.5} phase={1} />
      <Turbine p={[-12.2, -2.6]} renders={renders} reducedMotion={reducedMotion} h={5} phase={2} />
    </group>
  )
}

function Smoke({ renders, reducedMotion }: { renders: number; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const state = useMemo(() => Array.from({ length: SMOKE_POOL }, (_, i) => ({ life: rand(i) * 4, seed: i })), [])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const active = reducedMotion ? 2 : Math.min(SMOKE_POOL, 4 + renders * 8)
    const rate = 1 + renders * 0.35
    g.children.forEach((child, i) => {
      const puff = state[i]!
      if (i >= active) {
        child.visible = false
        return
      }
      puff.life += dt * rate
      if (puff.life > 4) puff.life -= 4
      const t = puff.life / 4
      child.visible = true
      child.position.set(
        CHIMNEY_TOP[0] + Math.sin(puff.seed + t * 3) * 0.4 + t * 1.6,
        CHIMNEY_TOP[1] + t * 4.5,
        CHIMNEY_TOP[2] + Math.cos(puff.seed) * 0.3 * t,
      )
      const s = Math.sin(t * Math.PI) * (0.6 + renders * 0.15) + 0.05
      child.scale.setScalar(s)
    })
  })

  return (
    <group ref={group}>
      {state.map((p) => (
        <mesh key={p.seed} geometry={GEO.ico} material={mat(p.seed % 2 ? '#e9e6ef' : '#d4d1dc')} />
      ))}
    </group>
  )
}

function Turbine({ p, h, renders, reducedMotion, phase = 0 }: { p: [number, number]; h: number; renders: number; reducedMotion: boolean; phase?: number }) {
  const rotor = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!rotor.current) return
    const speed = reducedMotion ? 0.2 : 0.6 + renders * 1.4
    rotor.current.rotation.z += dt * speed
  })
  return (
    <group position={[p[0], 0, p[1]]} rotation={[0, 0.5, 0]}>
      <C p={[0, 0.15, 0]} rad={0.5} h={0.3} c={PAL.stoneDark} />
      <mesh geometry={GEO.cyl6} material={mat(PAL.cream)} position={[0, h / 2, 0]} scale={[0.32, h, 0.32]} castShadow />
      <B p={[0, h, 0.1]} s={[0.4, 0.4, 0.9]} c={PAL.cream} cast />
      <group ref={rotor} position={[0, h, 0.6]} rotation={[0, 0, phase]}>
        <mesh geometry={GEO.ico} material={mat(PAL.brick)} scale={0.3} />
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            geometry={GEO.box}
            material={mat(PAL.white)}
            rotation={[0, 0, (i * Math.PI * 2) / 3]}
            position={[Math.cos((i * Math.PI * 2) / 3 + Math.PI / 2) * 1.2, Math.sin((i * Math.PI * 2) / 3 + Math.PI / 2) * 1.2, 0]}
            scale={[0.22, 2.4, 0.05]}
            castShadow
          />
        ))}
      </group>
    </group>
  )
}
