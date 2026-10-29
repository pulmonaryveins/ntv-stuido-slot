import { Component, Suspense, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStudio, type TimeMode } from '../store/studio'
import { useNow } from '../ui/useNow'
import { GLOW, NIGHT as NIGHT_FACTOR } from './kit'
import { deskSpots, type XZ } from './layout'
import { World } from './Island'
import { Lounge } from './Props'
import { Zones } from './Zones'
import { CITY_GLOW, Outside } from './Outside'
import { glassMaterial } from './voxel'
import { Building, Desk, DeskPlate } from './Studio'
import { RenderFarm } from './RenderFarm'
import { Avatars, Celebrations, Dog, KnockBubble, QueueTag, YouMarker, activeKnockers } from './Avatars'
import { useCharacterTemplates } from './Characters'
import { AnchorProjector } from './anchors'

const AZIMUTH = THREE.MathUtils.degToRad(32)
const ELEVATION = THREE.MathUtils.degToRad(33)
const POLAR = Math.PI / 2 - ELEVATION
const CAM_DIST = 60

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

/** 0 = full day, 1 = full night. Auto follows the (mock) clock's local time. */
function nightFactor(mode: TimeMode, ms: number): number {
  if (mode === 'day') return 0
  if (mode === 'night') return 1
  const d = new Date(ms)
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 7.5 && h <= 17.5) return 0
  if (h >= 20 || h < 5) return 1
  if (h > 17.5) return (h - 17.5) / 2.5
  return 1 - (h - 5) / 2.5
}

const SKY_HORIZON_DAY = '#e6f1ec'
const SKY_HORIZON_NIGHT = '#3b2f57'

