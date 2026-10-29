import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Profile, Snapshot } from '../data'
import type { SceneEvent } from '../store/studio'
import { useNow } from '../ui/useNow'
import { GEO, PAL, hashString, mat, rand } from './kit'
import { setAnchorPos, useAnchor } from './anchors'
import { assignCharacters, instantiate, rigLimbs, type Rig } from './Characters'
import { EXIT, HUB, KITCHEN_ROUTE, LOUNGE_SPOTS, IDLE_SPOTS, cartSpot, idleSpot, loungeSpot, type DeskSpot, type XZ } from './layout'

type Station =
  | { kind: 'seat'; slotId: number }
  | { kind: 'cart'; slotId: number; index: number }
  | { kind: 'queue'; index: number }
  | { kind: 'knock'; slotId: number }
  | { kind: 'idle'; choice: number }
  | { kind: 'gone' }

const LIMB_KEYS = ['legL', 'legR', 'armL', 'armR'] as const
type LimbKey = (typeof LIMB_KEYS)[number]

export const KNOCK_MS = 4500
const CELEBRATE_MS = 2600
const WALK_SPEED = 2.8

/** Building floors are raised; the plaza is at ground level. */
function groundY(_x: number, _z: number) {
  // Studio floors are flush with the ground in the voxel world.
  return 0.02
}

function stationKey(s: Station) {
  return JSON.stringify(s)
}

function routeFor(s: Station, spots: Map<number, DeskSpot>): XZ[] {
  switch (s.kind) {
    case 'seat':
      return spots.get(s.slotId)?.route ?? [HUB, EXIT]
    case 'knock': {
      const spot = spots.get(s.slotId)
      return spot ? [HUB, spot.route[1]!, spot.knock] : [HUB]
    }
    case 'cart':
      return [...KITCHEN_ROUTE, cartSpot(s.index)]
    case 'queue':
      return [HUB, loungeSpot(s.index).pos]
    case 'idle':
      return idleSpot(s.choice).route
    case 'gone':
      return [HUB, EXIT]
  }
}

/** Every avatar's target station, derived purely from board state + recent events. */
function computeStations(snapshot: Snapshot, events: SceneEvent[], nowPerf: number) {
  const map = new Map<string, Station>()
  let breakIndex = 0
  for (const s of [...snapshot.slots].sort((a, b) => a.id - b.id)) {
    if (!s.user_id) continue
    map.set(s.user_id, s.status === 'break' ? { kind: 'cart', slotId: s.id, index: breakIndex++ } : { kind: 'seat', slotId: s.id })
  }
  const queue = [...snapshot.queue].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)
  queue.forEach((q, i) => {
    if (!map.has(q.user_id)) map.set(q.user_id, { kind: 'queue', index: i })
  })
  // Everyone else who is active is around the office, not leaving: meetings, collab table, server racks.
  // They change what they are doing every so often (own rhythm per person), never sharing a spot.
  const taken = new Set<number>(queue.map((_, i) => i % LOUNGE_SPOTS.length))
  const total = IDLE_SPOTS.length
  const nowMs = Date.now()
  for (const p of [...snapshot.profiles].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!p.active || map.has(p.id)) continue
    const h = hashString(p.id)
    const period = 14000 + (h % 9000)
    const round = Math.floor((nowMs + h * 7) / period)
    let c = hashString(`${p.id}:${round}`) % total
    for (let n = 0; n < total && taken.has(c); n++) c = (c + 1) % total
    taken.add(c)
    map.set(p.id, { kind: 'idle', choice: c })
  }
  for (const e of events) {
    if (e.kind !== 'knock' || !e.userId || nowPerf - e.at > KNOCK_MS) continue
    const current = map.get(e.userId)
    if (current?.kind === 'seat') continue
    map.set(e.userId, { kind: 'knock', slotId: e.slotId })
  }
  return map
}

