import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { rand } from './kit'

/** World units per voxel. */
export const S = 0.5

// --- procedural 16x16 pixel textures (original, drawn at runtime) ---------------

type Painter = (px: (x: number, y: number, c: string) => void, r: (n: number) => number) => void

function texture(seed: number, paint: Painter): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')!
  let n = seed * 1000
  const r = (k: number) => rand(n++ + k)
  paint((x, y, c) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, 1, 1)
  }, r)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Fill with a random pick from a palette per pixel. */
const speckle = (palette: string[]): Painter => (px, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, palette[Math.floor(r(x * 16 + y) * palette.length)]!)
}

const GRASS = ['#6dbf4b', '#64b345', '#78c957', '#5aa83c']
const DIRT = ['#8f6544', '#9b6f4b', '#7f5a3c', '#a07650']
const STONE = ['#8a8a8e', '#7e7e83', '#96969a', '#727277']

const PAINTERS: Record<string, Painter> = {
  grassTop: speckle(GRASS),
  dirt: speckle(DIRT),
  grassSide: (px, r) => {
    speckle(DIRT)(px, r)
    for (let x = 0; x < 16; x++) {
      const depth = 3 + Math.floor(r(x + 300) * 3)
      for (let y = 0; y < depth; y++) px(x, y, GRASS[Math.floor(r(x * 7 + y + 400) * GRASS.length)]!)
    }
  },
  stone: (px, r) => {
    speckle(STONE)(px, r)
    for (let i = 0; i < 6; i++) px(Math.floor(r(i + 500) * 16), Math.floor(r(i + 600) * 16), '#5e5e63')
  },
  cobble: (px, r) => {
    speckle(['#a9a397', '#9d978b', '#b4aea2'])(px, r)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + (y >> 2) * 3) % 5 === 0 || y % 4 === 0) px(x, y, '#7d786e')
  },
  planks: (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) px(x, y, y % 4 === 3 ? '#8f6438' : ['#c9945a', '#c08b52', '#d39e64'][Math.floor(r(x + y * 16) * 3)]!)
    for (let row = 0; row < 4; row++) px(Math.floor(r(row + 700) * 16), row * 4 + 1, '#8f6438')
  },
  planksDark: (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) px(x, y, y % 4 === 3 ? '#4f3520' : ['#7a5232', '#714b2d', '#835939'][Math.floor(r(x + y * 16) * 3)]!)
  },
  log: (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) px(x, y, x % 4 === 0 ? '#4a3220' : ['#6b4a2e', '#5f4128', '#76533a'][Math.floor(r(x * 16 + y) * 3)]!)
  },
  leaves: (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const v = r(x * 16 + y)
        px(x, y, v < 0.12 ? '#2f6b2a' : v < 0.5 ? '#4a9a3c' : v < 0.85 ? '#56a845' : '#6dbf52')
      }
  },
  brick: (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const mortar = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7
        px(x, y, mortar ? '#cfc4b4' : ['#b5543c', '#a84b35', '#c05f44'][Math.floor(r(x + y * 16) * 3)]!)
      }
  },
  plaster: speckle(['#f1e4cf', '#ece0c9', '#f5ead7']),
  teal: speckle(['#2fa59a', '#2a988e', '#35b0a4']),
  tealDark: speckle(['#227c74', '#1e726a', '#26877e']),
  amber: speckle(['#f0a63a', '#e89c31', '#f5b04a']),
  cloud: speckle(['#ffffff', '#f6f7fb', '#eef0f6']),
  rock: speckle(['#6b6874', '#625f6b', '#75727e']),
  oak: (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) px(x, y, x % 8 === 7 ? '#a77d52' : ['#ddb685', '#d6ae7c', '#e3be8f'][Math.floor(r(x + y * 16) * 3)]!)
  },
  concrete: speckle(['#bdb7ad', '#b4aea4', '#c6c0b6', '#aea89e']),
  terracotta: speckle(['#c4683f', '#b95f38', '#cf7247']),
  rack: (px, r) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const grille = y % 3 === 1 && x > 1 && x < 14
        px(x, y, x === 0 || x === 15 ? '#4a4d57' : grille ? '#14151a' : ['#2b2d35', '#272930', '#30323a'][Math.floor(r(x * 16 + y) * 3)]!)
      }
  },
  glass: (px) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || y === 0 || x === 15 || y === 15
        px(x, y, edge ? '#e8f4fb' : (x + y) % 7 === 0 && x < 9 ? '#ffffff' : '#a9d6ee')
      }
  },
}