const lerpColor = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`

export default function Stage({ active }: { active: boolean }) {
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const focusSlotId = useStudio((s) => s.focusSlotId)
  const focusSlot = useStudio((s) => s.focusSlot)
  const timeMode = useStudio((s) => s.timeMode)
  const sceneEvents = useStudio((s) => s.sceneEvents)
  const reducedMotion = usePrefersReducedMotion()
  const visible = usePageVisible()
  const now = useNow(1000)
  const night = nightFactor(timeMode, now)

  const spots = useMemo(
    () => (snapshot ? deskSpots(snapshot.slots, snapshot.accounts.map((a) => a.id)) : new Map()),
    [snapshot],
  )
  const focus: XZ | null = focusSlotId !== null ? (spots.get(focusSlotId)?.desk ?? null) : null
  const renders = snapshot?.slots.filter((s) => s.status === 'rendering').length ?? 0
  const focused = snapshot?.slots.find((s) => s.id === focusSlotId)
  const focusedName = focused ? snapshot?.profiles.find((p) => p.id === focused.user_id)?.name : undefined
  const focusedAccount = focused ? snapshot?.accounts.find((a) => a.id === focused.account_id)?.label : undefined

  // Indoor backdrop (the sky only shows through the office windows), dimmer at night.
  // Sky behind the street scene (the fog in DayNight fades the ground into the horizon colour).
  const backdrop = `linear-gradient(180deg, ${lerpColor('#8fd0ea', '#0d1430', night)} 0%, ${lerpColor('#cfe9ef', '#2c2654', night)} 60%, ${lerpColor(SKY_HORIZON_DAY, SKY_HORIZON_NIGHT, night)} 100%)`

  return (
    <div className="absolute inset-0" style={{ background: backdrop }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 1.5]}
        frameloop={active && visible ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => (document.body.style.cursor = '')}
        aria-label="3D studio. Use the List view for keyboard access."
      >
        <OrthographicCamera
          makeDefault
          position={[
            CAM_DIST * Math.cos(ELEVATION) * Math.sin(AZIMUTH),
            CAM_DIST * Math.sin(ELEVATION),
            CAM_DIST * Math.cos(ELEVATION) * Math.cos(AZIMUTH),
          ]}
          zoom={20}
          near={0.1}
          far={400}
        />
        <Controls focus={focus} reducedMotion={reducedMotion} />
        <AnchorProjector />
        <DayNight night={night} />
        <World buildings={snapshot?.accounts.length ?? 2} />
        <Lounge />
        <Zones />
        <Outside reducedMotion={reducedMotion} />
        <RenderFarm renders={renders} reducedMotion={reducedMotion} />
        {snapshot && (
          <>
            {snapshot.accounts.slice(0, 2).map((a, i) => (
              <Building key={a.id} index={i} label={a.label} />
            ))}
            {snapshot.slots.map((slot) => {
              const spot = spots.get(slot.id)
              return spot ? (
<Desk key={slot.id} spot={spot} slot={slot} />
              ) : null
            })}
            <AvatarLayer snapshot={snapshot} actorId={actorId} spots={spots} events={sceneEvents} reducedMotion={reducedMotion} />
            <Celebrations events={sceneEvents} spots={spots} />
          </>
        )}
        <Dog reducedMotion={reducedMotion} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {snapshot?.slots.map((slot) => {
          const spot = spots.get(slot.id)
          return spot ? (
            <div key={slot.id} className="pointer-events-auto">
              <DeskPlate spot={spot} slot={slot} snapshot={snapshot} actorId={actorId} />
            </div>
          ) : null
        })}
        {/* Seated users are marked on their desk plate instead, so the badge never covers it. */}
        {snapshot && actorId && snapshot.profiles.some((p) => p.id === actorId && p.active) && !snapshot.slots.some((sl) => sl.user_id === actorId) && (
          <YouMarker userId={actorId} name={snapshot.profiles.find((p) => p.id === actorId)!.name} />
        )}
        {snapshot &&
          activeKnockers(snapshot, sceneEvents, performance.now()).map((id) => <KnockBubble key={id} userId={id} />)}
        {snapshot &&
          [...snapshot.queue]
            .sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)
            .map((q, i) => (
              <QueueTag
                key={q.user_id}
                userId={q.user_id}
                position={i + 1}
                ready={snapshot.slots.some((sl) => sl.hold_user_id === q.user_id)}
              />
            ))}
      </div>

      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-2">
        {focusSlotId !== null && (
          <>
            <button
              type="button"
              onClick={() => focusSlot(null)}
              className="pointer-events-auto px-panel px-2.5 py-1.5 text-sm font-semibold text-ink shadow"
            >
              ← Overview
            </button>
            <span className="rounded-lg bg-surface/80 px-2 py-1 text-xs text-ink shadow">
              {focusedAccount} · Slot {focused?.slot_number} {focusedName ? `· ${focusedName}` : '· free'}
            </span>
          </>
        )}
        {focusSlotId === null && (
          <span className="rounded-lg bg-surface/70 px-2 py-1 text-[11px] text-muted shadow">
            Click a desk to zoom · drag to rotate · scroll to zoom
          </span>
        )}
      </div>
    </div>
  )
}

/** Zoom + rotate only (polar angle locked), eased focus on a desk. */
function Controls({ focus, reducedMotion }: { focus: XZ | null; reducedMotion: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size, invalidate } = useThree()
  // Fit the island both ways (it is ~28 units wide and ~24 tall on screen at this angle).
  // Fit the office plus a margin of street and skyline around it.
  const baseZoom = Math.min(size.width / 44, size.height / 32)
  const goal = useRef({ target: new THREE.Vector3(), zoom: baseZoom, animating: false })

  useEffect(() => {
    const g = goal.current
    if (focus) g.target.set(focus[0], 1, focus[1] - 0.5)
    else g.target.set(0, 0.5, 0)
    g.zoom = focus ? baseZoom * 2.6 : baseZoom
    g.animating = true
    invalidate()
  }, [focus, baseZoom, invalidate])

  useFrame((_, dt) => {
    const c = controls.current
    const g = goal.current
    if (!c || !g.animating) return
    const cam = camera as THREE.OrthographicCamera
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 5)
    const delta = g.target.clone().sub(c.target).multiplyScalar(k)
    c.target.add(delta)
    cam.position.add(delta)
    cam.zoom += (g.zoom - cam.zoom) * k
    cam.updateProjectionMatrix()
    c.update()
    if (c.target.distanceTo(g.target) < 0.01 && Math.abs(cam.zoom - g.zoom) < 0.05) g.animating = false
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping={!reducedMotion}
      minPolarAngle={POLAR}
      maxPolarAngle={POLAR}
      minZoom={baseZoom * 0.6}
      maxZoom={baseZoom * 5}
      onStart={() => {
        goal.current.animating = false
      }}
    />
  )
}

const DAY = { hemiSky: '#fff6e0', hemiGround: '#7fae5a', sun: '#fff1d6' }
const NIGHT = { hemiSky: '#6a74b8', hemiGround: '#2b2a40', sun: '#9fb6ff' }

/** Lights and emissive materials follow the night factor, eased over time. */
function DayNight({ night }: { night: number }) {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const current = useRef(night)
  const tmp = useMemo(() => new THREE.Color(), [])
  const scene = useThree((st) => st.scene)

  useFrame((_, dt) => {
    current.current += (night - current.current) * Math.min(1, dt * 2)
    const n = current.current
    if (hemi.current) {
      hemi.current.intensity = THREE.MathUtils.lerp(1.6, 0.55, n)
      hemi.current.color.copy(tmp.set(DAY.hemiSky).lerp(new THREE.Color(NIGHT.hemiSky), n))
      hemi.current.groundColor.copy(tmp.set(DAY.hemiGround).lerp(new THREE.Color(NIGHT.hemiGround), n))
    }
    if (sun.current) {
      sun.current.intensity = THREE.MathUtils.lerp(2.4, 0.6, n)
      sun.current.color.copy(tmp.set(DAY.sun).lerp(new THREE.Color(NIGHT.sun), n))
      sun.current.position.set(THREE.MathUtils.lerp(16, -14, n), THREE.MathUtils.lerp(26, 20, n), 12)
    }
    GLOW.window.emissiveIntensity = n * 1.6
    GLOW.lamp.emissiveIntensity = 0.15 + n * 2.2
    GLOW.bulb.emissiveIntensity = 0.25 + n * 2.4
    GLOW.screen.emissiveIntensity = 0.6 + n * 0.8
    NIGHT_FACTOR.value = n
    // Windows: bright daylight to deep night blue.
    const glass = glassMaterial()
    glass.color.copy(tmp.set('#ffffff').lerp(new THREE.Color('#24306a'), n))
    glass.emissive.copy(tmp.set('#b9e2ff').lerp(new THREE.Color('#1a2350'), n))
    glass.emissiveIntensity = THREE.MathUtils.lerp(0.55, 0.3, n)
    for (const m of CITY_GLOW) m.emissiveIntensity = n * 1.3
    // Distance fog: the street and skyline fade into the horizon colour.
    if (!scene.fog) scene.fog = new THREE.Fog(SKY_HORIZON_DAY, 75, 170)
    ;(scene.fog as THREE.Fog).color.copy(tmp.set(SKY_HORIZON_DAY).lerp(new THREE.Color(SKY_HORIZON_NIGHT), n))
  })

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
      />
    </>
  )
}

type AvatarProps = Omit<ComponentProps<typeof Avatars>, 'templates'>

/** Character models from the optional GLB pack when present; blocky avatars otherwise or while loading. */
function AvatarLayer(props: AvatarProps) {
  const available = useStudio((s) => s.charactersAvailable)
  const blocky = <Avatars {...props} />
  if (!available) return blocky
  return (
    <ModelBoundary fallback={blocky}>
      <Suspense fallback={blocky}>
        <CharacterAvatars {...props} />
      </Suspense>
    </ModelBoundary>
  )
}

function CharacterAvatars(props: AvatarProps) {
  const templates = useCharacterTemplates()
  return <Avatars {...props} templates={templates} />
}

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('[studio] character models failed to load, using blocky avatars', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