export function Avatars({
  snapshot,
  actorId,
  spots,
  events,
  reducedMotion,
  templates = null,
}: {
  snapshot: Snapshot
  actorId: string | null
  spots: Map<number, DeskSpot>
  events: SceneEvent[]
  reducedMotion: boolean
  /** Character models from the optional GLB pack; null = built-in blocky avatars. */
  templates?: THREE.Object3D[] | null
}) {
  useNow(1000) // re-evaluate knock/celebration windows
  const assignment = useMemo(
    () => (templates ? assignCharacters(snapshot.profiles, templates.length) : null),
    [templates, snapshot.profiles],
  )
  const nowPerf = performance.now()
  const stations = computeStations(snapshot, events, nowPerf)
  const celebrating = new Set(
    events
      .filter((e) => e.kind === 'render_done' && nowPerf - e.at < CELEBRATE_MS)
      .map((e) => snapshot.slots.find((s) => s.id === e.slotId)?.user_id)
      .filter(Boolean),
  )
  return (
    <group>
      {snapshot.profiles
        .filter((p) => p.active)
        .map((p) => (
          <Avatar
            key={p.id}
            profile={p}
            station={stations.get(p.id) ?? { kind: 'gone' }}
            spots={spots}
            isMe={p.id === actorId}
            celebrate={celebrating.has(p.id)}
            reducedMotion={reducedMotion}
            template={templates && assignment ? (templates[assignment.get(p.id) ?? 0] ?? null) : null}
          />
        ))}
    </group>
  )
}

