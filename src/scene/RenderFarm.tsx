import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { B, GEO, LED, mat, rand } from './kit'
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
      <AirCon renders={renders} reducedMotion={reducedMotion} />
      <Vapor renders={renders} reducedMotion={reducedMotion} />
    </group>
  )
}

/**
 * Wall-mounted air conditioner above the racks: white casing, louvred outlet with an angled
 * flap, a status light, a fan that spins faster as renders heat the room, and refrigerant
 * pipes running down to the rack roof.
 */
function AirCon({ renders, reducedMotion }: { renders: number; reducedMotion: boolean }) {
  const fan = useRef<THREE.Group>(null)
  const led = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7cf0a4', emissive: '#53e07b', emissiveIntensity: 1.2 }), [])
  useFrame((_, dt) => {
    if (fan.current && !reducedMotion) fan.current.rotation.z += dt * (2 + renders * 3)
    led.color.set(renders > 1 ? '#ffb547' : '#7cf0a4')
    led.emissive.set(renders > 1 ? '#ffb547' : '#53e07b')
  })
  const x = RACKS[0]
  const z = RACKS[1] - 0.2
  const y = 4.6
  return (
    <group>
      {/* casing: body, lighter front panel, bottom outlet */}
      <B p={[x, y, z]} s={[4.4, 0.8, 0.5]} c="#eef1f4" cast />
      <B p={[x, y + 0.03, z + 0.26]} s={[4.3, 0.64, 0.04]} c="#f8fafb" />
      <B p={[x, y - 0.34, z + 0.1]} s={[4.2, 0.1, 0.4]} c="#cfd5db" />
      {/* louvre slats along the outlet and an angled discharge flap */}
      {Array.from({ length: 7 }, (_, i) => (
        <B key={i} p={[x - 1.5 + i * 0.5, y - 0.39, z + 0.12]} s={[0.4, 0.03, 0.34]} c="#8b929b" />
      ))}
      <B p={[x, y - 0.44, z + 0.34]} s={[4.0, 0.04, 0.22]} c="#dfe3e8" r={0} />
      {/* intake grille on the front */}
      {Array.from({ length: 5 }, (_, i) => (
        <B key={i} p={[x - 1.6 + i * 0.4, y + 0.12, z + 0.29]} s={[0.3, 0.025, 0.02]} c="#b6bdc5" />
      ))}
      {/* fan drum with spinning blades, visible through the front window */}
      <B p={[x + 1.2, y + 0.02, z + 0.285]} s={[0.6, 0.5, 0.02]} c="#2b2f36" />
      <group ref={fan} position={[x + 1.2, y + 0.02, z + 0.3]}>
        <B p={[0, 0, 0]} s={[0.46, 0.06, 0.02]} c="#aab0b8" />
        <B p={[0, 0, 0]} s={[0.06, 0.46, 0.02]} c="#aab0b8" />
        <B p={[0, 0, 0]} s={[0.1, 0.1, 0.03]} c="#6b727b" />
      </group>
      {/* status light and display */}
      <B p={[x - 1.7, y - 0.12, z + 0.29]} s={[0.5, 0.14, 0.02]} c="#2b2f36" />
      <mesh geometry={GEO.box} material={led} position={[x - 1.85, y - 0.12, z + 0.305]} scale={[0.07, 0.07, 0.02]} />
      {/* refrigerant pipes down to the rack roof, with a small trunking cover */}
      {[-1.9, -1.65].map((dx) => (
        <B key={dx} p={[x + dx, 4.0, z - 0.05]} s={[0.07, 0.9, 0.07]} c={dx < -1.8 ? '#c9854a' : '#cfd5db'} />
      ))}
      <B p={[x - 1.78, 3.65, z - 0.05]} s={[0.4, 0.1, 0.2]} c="#8b929b" />
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

