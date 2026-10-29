import * as THREE from 'three'
import { GLTFLoader } from 'three-stdlib'
import { CHARACTER_URL, extendLoader, extractTemplates, instantiate } from './Characters'

/**
 * Profile pictures from the character pack: each character's head rendered front-on into a
 * small PNG. Rendered once, then cached in localStorage so later visits skip the model load.
 * Loaded lazily (dynamic import) so the list view never pays for three.js up front.
 */

const CACHE_KEY = 'ss.portraits.v1'
const SIZE = 96

function readCache(): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as unknown
    return Array.isArray(v) && v.length && v.every((x) => typeof x === 'string') ? (v as string[]) : null
  } catch {
    return null
  }
}

function writeCache(list: string[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list))
  } catch {
    /* storage full or blocked: portraits are simply re-rendered next time */
  }
}

/** Head of a template: the top quarter of its bounds (blocky characters have cube heads). */
function headBox(obj: THREE.Object3D) {
  obj.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(obj, true)
  const h = box.max.y - box.min.y
  return new THREE.Box3(new THREE.Vector3(box.min.x, box.max.y - h * 0.27, box.min.z), box.max.clone())
}

export async function loadPortraits(): Promise<string[]> {
  const cached = readCache()
  if (cached) return cached

  const loader = new GLTFLoader()
  extendLoader(loader as never)
  const gltf = await loader.loadAsync(CHARACTER_URL)
  const templates = extractTemplates(gltf.scene)

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true })
  renderer.setSize(SIZE, SIZE)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight('#ffffff', 1.6))
  const sun = new THREE.DirectionalLight('#ffffff', 1.8)
  sun.position.set(2, 3, 4)
  scene.add(sun)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50)

  const out: string[] = []
  for (const t of templates) {
    const model = instantiate(t)
    scene.add(model)
    const head = headBox(model)
    const c = head.getCenter(new THREE.Vector3())
    const size = head.getSize(new THREE.Vector3())
    const half = Math.max(size.x, size.y) * 0.62
    camera.left = -half
    camera.right = half
    camera.top = half
    camera.bottom = -half
    camera.updateProjectionMatrix()
    // Slightly from the right and above, so the cube head reads as 3D.
    camera.position.set(c.x + 1.4, c.y + 0.9, c.z + 4)
    camera.lookAt(c)
    renderer.render(scene, camera)
    out.push(renderer.domElement.toDataURL('image/png'))
    scene.remove(model)
  }
  renderer.dispose()
  renderer.forceContextLoss()
  if (out.length) writeCache(out)
  return out
}