function Avatar({
  profile,
  station,
  spots,
  isMe,
  celebrate,
  reducedMotion,
  template,
}: {
  profile: Profile
  station: Station
  spots: Map<number, DeskSpot>
  isMe: boolean
  celebrate: boolean
  reducedMotion: boolean
  template: THREE.Object3D | null
}) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  // Limbs animate as offsets from their rest rotation (GLB bones have their own rest pose).
  const limbs = useRef<Partial<Record<LimbKey, { o: THREE.Object3D; rx: number; rz: number }>>>({})
  const { model, rig } = useMemo(() => {
    if (!template) return { model: null, rig: null as Rig | null }
    const inst = instantiate(template)
    return { model: inst, rig: rigLimbs(inst) }
  }, [template])
  useEffect(() => {
    if (!model) return
    limbs.current = {}
    for (const k of LIMB_KEYS) {
      const o = rig?.limbs[k]
      if (o) limbs.current[k] = { o, rx: o.rotation.x, rz: o.rotation.z }
    }
  }, [model, rig])
  const limbRef = (k: LimbKey) => (o: THREE.Object3D | null) => {
    if (model) return
    if (o) limbs.current[k] = { o, rx: 0, rz: 0 }
    else delete limbs.current[k]
  }
  const sim = useRef({
    pos: new THREE.Vector3(),
    path: [] as XZ[],
    prevRoute: [] as XZ[],
    prevKind: '' as Station['kind'] | '',
    started: false,
    facing: 0,
    lastKey: '',
  })
  const key = stationKey(station)
  const skin = PAL.skin[hashString(profile.id) % PAL.skin.length]!
  const shirt = mat(profile.avatar_color)

  useEffect(() => {
    const s = sim.current
    // Idempotent per station: StrictMode re-runs effects, which would replay the walk.
    if (s.lastKey === key) return
    s.lastKey = key
    const route = routeFor(station, spots)
    const end = route[route.length - 1]!
    if (!s.started || reducedMotion) {
      s.pos.set(end[0], 0, end[1])
      s.path = []
      s.started = true
    } else if (s.prevKind === 'queue' && station.kind === 'queue') {
      s.path = [end]
    } else {
      s.path = [...[...s.prevRoute].reverse(), ...route.slice(1)]
    }
    s.prevRoute = route
    s.prevKind = station.kind
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useFrame(({ clock }, dt) => {
    const s = sim.current
    const g = root.current
    if (!g || !body.current) return
    const t = clock.elapsedTime + rand(hashString(profile.id)) * 10
    let walking = false

    if (s.path.length) {
      const [tx, tz] = s.path[0]!
      const dx = tx - s.pos.x
      const dz = tz - s.pos.z
      const dist = Math.hypot(dx, dz)
      const step = WALK_SPEED * Math.min(dt, 0.1)
      if (dist <= step) {
        s.pos.x = tx
        s.pos.z = tz
        s.path.shift()
      } else {
        s.pos.x += (dx / dist) * step
        s.pos.z += (dz / dist) * step
        s.facing = Math.atan2(dx, dz)
        walking = true
      }
    }

    const arrived = !s.path.length
    const gone = arrived && station.kind === 'gone'
    g.visible = !gone
    if (gone) return

    let y = 0
    let sit = false
    let facing = s.facing
    // Seat height for sitting; GLB models (no leg bones) sink by `drop` instead of bending.
    let seatY = 0.66
    let drop = 0.97
    let lean = 0
    let sway = 0
    const idle = arrived && station.kind === 'idle' ? idleSpot(station.choice) : null
    const lounge = arrived ? (station.kind === 'queue' ? loungeSpot(station.index) : idle) : null
    if (arrived) {
      if (station.kind === 'seat') {
        sit = true
        facing = Math.PI // facing the cubicle desk and monitors
      } else if (lounge) {
        facing = lounge.facing
        // wanderers glance around
        if (lounge.activity === 'roam' && !reducedMotion) facing += Math.sin(t * 0.5) * 0.9
        if (lounge.pose === 'sit') {
          sit = true
          seatY = lounge.seatY
          drop = 0.55
        } else if (lounge.pose === 'beanbag') {
          sit = true
          seatY = lounge.seatY
          drop = 0.85
          lean = -0.28
        }
        if (lounge.activity === 'pingpong' && !reducedMotion) sway = Math.sin(t * 2.6) * 0.35
      } else if (station.kind === 'knock') facing = Math.PI
      else if (station.kind === 'cart') facing = Math.PI // facing the kitchen counter
    }
    // smooth turn
    const diff = Math.atan2(Math.sin(facing - g.rotation.y), Math.cos(facing - g.rotation.y))
    g.rotation.y += diff * Math.min(1, dt * 10)

    const swing = walking ? Math.sin(t * 11) * 0.7 : 0
    const pose = { legL: sit ? -Math.PI / 2 : swing, legR: sit ? -Math.PI / 2 : -swing, armL: -swing * 0.8, armR: swing * 0.8 }
    let armZ = 0
    if (sit) {
      pose.armL = -1.1 + Math.sin(t * 6) * 0.05
      pose.armR = -1.1 + Math.cos(t * 7) * 0.05
    }
    if (arrived && station.kind === 'knock') pose.armR = -2.3 + Math.sin(t * 14) * 0.35
    if (lounge?.activity === 'game') {
      // mashing arcade buttons
      pose.armL = -1.25 + Math.sin(t * 18) * 0.12
      pose.armR = -1.25 + Math.cos(t * 21) * 0.12
    } else if (lounge?.activity === 'pingpong') {
      pose.armR = -0.6 + Math.sin(t * 5.2) * 0.9
    } else if (lounge?.activity === 'chill') {
      // hands behind the head
      armZ = 2.7
      pose.armL = -0.4
      pose.armR = -0.4
    } else if (lounge?.activity === 'tv' && !reducedMotion) {
      // the odd laugh at the show
      if (Math.sin(t * 0.7) > 0.93) y += Math.abs(Math.sin(t * 16)) * 0.05
    }
    if (lounge && !reducedMotion) {
      const ph = rand(hashString(profile.id)) * 10
      if (lounge.activity === 'meeting') {
        pose.armR = -0.9 + Math.sin(t * 3.1 + ph) * 0.5 // talking with their hands
        if (Math.sin(t * 0.4 + ph) > 0.3) pose.armL = -0.7 + Math.cos(t * 2.3) * 0.4
      } else if (lounge.activity === 'collab') {
        pose.armL = -1.2 + Math.sin(t * 15 + ph) * 0.1 // typing at the shared table
        pose.armR = -1.2 + Math.cos(t * 17) * 0.1
      } else if (lounge.activity === 'racks') {
        pose.armR = -1.4 + Math.sin(t * 2) * 0.15
      }
    }
    if (celebrate && !reducedMotion) {
      y += Math.abs(Math.sin(t * 9)) * 0.35
      armZ = 2.6
      pose.armL = 0
      pose.armR = 0
    }
    for (const k of LIMB_KEYS) {
      const limb = limbs.current[k]
      if (!limb) continue
      limb.o.rotation.x = limb.rx + pose[k]
      limb.o.rotation.z = limb.rz + (k === 'armL' ? armZ : k === 'armR' ? -armZ : 0)
    }
    if (walking) y += Math.abs(Math.sin(t * 11)) * (model ? 0.09 : 0.05)
    // The blocky avatar's hip sits 0.52 above its root; a model without leg bones cannot bend,
    // so it settles lower (behind the desk / into the sofa) instead.
    // Hips on the seat: the model's own hip height when rigged, else sink it (no knees to bend).
    const sitY = model ? (rig ? seatY - rig.hipY : seatY - drop) : seatY - 0.52
    body.current.rotation.x = lean
    // Sway sideways relative to facing (ping-pong footwork).
    const sx = Math.cos(g.rotation.y) * sway
    const sz = -Math.sin(g.rotation.y) * sway
    g.position.set(s.pos.x + sx, sit ? sitY + y : groundY(s.pos.x, s.pos.z) + y, s.pos.z + sz)
    setAnchorPos(`tag:${profile.id}`, g.position.x, g.position.y + (sit ? 1.9 : 2.0), g.position.z)
    setAnchorPos(`bubble:${profile.id}`, g.position.x, g.position.y + 2.1, g.position.z)
    if (isMe) {
      // Above the waiting-list tag so the two never overlap.
      setAnchorPos(`me:${profile.id}`, g.position.x, g.position.y + (sit ? 2.35 : 2.5), g.position.z)
      const r = ring.current
      if (r) {
        r.visible = g.visible
        r.position.set(g.position.x, 0.04, g.position.z)
        // Stepped "breathing" so it reads as a game marker, not a smooth glow.
        const k = reducedMotion ? 1 : 1 + Math.round((Math.sin(clock.elapsedTime * 3) + 1) * 1.5) * 0.06
        r.scale.set(k, 1, k)
      }
    }
  })
  const ring = useRef<THREE.Group>(null)
  const marker = isMe ? <YouRing ref={ring} /> : null

  if (model) {
    return (
      <>
        {marker}
        <group ref={root}>
          <group ref={body}>
            <primitive object={model} />
          </group>
        </group>
      </>
    )
  }

  return (
    <>
    {marker}
    <group ref={root}>
      <group ref={body} scale={0.95}>
        {/* legs (pivot at hip) */}
        <group ref={limbRef('legL')} position={[-0.11, 0.55, 0]}>
          <mesh geometry={GEO.box} material={mat('#3b4255')} position={[0, -0.27, 0]} scale={[0.17, 0.55, 0.19]} castShadow />
        </group>
        <group ref={limbRef('legR')} position={[0.11, 0.55, 0]}>
          <mesh geometry={GEO.box} material={mat('#3b4255')} position={[0, -0.27, 0]} scale={[0.17, 0.55, 0.19]} castShadow />
        </group>
        {/* torso */}
        <mesh geometry={GEO.box} material={shirt} position={[0, 0.83, 0]} scale={[0.46, 0.58, 0.28]} castShadow />
        {/* arms (pivot at shoulder) */}
        <group ref={limbRef('armL')} position={[-0.3, 1.08, 0]}>
          <mesh geometry={GEO.box} material={shirt} position={[0, -0.24, 0]} scale={[0.13, 0.48, 0.15]} />
          <mesh geometry={GEO.box} material={mat(skin)} position={[0, -0.52, 0]} scale={[0.11, 0.1, 0.12]} />
        </group>
        <group ref={limbRef('armR')} position={[0.3, 1.08, 0]}>
          <mesh geometry={GEO.box} material={shirt} position={[0, -0.24, 0]} scale={[0.13, 0.48, 0.15]} />
          <mesh geometry={GEO.box} material={mat(skin)} position={[0, -0.52, 0]} scale={[0.11, 0.1, 0.12]} />
        </group>
        {/* head */}
        {/* cube head, hair cap + back, pixel eyes */}
        <mesh geometry={GEO.box} material={mat(skin)} position={[0, 1.36, 0]} scale={0.44} castShadow />
        <mesh geometry={GEO.box} material={mat('#3a2a22')} position={[0, 1.61, 0]} scale={[0.48, 0.1, 0.48]} />
        <mesh geometry={GEO.box} material={mat('#3a2a22')} position={[0, 1.44, -0.2]} scale={[0.48, 0.3, 0.1]} />
        <mesh geometry={GEO.box} material={mat(PAL.white)} position={[-0.1, 1.38, 0.222]} scale={[0.09, 0.06, 0.01]} />
        <mesh geometry={GEO.box} material={mat(PAL.white)} position={[0.1, 1.38, 0.222]} scale={[0.09, 0.06, 0.01]} />
        <mesh geometry={GEO.box} material={mat(PAL.ink)} position={[-0.08, 1.38, 0.226]} scale={[0.045, 0.06, 0.01]} />
        <mesh geometry={GEO.box} material={mat(PAL.ink)} position={[0.12, 1.38, 0.226]} scale={[0.045, 0.06, 0.01]} />
        <mesh geometry={GEO.box} material={mat('#b97b55')} position={[0, 1.26, 0.222]} scale={[0.12, 0.03, 0.01]} />
        <RoleProp role={profile.work_role} color={profile.avatar_color} />
      </group>
    </group>
    </>
  )
}

/** Users currently walking over to knock (recent knock events, not seated). */
export function activeKnockers(snapshot: Snapshot, events: SceneEvent[], nowPerf: number): string[] {
  const seated = new Set(snapshot.slots.map((s) => s.user_id))
  return [
    ...new Set(
      events
        .filter((e) => e.kind === 'knock' && e.userId && !seated.has(e.userId) && nowPerf - e.at < KNOCK_MS)
        .map((e) => e.userId!),
    ),
  ]
}

const RING_MAT = new THREE.MeshBasicMaterial({ color: '#6cc349', transparent: true, opacity: 0.9, depthWrite: false })
const RING_CORNER = new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: false })

