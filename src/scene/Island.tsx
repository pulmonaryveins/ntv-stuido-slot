import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rand } from './kit'
import { Voxels } from './voxel'
import { buildWorld, cloudWorld } from './world'

/** The static blocky world (island, plaza, studios, tower, trees), built once. */
export function World({ buildings }: { buildings: number }) {
  const world = useMemo(() => buildWorld(buildings), [buildings])
  return <Voxels world={world} />
}

/** Flat blocky clouds drifting beneath the island. */
export function Clouds({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const clouds = useMemo(() => Array.from({ length: 6 }, (_, i) => cloudWorld(i + 1)), [])
  useFrame((_, dt) => {
    if (!group.current || reducedMotion) return
    for (const c of group.current.children) {
      c.position.x += dt * (0.4 + (c.userData.speed as number))
      if (c.position.x > 32) c.position.x = -32
    }
  })
  return (
    <group ref={group}>
      {clouds.map((w, i) => (
        <group key={i} position={[-28 + i * 11, -10 - rand(i) * 5, -9 + rand(i + 5) * 18]} userData={{ speed: rand(i + 9) * 0.5 }}>
          <Voxels world={w} castShadow={false} />
        </group>
      ))}
    </group>
  )
}
