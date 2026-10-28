import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GEO, PAL, mat, rand } from './kit'
import { ISLAND_RADIUS } from './layout'

const R = ISLAND_RADIUS

/** Floating island: grass cap, soil band, rock cone, hanging rocks, path stones. */
export function Island() {
  return (
    <group>
      <mesh geometry={GEO.cyl} material={mat(PAL.grass)} position={[0, -0.3, 0]} scale={[R * 2, 0.6, R * 2]} receiveShadow />
      <mesh geometry={GEO.cyl} material={mat(PAL.grassDark)} position={[0, -0.75, 0]} scale={[R * 2 + 0.3, 0.3, R * 2 + 0.3]} />
      <mesh geometry={GEO.cyl} material={mat(PAL.soil)} position={[0, -1.6, 0]} scale={[R * 1.92, 1.4, R * 1.92]} />
      <mesh geometry={GEO.cyl} material={mat(PAL.soilDark)} position={[0, -2.6, 0]} scale={[R * 1.75, 0.7, R * 1.75]} />
      <mesh geometry={GEO.cone} material={mat(PAL.rock)} position={[0, -6.4, 0]} rotation={[Math.PI, 0, 0]} scale={[R * 1.7, 7, R * 1.7]} />
      <mesh geometry={GEO.cone} material={mat(PAL.rockDark)} position={[2.5, -9.8, 1.5]} rotation={[Math.PI, 0.4, 0]} scale={[7, 5, 7]} />
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + 0.3
        const r = R * (0.7 + rand(i) * 0.2)
        const s = 1.2 + rand(i + 10) * 1.6
        return (
          <mesh
            key={i}
            geometry={GEO.ico}
            material={mat(i % 2 ? PAL.rock : PAL.rockDark)}
            position={[Math.cos(a) * r, -3.6 - rand(i + 20) * 2.5, Math.sin(a) * r]}
            scale={[s, s * 1.4, s]}
            rotation={[rand(i + 3), rand(i + 4) * 3, 0]}
          />
        )
      })}
      {/* path stones: hub to the front edge, and across the plaza */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`p${i}`} geometry={GEO.cyl6} material={mat(i % 2 ? PAL.stone : PAL.stoneDark)} position={[(rand(i) - 0.5) * 0.6, 0.03, 5.6 + i * 1.0]} scale={[1.1, 0.06, 0.9]} receiveShadow />
      ))}
      <mesh geometry={GEO.cyl} material={mat(PAL.stone)} position={[0, 0.02, 3.6]} scale={[9, 0.04, 6]} receiveShadow />
    </group>
  )
}

/** Puffy clouds drifting beneath the island. */
export function Clouds({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!group.current || reducedMotion) return
    for (const c of group.current.children) {
      c.position.x += dt * (0.4 + (c.userData.speed as number))
      if (c.position.x > 30) c.position.x = -30
    }
  })
  return (
    <group ref={group}>
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} position={[-28 + i * 9, -9 - rand(i) * 6, -8 + rand(i + 5) * 16]} userData={{ speed: rand(i + 9) * 0.5 }}>
          {[0, 1, 2, 3].map((j) => (
            <mesh
              key={j}
              geometry={GEO.ico1}
              material={mat('#f6f7fb')}
              position={[j * 1.4 - 2, rand(i * 4 + j) * 0.6, rand(i + j) * 0.8]}
              scale={2 + rand(i * 7 + j) * 1.6}
            />
          ))}
        </group>
      ))}
    </group>
  )
}