/** Square block outline on the floor under the current user (follows them, see useFrame). */
const YouRing = forwardRef<THREE.Group>(function YouRing(_props, ref) {
  const S = 0.5 // half size
  const T = 0.07 // bar thickness
  return (
    <group ref={ref} renderOrder={2}>
      {[
        [0, -S, 2 * S, T],
        [0, S, 2 * S, T],
        [-S, 0, T, 2 * S],
        [S, 0, T, 2 * S],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} geometry={GEO.box} material={RING_MAT} position={[x!, 0, z!]} scale={[w!, 0.02, d!]} />
      ))}
      {[
        [-S, -S],
        [S, -S],
        [-S, S],
        [S, S],
      ].map(([x, z], i) => (
        <mesh key={`c${i}`} geometry={GEO.box} material={RING_CORNER} position={[x!, 0.005, z!]} scale={[0.14, 0.025, 0.14]} />
      ))}
    </group>
  )
})

/** "You" badge with a bouncing pixel arrow over the current user (rendered outside the Canvas). */
export function YouMarker({ userId, name }: { userId: string; name: string }) {
  const anchor = useAnchor(`me:${userId}`, 0, -100, 0)
  return (
    <div ref={anchor} className="pointer-events-none absolute left-0 top-0">
      <div className="ss-bob flex flex-col items-center">
        <div className="on-dark flex items-center gap-1.5 border-2 border-black bg-accent px-2 py-0.5 shadow-[inset_0_-3px_0_rgba(0,0,0,0.35),inset_0_2px_0_rgba(255,255,255,0.3),3px_3px_0_rgba(0,0,0,0.35)]">
          <span className="font-pixel text-[11px] uppercase text-white">You</span>
          <span className="max-w-24 truncate text-[11px] font-semibold text-white/90">{name}</span>
        </div>
        {/* pixel arrow pointing down at the character */}
        <svg width="14" height="8" viewBox="0 0 7 4" shapeRendering="crispEdges" aria-hidden className="-mt-px">
          <path fill="#000" d="M0 0h7v1H6v1H5v1H4v1H3V3H2V2H1V1H0z" />
          <path fill="var(--accent)" d="M1 0h5v1H5v1H4v1H3V2H2V1H1z" />
        </svg>
      </div>
    </div>
  )
}

