import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GLTFLoader, GLTFParser } from 'three-stdlib'
import type { Profile } from '../data'
import { hashString } from './kit'

/** Optional character pack. The app only loads it at runtime; it is gitignored, not bundled. */
export const CHARACTER_URL = '/models/superhero_minecraft_character.glb'
const TARGET_HEIGHT = 1.6

const SPEC_GLOSS = 'KHR_materials_pbrSpecularGlossiness'

/**
 * three.js dropped the legacy specular-glossiness material extension, which leaves such models
 * untextured (white). This plugin maps its diffuse colour/texture onto a standard material.
 */
class SpecGlossFallback {
  readonly name = SPEC_GLOSS
  private readonly parser: GLTFParser
  constructor(parser: GLTFParser) {
    this.parser = parser
  }
  extendMaterialParams(materialIndex: number, params: Record<string, unknown>) {
    const def = (this.parser.json as { materials?: { extensions?: Record<string, SpecGlossDef> }[] }).materials?.[materialIndex]
    const ext = def?.extensions?.[SPEC_GLOSS]
    if (!ext) return Promise.resolve()
    const f = ext.diffuseFactor
    if (Array.isArray(f)) {
      params.color = new THREE.Color().setRGB(f[0] ?? 1, f[1] ?? 1, f[2] ?? 1, THREE.LinearSRGBColorSpace)
      params.opacity = f[3] ?? 1
    }
    params.metalness = 0
    params.roughness = 1 - (ext.glossinessFactor ?? 0.1)
    if (!ext.diffuseTexture) return Promise.resolve()
    return Promise.resolve(this.parser.assignTexture(params, 'map', ext.diffuseTexture)).then(() => {
      const map = params.map as THREE.Texture | undefined
      if (map) map.colorSpace = THREE.SRGBColorSpace
    })
  }
}

interface SpecGlossDef {
  diffuseFactor?: number[]
  diffuseTexture?: { index: number }
  glossinessFactor?: number
}

const extendLoader = (loader: GLTFLoader) => {
  // drei's loader is three-stdlib's GLTFLoader; its plugin type is looser than this class.
  loader.register((parser) => new SpecGlossFallback(parser) as never)
}

const hasMesh = (o: THREE.Object3D) => {
  let found = false
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) found = true
  })
  return found
}

/**
 * Split the pack into individual characters: descend through single-child wrappers, then
 * treat each child that contains meshes as one character. Each template is re-centred so its
 * feet sit at the origin, and scaled to avatar height.
 */
function extractTemplates(scene: THREE.Object3D): THREE.Object3D[] {
  scene.updateMatrixWorld(true)
  let root = scene
  while (root.children.length === 1 && !(root.children[0] as THREE.Mesh).isMesh) root = root.children[0]!
  const parts = root.children.filter(hasMesh)
  const list = parts.length >= 2 ? parts : [root]

  return list.map((part) => {
    const holder = new THREE.Group()
    const copy = cloneSkinned(part)
    if (part.parent) copy.applyMatrix4(part.parent.matrixWorld)
    holder.add(copy)
    holder.updateMatrixWorld(true)
    // precise=true uses posed (skinned) vertex positions, not the bind-pose bounds.
    const box = new THREE.Box3().setFromObject(holder, true)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    copy.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z))
    holder.scale.setScalar(TARGET_HEIGHT / Math.max(size.y, 1e-3))
    holder.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      // Skinned meshes keep bounding spheres from their original spot in the pack, which makes
      // them pop out of view as the camera moves. There are only a handful, so skip culling.
      mesh.frustumCulled = false
      // Crisp pixel-art textures.
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const map = (m as THREE.MeshStandardMaterial).map
        if (map) {
          map.magFilter = THREE.NearestFilter
          map.minFilter = THREE.NearestMipmapNearestFilter
          map.needsUpdate = true
        }
      }
    })
    return holder
  })
}

const templateCache = new WeakMap<object, THREE.Object3D[]>()

/** Suspends until the pack is loaded; returns one template per character. */
export function useCharacterTemplates(): THREE.Object3D[] {
  const { scene } = useGLTF(CHARACTER_URL, true, true, extendLoader)
  let templates = templateCache.get(scene)
  if (!templates) {
    templates = extractTemplates(scene)
    templateCache.set(scene, templates)
  }
  return templates
}

/** A fresh, independently animatable copy of a template. */
export function instantiate(template: THREE.Object3D): THREE.Object3D {
  return cloneSkinned(template)
}

/**
 * Random-but-stable character per user. Users are processed in sign-up order so a new user
 * never changes anyone else's character; each takes their hash-picked character, or the next
 * free one, and characters only repeat once every one is in use.
 */
export function assignCharacters(profiles: Profile[], count: number): Map<string, number> {
  const out = new Map<string, number>()
  if (count === 0) return out
  const used = new Set<number>()
  const ordered = [...profiles].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  for (const p of ordered) {
    if (used.size >= count) used.clear()
    let idx = hashString(p.id) % count
    while (used.has(idx)) idx = (idx + 1) % count
    used.add(idx)
    out.set(p.id, idx)
  }
  return out
}

export interface Limbs {
  legL?: THREE.Object3D
  legR?: THREE.Object3D
  armL?: THREE.Object3D
  armR?: THREE.Object3D
}

/** Find limb bones/nodes by common naming (e.g. LeftLeg, leg_r, Arm.L) so walking/sitting can animate them. */
export function findLimbs(root: THREE.Object3D): Limbs {
  const limbs: Limbs = {}
  root.traverse((o) => {
    const n = o.name.toLowerCase().replace(/[^a-z]/g, '')
    if (!n) return
    const left = /^(left|l)(leg|arm)|(leg|arm)(left|l)$/.exec(n)
    const right = /^(right|r)(leg|arm)|(leg|arm)(right|r)$/.exec(n)
    const part = (left ?? right)?.slice(1).find((g) => g === 'leg' || g === 'arm')
    if (!part) return
    const key = `${part}${left ? 'L' : 'R'}` as keyof Limbs
    if (!limbs[key]) limbs[key] = o
  })
  return limbs
}