const texCache = new Map<string, THREE.CanvasTexture>()
function tex(name: string) {
  let t = texCache.get(name)
  if (!t) {
    t = texture(name.length * 13 + name.charCodeAt(0), PAINTERS[name]!)
    texCache.set(name, t)
  }
  return t
}

export type BlockType =
  | 'grass' | 'dirt' | 'stone' | 'cobble' | 'planks' | 'planksDark' | 'log' | 'leaves'
  | 'brick' | 'plaster' | 'teal' | 'tealDark' | 'amber' | 'cloud' | 'rock' | 'glass'
  | 'oak' | 'concrete' | 'terracotta' | 'rack'

const matCache = new Map<BlockType, THREE.Material | THREE.Material[]>()

/** Material (or per-face materials) for a block type. */
export function blockMaterial(type: BlockType): THREE.Material | THREE.Material[] {
  let m = matCache.get(type)
  if (m) return m
  const make = (name: string) => new THREE.MeshStandardMaterial({ map: tex(name), roughness: 1, metalness: 0 })
  if (type === 'grass') {
    const side = make('grassSide')
    m = [side, side, make('grassTop'), make('dirt'), side, side]
  } else if (type === 'glass') {
    m = new THREE.MeshStandardMaterial({ map: tex('glass'), transparent: true, opacity: 0.75, roughness: 0.2 })
  } else {
    m = make(type)
  }
  matCache.set(type, m)
  return m
}

/** The window glass material (its colour is tinted by the day/night cycle). */
export function glassMaterial(): THREE.MeshStandardMaterial {
  return blockMaterial('glass') as THREE.MeshStandardMaterial
}

/** Pixel-noise texture for small props (tinted by the material colour). */
export function propTexture() {
  if (!texCache.has('prop')) {
    texCache.set('prop', texture(77, speckle(['#ffffff', '#f2f2f2', '#e6e6e6', '#fafafa'])))
  }
  return texCache.get('prop')!
}

// --- voxel world -------------------------------------------------------------------

/** Sparse voxel grid keyed by integer cell. Cell (i, j, k) spans [i*S, (i+1)*S] etc. */
export class VoxelWorld {
  readonly cells = new Map<string, BlockType>()

  static key(i: number, j: number, k: number) {
    return `${i},${j},${k}`
  }

  set(i: number, j: number, k: number, type: BlockType) {
    this.cells.set(VoxelWorld.key(i, j, k), type)
  }

  get(i: number, j: number, k: number) {
    return this.cells.get(VoxelWorld.key(i, j, k))
  }

  delete(i: number, j: number, k: number) {
    this.cells.delete(VoxelWorld.key(i, j, k))
  }

  /** Inclusive box in cell coordinates. */
  fill(i0: number, i1: number, j0: number, j1: number, k0: number, k1: number, type: BlockType) {
    for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++)
      for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++)
        for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) this.set(i, j, k, type)
  }
}

/** World coordinate -> cell index. */
export const cell = (v: number) => Math.floor(v / S)

const SEE_THROUGH = new Set<BlockType>(['glass', 'leaves'])
const geometry = new THREE.BoxGeometry(S, S, S)

/** Renders a VoxelWorld as one instanced mesh per block type, skipping fully hidden cells. */
export function Voxels({ world, castShadow = true }: { world: VoxelWorld; castShadow?: boolean }) {
  const groups = useMemo(() => {
    const byType = new Map<BlockType, [number, number, number][]>()
    for (const [key, type] of world.cells) {
      const [i, j, k] = key.split(',').map(Number) as [number, number, number]
      const hidden = [
        [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
      ].every(([a, b, c]) => {
        const n = world.get(i + a!, j + b!, k + c!)
        return n !== undefined && !SEE_THROUGH.has(n)
      })
      if (hidden) continue
      let list = byType.get(type)
      if (!list) byType.set(type, (list = []))
      list.push([i, j, k])
    }
    return [...byType.entries()]
  }, [world])

  return (
    <group>
      {groups.map(([type, cells]) => (
        <TypeMesh key={type} type={type} cells={cells} castShadow={castShadow && type !== 'glass'} />
      ))}
    </group>
  )
}

function TypeMesh({ type, cells, castShadow }: { type: BlockType; cells: [number, number, number][]; castShadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    cells.forEach(([i, j, k], n) => {
      m.makeTranslation((i + 0.5) * S, (j + 0.5) * S, (k + 0.5) * S)
      mesh.setMatrixAt(n, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells])
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, blockMaterial(type), cells.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    />
  )
}
