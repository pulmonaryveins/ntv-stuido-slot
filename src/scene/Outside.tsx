import { useMemo } from 'react'
import * as THREE from 'three'
import { rand } from './kit'
import { City } from './City'

/** Outside the office: pavement, a paved plaza around the building, and the city. */

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
  const paving = useMemo(() => pixelTexture(['#b9b6ae', '#b1aea6', '#c1beb6', '#aaa8a0'], 1, 120), [])
  const cobble = useMemo(() => {
    const t = pixelTexture(['#8e9097', '#84868d', '#989aa1', '#7b7d84'], 2, 1)
    t.repeat.set(46, 38)
    return t
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial map={paving} roughness={1} />
      </mesh>
      {/* paved plaza around the office */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[46, 38]} />
        <meshStandardMaterial map={cobble} roughness={1} />
      </mesh>
    </group>
  )
}

export function Outside({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group>
      <Ground />
      <City reducedMotion={reducedMotion} />
    </group>
  )
}
