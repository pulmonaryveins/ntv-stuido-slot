import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Profile } from '../data'
import { resolveCharacter, type Look } from '../lib/look'
import { BlockyFigure, type LimbKey } from './BlockyFigure'
import { assignCharacters, instantiate, rigLimbs, useCharacterTemplates } from './Characters'
import { GEO, mat } from './kit'

export type PreviewPose = 'idle' | 'walk' | 'wave'
type Limbs = Partial<Record<LimbKey, { o: THREE.Object3D; rx: number; rz: number }>>

interface FigureProps {
  profile: Profile
  profiles: Profile[]
  /** Character code being edited (null = automatic). */
  draft: string | null
  pose: PreviewPose
  reducedMotion: boolean
}

/**
 * Preview for the character editor: the draft character on a grass block. Drag to turn it; it
 * spins slowly on its own and hops whenever the draft changes. Lazy-loaded (three.js).
 */
export default function CharacterPreview({ heroes, ...props }: FigureProps & { /** Character pack available. */ heroes: boolean }) {
  const blocky = <Figure {...props} templates={null} />
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.55, 4.4], fov: 32 }} gl={{ antialias: true, alpha: true }} aria-label="Character preview. Drag to turn.">
      <hemisphereLight args={['#fff6e0', '#7fae5a', 1.5]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} />
      <OrbitControls
        target={[0, 1.15, 0]}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 2 - 0.45}
        maxPolarAngle={Math.PI / 2 + 0.05}
        autoRotate={!props.reducedMotion}
        autoRotateSpeed={1.6}
        enableDamping
      />
      <GrassBlock />
      {heroes ? (
        <Suspense fallback={blocky}>
          <HeroAware {...props} />
        </Suspense>
      ) : (
        blocky
      )}
    </Canvas>
  )
}

function HeroAware(props: FigureProps) {
  const templates = useCharacterTemplates()
  return <Figure {...props} templates={templates} />
}

function Figure({ profile, profiles, draft, pose, reducedMotion, templates }: FigureProps & { templates: THREE.Object3D[] | null }) {
  const auto = useMemo(() => (templates ? assignCharacters(profiles, templates.length).get(profile.id) : undefined), [templates, profiles, profile.id])
  const ch = resolveCharacter({ ...profile, character: draft }, templates?.length ?? 0, auto)
  const template = ch.kind === 'hero' ? (templates?.[ch.index] ?? null) : null
  const lookKey = ch.kind === 'blocky' ? JSON.stringify(ch.look) : ''
  // Stable object while the look is unchanged, so the skin texture is not rebuilt every frame.
  const look = useMemo<Look | null>(() => (lookKey ? (JSON.parse(lookKey) as Look) : null), [lookKey])

  const { model, rig } = useMemo(() => {
    if (!template) return { model: null, rig: null }
    const m = instantiate(template)
    return { model: m, rig: rigLimbs(m) }
  }, [template])

  const root = useRef<THREE.Group>(null)
  const limbs = useRef<Limbs>({})
  const hopAt = useRef(-10)
  useEffect(() => {
    hopAt.current = performance.now() / 1000
  }, [draft])
  useEffect(() => {
    if (!rig) return
    limbs.current = {}
    for (const k of ['legL', 'legR', 'armL', 'armR'] as const) {
      const o = rig.limbs[k]
      if (o) limbs.current[k] = { o, rx: o.rotation.x, rz: o.rotation.z }
    }
  }, [rig])
  const limbRef = (k: LimbKey) => (o: THREE.Object3D | null) => {
    if (model) return
    if (o) limbs.current[k] = { o, rx: 0, rz: 0 }
    else delete limbs.current[k]
  }

  useFrame(({ clock }) => {
    const g = root.current
    if (!g) return
    const t = clock.elapsedTime
    const since = performance.now() / 1000 - hopAt.current
    const hop = !reducedMotion && since < 0.45 ? Math.sin((since / 0.45) * Math.PI) * 0.28 : 0
    const p: Record<LimbKey, number> = { legL: 0, legR: 0, armL: 0, armR: 0 }
    let bob = 0
    let armZ = 0
    if (!reducedMotion) {
      if (pose === 'walk') {
        const s = Math.sin(t * 7) * 0.7
        p.legL = s
        p.legR = -s
        p.armL = -s * 0.8
        p.armR = s * 0.8
        bob = Math.abs(Math.sin(t * 7)) * 0.05
      } else if (pose === 'wave') {
        p.armR = Math.PI
        armZ = -0.35 + Math.sin(t * 9) * 0.35
        p.armL = Math.sin(t * 1.6) * 0.1
      } else {
        // idle: breathing arms, and a quick wave right after a change
        p.armL = -Math.sin(t * 1.6) * 0.1
        p.armR = since < 0.9 ? Math.PI * 0.85 : Math.sin(t * 1.6) * 0.1
        if (since < 0.9) armZ = Math.sin(since * 18) * 0.35
      }
    }
    // A hair above the grass so the soles never z-fight with it.
    g.position.y = 0.505 + hop + bob
    for (const k of Object.keys(limbs.current) as LimbKey[]) {
      const l = limbs.current[k]!
      // Arms raise backwards in rotation.x terms (negative = forward).
      l.o.rotation.x = l.rx + (k.startsWith('arm') ? -p[k] : p[k])
      l.o.rotation.z = l.rz + (k === 'armR' ? armZ : 0)
    }
  })

  return (
    <group ref={root}>
      {model ? (
        <primitive object={model} />
      ) : (
        look && (
          <group scale={0.95}>
            <BlockyFigure look={look} limbRef={limbRef} />
          </group>
        )
      )}
    </group>
  )
}

/**
 * A grass block for the character to stand on: dirt (y 0-0.42) with a grass layer stacked on top
 * (0.42-0.5). They must not overlap: coplanar faces z-fight (flicker) as the camera turns.
 */
function GrassBlock() {
  return (
    <group position={[0, 0.25, 0]}>
      <mesh geometry={GEO.box} material={mat('#8a5b38')} position={[0, -0.04, 0]} scale={[1, 0.42, 1]} />
      <mesh geometry={GEO.box} material={mat('#5fa83a')} position={[0, 0.21, 0]} scale={[1, 0.08, 1]} />
      {[
        [-0.3, 0.12],
        [0.18, -0.26],
        [0.32, 0.3],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={GEO.box} material={mat('#4c8f2c')} position={[x!, 0.255, z!]} scale={[0.14, 0.02, 0.14]} />
      ))}
    </group>
  )
}