/** "#n waiting" tag over a user in the lounge (rendered outside the Canvas). */
export function QueueTag({ userId, position, ready }: { userId: string; position: number; ready: boolean }) {
  const anchor = useAnchor(`tag:${userId}`, 0, -100, 0)
  return (
    <div ref={anchor} className="pointer-events-none absolute left-0 top-0">
      <div
        className={`font-pixel whitespace-nowrap border-2 border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ready ? 'pulse bg-reserved text-ink' : 'bg-surface text-ink'}`}
        style={ready ? { ['--pulse-color' as string]: '#e2b33c' } : undefined}
      >
        #{position} {ready ? '· seat ready!' : 'waiting'}
      </div>
    </div>
  )
}

/** DOM speech bubble that follows a knocking avatar (rendered outside the Canvas). */
export function KnockBubble({ userId }: { userId: string }) {
  const anchor = useAnchor(`bubble:${userId}`, 0, -100, 0)
  return (
    <div ref={anchor} className="pointer-events-none absolute left-0 top-0">
      <div className="whitespace-nowrap border-2 border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink shadow">
        Knock knock ✊
      </div>
    </div>
  )
}

/** headphones = editor, glasses = designer, beanie = motion */
function RoleProp({ role, color }: { role: Profile['work_role']; color: string }) {
  if (role === 'editor') {
    return (
      <group>
        <mesh geometry={GEO.box} material={mat(PAL.ink)} position={[0, 1.62, 0]} scale={[0.5, 0.05, 0.08]} />
        <mesh geometry={GEO.cyl} material={mat(PAL.ink)} position={[-0.24, 1.38, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.17, 0.08, 0.17]} />
        <mesh geometry={GEO.cyl} material={mat(PAL.ink)} position={[0.24, 1.38, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.17, 0.08, 0.17]} />
      </group>
    )
  }
  if (role === 'designer') {
    return (
      <group position={[0, 1.38, 0.235]}>
        <mesh geometry={GEO.box} material={mat(PAL.ink)} position={[-0.09, 0, 0]} scale={[0.13, 0.09, 0.02]} />
        <mesh geometry={GEO.box} material={mat(PAL.ink)} position={[0.09, 0, 0]} scale={[0.13, 0.09, 0.02]} />
        <mesh geometry={GEO.box} material={mat(PAL.ink)} position={[0, 0.01, 0]} scale={[0.06, 0.02, 0.02]} />
      </group>
    )
  }
  return (
    <group>
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 1.66, 0]} scale={[0.5, 0.22, 0.5]} />
      <mesh geometry={GEO.box} material={mat(PAL.cream)} position={[0, 1.56, 0]} scale={[0.52, 0.07, 0.52]} />
      <mesh geometry={GEO.box} material={mat(PAL.cream)} position={[0, 1.83, 0]} scale={0.12} />
    </group>
  )
}

