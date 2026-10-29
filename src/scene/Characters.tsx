import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GLTFLoader, GLTFParser } from 'three-stdlib'

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

export const extendLoader = (loader: GLTFLoader) => {
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
export function extractTemplates(scene: THREE.Object3D): THREE.Object3D[] {
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

/** Shared with the UI (profile pictures), so it lives outside the 3D code. */
export { assignCharacters } from '../lib/characters'

export interface Limbs {
  legL?: THREE.Object3D
  legR?: THREE.Object3D
  armL?: THREE.Object3D
  armR?: THREE.Object3D
}

export interface Rig {
  limbs: Limbs
  /** Hip height in world units (top of the legs), used to put the hips on a seat. */
  hipY: number
}

/**
 * Rig a block character made of separate part meshes (head, body, arms, legs), using
 * geometry instead of names: legs are the two parts reaching the floor below the hips, arms are
 * the two outermost remaining parts (the highest part is the head). Each limb is re-parented
 * under a pivot at its hip or shoulder so rotating it swings from the joint.
 */
export function rigLimbs(root: THREE.Object3D): Rig | null {
  root.updateMatrixWorld(true)
  const toLocal = root.matrixWorld.clone().invert()
  const parts: { mesh: THREE.Object3D; box: THREE.Box3 }[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) parts.push({ mesh: o, box: new THREE.Box3().setFromObject(o).applyMatrix4(toLocal) })
  })
  if (parts.length < 4) return null

  const all = new THREE.Box3()
  for (const p of parts) all.union(p.box)
  const H = all.max.y - all.min.y
  const cx = (all.min.x + all.max.x) / 2
  const centre = (b: THREE.Box3) => b.getCenter(new THREE.Vector3())

  const legs = parts
    .filter((p) => p.box.min.y - all.min.y < 0.12 * H && p.box.max.y - all.min.y < 0.6 * H)
    .sort((a, b) => centre(a.box).x - centre(b.box).x)
  if (legs.length < 2) return null
  const legL = legs[0]!
  const legR = legs[legs.length - 1]!

  const head = parts.reduce((top, p) => (p.box.max.y > top.box.max.y ? p : top))
  const rest = parts
    .filter((p) => !legs.includes(p) && p !== head)
    .sort((a, b) => Math.abs(centre(b.box).x - cx) - Math.abs(centre(a.box).x - cx))
  const armA = rest[0]
  const armB = rest.find((p) => p !== armA && Math.sign(centre(p.box).x - cx) !== Math.sign(centre(armA!.box).x - cx))

  const pivot = (part: { mesh: THREE.Object3D; box: THREE.Box3 }, shoulder: boolean) => {
    const c = centre(part.box)
    const joint = new THREE.Vector3(c.x, part.box.max.y - (shoulder ? 0.06 * H : 0), c.z)
    const g = new THREE.Group()
    g.position.copy(joint)
    root.add(g)
    root.updateMatrixWorld(true)
    g.attach(part.mesh)
    return g
  }

  const limbs: Limbs = { legL: pivot(legL, false), legR: pivot(legR, false) }
  if (armA && armB) {
    const [left, right] = centre(armA.box).x < centre(armB.box).x ? [armA, armB] : [armB, armA]
    limbs.armL = pivot(left, true)
    limbs.armR = pivot(right, true)
  }
  const hipLocal = Math.max(legL.box.max.y, legR.box.max.y) - all.min.y
  return { limbs, hipY: hipLocal * root.scale.y }
}
