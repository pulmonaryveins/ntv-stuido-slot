import { useMemo } from 'react'
import * as THREE from 'three'
import { rand } from './kit'
import { Village } from './Village'

/** Outside the office: grass, a cobblestone yard around the building, and the village. */

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
  const cobble = useMemo(() => {
    const t = pixelTexture(['#8f8f8f', '#7d7d7d', '#9b9b9b', '#727272'], 2, 1)
    t.repeat.set(36, 32)
    return t
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {/* cobblestone yard around the office */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0.5]} receiveShadow>
        <planeGeometry args={[36, 33]} />
        <meshStandardMaterial map={cobble} roughness={1} />
      </mesh>
    </group>
  )
}

/** Night glow materials outside the office (the village lanterns use the shared lamp glow). */
export const CITY_GLOW: THREE.MeshStandardMaterial[] = []

export function Outside(_props: { reducedMotion: boolean }) {
  return (
    <group>
      <Ground />
      <Village />
    </group>
  )
}