/** Confetti burst at a desk when its render finishes. */
export function Celebrations({ events, spots }: { events: SceneEvent[]; spots: Map<number, DeskSpot> }) {
  useNow(500)
  const now = performance.now()
  const active = events.filter((e) => e.kind === 'render_done' && now - e.at < CELEBRATE_MS)
  return (
    <>
      {active.map((e) => {
        const spot = spots.get(e.slotId)
        return spot ? <Burst key={e.id} at={e.at} p={[spot.chair[0], 1.8, spot.chair[1]]} /> : null
      })}
    </>
  )
}

const CONFETTI = ['#f0a63a', '#2fa59a', '#ef6b4a', '#8e6cd1', '#5b8def', '#f5d24a']

function Burst({ at, p }: { at: number; p: [number, number, number] }) {
  const group = useRef<THREE.Group>(null)
  const parts = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ v: [(rand(i) - 0.5) * 4, 3 + rand(i + 1) * 3, (rand(i + 2) - 0.5) * 4] as const, c: CONFETTI[i % CONFETTI.length]! })),
    [],
  )
  useFrame(() => {
    const t = (performance.now() - at) / 1000
    group.current?.children.forEach((c, i) => {
      const { v } = parts[i]!
      c.position.set(v[0] * t, v[1] * t - 4.9 * t * t, v[2] * t)
      c.rotation.set(t * 6 + i, t * 4, 0)
      c.scale.setScalar(Math.max(0, 1 - t / 2.6) * 0.14)
    })
  })
  return (
    <group ref={group} position={p}>
      {parts.map((pt, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(pt.c)} />
      ))}
    </group>
  )
}

