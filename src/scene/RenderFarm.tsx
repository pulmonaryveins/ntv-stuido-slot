import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GEO, LED, mat, rand } from './kit'
import { RACKS } from './layout'

const VAPOR_POOL = 28
/** Rack block is voxels (world.ts): x in [-2, 2], z in [-12.5, -11.5], height 3. */
const RACK_FRONT = RACKS[1] + 0.5 + 0.02
const RACK_TOP: [number, number, number] = [RACKS[0], 3.6, RACKS[1]]

/** Render farm corner: rack LEDs blink, heat vapor and vapor scales with active renders. */
export function RenderFarm({ renders, reducedMotion }: { renders: number; reducedMotion: boolean }) {
  const leds = useMemo(() => {
    const out: { p: [number, number, number]; m: number }[] = []
    for (let col = 0; col < 8; col++)
      for (let row = 0; row < 6; row++) out.push({ p: [RACKS[0] - 1.75 + col * 0.5, 0.35 + row * 0.45, RACK_FRONT], m: (row + col * 2) % 3 })
    return out
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    LED.forEach((m, i) => {
      const rate = 1.5 + i + renders * 1.5
      m.emissiveIntensity = reducedMotion ? 0.8 : 0.3 + (Math.sin(t * rate + i * 2) > 0 ? 1.2 : 0)
    })
  })

  return (
    <group>
      {leds.map((l, i) => (
        <mesh key={i} geometry={GEO.box} material={LED[l.m]} position={l.p} scale={[0.22, 0.06, 0.03]} />
      ))}
      <Vapor renders={renders} reducedMotion={reducedMotion} />
    </group>
  )
}

/** Heat haze rising off the racks: more puffs while renders run. */
function Vapor({ renders, reducedMotion }: { renders: number; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const state = useMemo(() => Array.from({ length: VAPOR_POOL }, (_, i) => ({ life: rand(i) * 3, seed: i })), [])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const active = reducedMotion ? Math.min(2, renders * 2) : Math.min(VAPOR_POOL, 2 + renders * 8)
    g.children.forEach((child, i) => {
      const puff = state[i]!
      if (i >= active) {
        child.visible = false
        return
      }
      puff.life = (puff.life + dt * (0.8 + renders * 0.3)) % 3
      const t = puff.life / 3
      child.visible = true
      child.position.set(
        RACK_TOP[0] + (rand(puff.seed) - 0.5) * 3.6 + Math.sin(t * 4 + puff.seed) * 0.15,
        RACK_TOP[1] + t * 1.8,
        RACK_TOP[2] + t * 0.8,
      )
      child.scale.setScalar(Math.sin(t * Math.PI) * (0.35 + renders * 0.08) + 0.02)
    })
  })

  return (
    <group ref={group}>
      {state.map((p) => (
        <mesh key={p.seed} geometry={GEO.box} material={mat(p.seed % 2 ? '#eef0f6' : '#dfe2ea')} />
      ))}
    </group>
  )
}