/** Small dog wandering the plaza (ambient, not tied to board state). */
export function Dog({ reducedMotion }: { reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Mesh>(null)
  const st = useRef({ x: 1.5, z: 6.5, tx: 1.5, tz: 6.5, wait: 0, seed: 1 })
  useFrame(({ clock }, dt) => {
    const s = st.current
    const g = root.current
    if (!g) return
    const d = Math.hypot(s.tx - s.x, s.tz - s.z)
    let moving = false
    if (d < 0.05) {
      s.wait -= dt
      if (s.wait <= 0) {
        s.seed++
        // wanders the open walkway in front of the cubicles
        s.tx = -5 + rand(s.seed) * 10
        s.tz = 1 + rand(s.seed + 50) * 3
        s.wait = 1 + rand(s.seed + 7) * 3
      }
    } else if (!reducedMotion) {
      const step = Math.min(d, 1.8 * Math.min(dt, 0.1))
      s.x += ((s.tx - s.x) / d) * step
      s.z += ((s.tz - s.z) / d) * step
      g.rotation.y = Math.atan2(s.tx - s.x, s.tz - s.z)
      moving = true
    }
    const t = clock.elapsedTime
    g.position.set(s.x, moving ? Math.abs(Math.sin(t * 14)) * 0.06 : 0, s.z)
    if (tail.current) tail.current.rotation.z = Math.sin(t * (moving ? 18 : 8)) * 0.6
  })
  return (
    <group ref={root} scale={0.8}>
      <mesh geometry={GEO.box} material={mat('#d9a066')} position={[0, 0.38, 0]} scale={[0.32, 0.28, 0.6]} castShadow />
      <mesh geometry={GEO.box} material={mat('#d9a066')} position={[0, 0.58, 0.36]} scale={[0.28, 0.26, 0.28]} castShadow />
      <mesh geometry={GEO.box} material={mat('#2b2a33')} position={[0, 0.55, 0.52]} scale={[0.1, 0.08, 0.06]} />
      <mesh geometry={GEO.box} material={mat('#8a5b38')} position={[-0.12, 0.74, 0.34]} scale={[0.08, 0.12, 0.08]} />
      <mesh geometry={GEO.box} material={mat('#8a5b38')} position={[0.12, 0.74, 0.34]} scale={[0.08, 0.12, 0.08]} />
      {[
        [-0.1, 0.2],
        [0.1, 0.2],
        [-0.1, -0.2],
        [0.1, -0.2],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={GEO.box} material={mat('#c48a52')} position={[x!, 0.12, z!]} scale={[0.08, 0.24, 0.08]} />
      ))}
      <mesh ref={tail} geometry={GEO.box} material={mat('#c48a52')} position={[0, 0.5, -0.34]} scale={[0.06, 0.06, 0.22]} />
    </group>
  )
}
