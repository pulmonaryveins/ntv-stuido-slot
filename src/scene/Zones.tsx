import { useMemo } from 'react'
import * as THREE from 'three'
import { B, GEO, GLOW, PAL } from './kit'
import { TaskChair } from './Furniture'
import { MEETING_ROOM, RACKS, ROOM_BACK, ROOM_FRONT, ROOM_X, SOFA_X, DOOR_Z } from './layout'

/**
 * Office zoning: the pantry has its own tile floor, the meeting room and server room are
 * glass-walled rooms, there is a reception desk by the entrance, and every zone has a sign.
 * Openings line up with the walking routes (see layout.ts) so nobody walks through glass.
 */

const FLOOR_Y = 0.012

/** Thin floor overlay covering [x0,x1] × [z0,z1]. */
function Floor({ x0, x1, z0, z1, c, y = FLOOR_Y }: { x0: number; x1: number; z0: number; z1: number; c: string; y?: number }) {
  return <B p={[(x0 + x1) / 2, y, (z0 + z1) / 2]} s={[x1 - x0, 0.02, z1 - z0]} c={c} />
}

/** Checkerboard tiles as one canvas texture (one mesh). */
function TileFloor({ x0, x1, z0, z1, a, b, tile = 0.5 }: { x0: number; x1: number; z0: number; z1: number; a: string; b: string; tile?: number }) {
  const map = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 2
    const ctx = c.getContext('2d')!
    ctx.fillStyle = a
    ctx.fillRect(0, 0, 2, 2)
    ctx.fillStyle = b
    ctx.fillRect(0, 0, 1, 1)
    ctx.fillRect(1, 1, 1, 1)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestFilter
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set((x1 - x0) / (tile * 2), (z1 - z0) / (tile * 2))
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [x0, x1, z0, z1, a, b, tile])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, FLOOR_Y + 0.004, (z0 + z1) / 2]} receiveShadow>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshStandardMaterial map={map} roughness={0.9} />
    </mesh>
  )
}

const GLASS = new THREE.MeshStandardMaterial({ color: '#bfe3f2', transparent: true, opacity: 0.32, roughness: 0.1, depthWrite: false })

/** Glass partition from (x0,z0) to (x1,z1) with an aluminium frame; axis-aligned. */
function GlassWall({ x0, z0, x1, z1, h = 2.4 }: { x0: number; z0: number; x1: number; z1: number; h?: number }) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const sx = alongX ? len : 0.06
  const sz = alongX ? 0.06 : len
  const posts = Math.max(1, Math.round(len / 1.6))
  return (
    <group>
      <mesh geometry={GEO.box} material={GLASS} position={[cx, h / 2, cz]} scale={[sx, h, sz]} renderOrder={1} />
      <B p={[cx, h + 0.08, cz]} s={[alongX ? len + 0.2 : 0.2, 0.16, alongX ? 0.2 : len + 0.2]} c="#8f969f" />
      <B p={[cx, 0.12, cz]} s={[alongX ? len : 0.2, 0.24, alongX ? 0.2 : len]} c="#7d848d" />
      {Array.from({ length: posts + 1 }, (_, i) => {
        const t = i / posts
        return <B key={i} p={[x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t]} s={[0.2, h, 0.2]} c="#8f969f" />
      })}
    </group>
  )
}

/** Reception desk by the entrance: L-shaped counter, monitor, chair, bell, welcome mat. */
function Reception() {
  const x = -ROOM_X + 2.6
  const z = DOOR_Z - 3.6
  return (
    <group>
      <TileFloor x0={-ROOM_X} x1={-ROOM_X + 5.4} z0={z - 1.6} z1={z + 1.4} a="#5c6b80" b="#556478" />
      {/* counter: front (facing the door path) + return */}
      <B p={[x, 0.55, z + 0.6]} s={[3.2, 1.1, 0.6]} c="#eceff2" cast />
      <B p={[x, 1.13, z + 0.65]} s={[3.4, 0.08, 0.8]} c={PAL.wood} />
      <B p={[x + 1.45, 0.45, z - 0.2]} s={[0.6, 0.9, 1.4]} c="#eceff2" cast />
      <B p={[x + 1.45, 0.92, z - 0.2]} s={[0.7, 0.06, 1.5]} c={PAL.wood} />
      <B p={[x, 0.55, z + 0.93]} s={[2.4, 0.5, 0.02]} c="#3c8527" />
      {/* monitor, bell, chair */}
      <B p={[x - 0.4, 1.45, z + 0.45]} s={[0.7, 0.45, 0.05]} c={PAL.ink} />
      <mesh geometry={GEO.box} material={GLOW.screen} position={[x - 0.4, 1.45, z + 0.48]} scale={[0.62, 0.37, 0.01]} />
      <B p={[x + 0.7, 1.22, z + 0.75]} s={[0.18, 0.1, 0.18]} c="#e9b44c" />
      <group position={[x - 0.3, 0, z - 0.5]}>
        <TaskChair c="#2d3138" trim="#3b4049" />
      </group>
      {/* welcome mat inside the door */}
      <B p={[-ROOM_X + 1.1, FLOOR_Y + 0.01, DOOR_Z]} s={[1.6, 0.02, 1.2]} c="#2b2f36" />
      <B p={[-ROOM_X + 1.1, FLOOR_Y + 0.02, DOOR_Z]} s={[1.3, 0.02, 0.9]} c="#3a404a" />
    </group>
  )
}

export function Zones() {
  const [rx] = RACKS
  // Meeting room: front-right corner; door gap on its left wall facing the open floor.
  const meet = MEETING_ROOM
  // Render farm: glass room around the racks on the back wall; people watch from the front.
  const srv = { x0: rx - 3, x1: rx + 3, z0: ROOM_BACK, z1: ROOM_BACK + 1.7 }
  return (
    <group>
      {/* floors */}
      {/* each zone has its own carpet: kitchen is white tile; the rest are office carpet tiles */}
      <TileFloor x0={-ROOM_X} x1={-9.6} z0={ROOM_BACK} z1={ROOM_BACK + 8.2} a="#dfe5ea" b="#cbd3da" />
      <TileFloor x0={meet.x0} x1={meet.x1} z0={meet.z0} z1={meet.z1} a="#3f4f6e" b="#38486a" />
      <TileFloor x0={srv.x0} x1={srv.x1} z0={srv.z0} z1={srv.z1} a="#555a63" b="#4d525a" />
      {/* lounge: navy rug with a light border; games: charcoal carpet; supplies: slate */}
      <Floor x0={-ROOM_X} x1={SOFA_X + 3.6} z0={6} z1={ROOM_FRONT} c="#cfd5db" />
      <Floor x0={-ROOM_X + 0.4} x1={SOFA_X + 3.2} z0={6.4} z1={ROOM_FRONT - 0.4} c="#35507a" y={FLOOR_Y + 0.004} />
      <TileFloor x0={11} x1={ROOM_X} z0={5.4} z1={ROOM_FRONT} a="#323a4d" b="#2b3345" />
      {/* orange border inlay: four strips, so the checker carpet shows in the middle */}
      <Floor x0={11.3} x1={ROOM_X - 0.3} z0={5.7} z1={5.85} c="#f07f3c" y={FLOOR_Y + 0.012} />
      <Floor x0={11.3} x1={ROOM_X - 0.3} z0={ROOM_FRONT - 0.45} z1={ROOM_FRONT - 0.3} c="#f07f3c" y={FLOOR_Y + 0.012} />
      <Floor x0={11.3} x1={11.45} z0={5.7} z1={ROOM_FRONT - 0.3} c="#f07f3c" y={FLOOR_Y + 0.012} />
      <Floor x0={ROOM_X - 0.45} x1={ROOM_X - 0.3} z0={5.7} z1={ROOM_FRONT - 0.3} c="#f07f3c" y={FLOOR_Y + 0.012} />
      <TileFloor x0={ROOM_X - 2.4} x1={ROOM_X} z0={-6.6} z1={0.6} a="#5c6b80" b="#556478" />

      {/* meeting room walls: front side, and left side with a door gap */}
      <GlassWall x0={meet.x0} z0={meet.z1} x1={meet.x1} z1={meet.z1} />
      <GlassWall x0={meet.x0} z0={meet.z0} x1={meet.x0} z1={meet.gap0} />
      <B p={[meet.x0, 2.45, (meet.gap0 + meet.gap1) / 2]} s={[0.2, 0.16, meet.gap1 - meet.gap0]} c="#8f969f" />
      {/* server room walls */}
      <GlassWall x0={srv.x0} z0={srv.z1} x1={srv.x1} z1={srv.z1} />
      <GlassWall x0={srv.x0} z0={srv.z0} x1={srv.x0} z1={srv.z1} />
      <GlassWall x0={srv.x1} z0={srv.z0} x1={srv.x1} z1={srv.z1} />

      {/* low glass balustrade along the open front edge of the floor */}
      <GlassWall x0={-ROOM_X + 0.3} z0={ROOM_FRONT - 0.15} x1={ROOM_X - 0.3} z1={ROOM_FRONT - 0.15} h={0.9} />

      <Reception />

      {/* the meeting-room door gap is marked by a light header so it reads as a doorway */}
      <mesh geometry={GEO.box} material={GLOW.lamp} position={[meet.x0, 2.55, (meet.gap0 + meet.gap1) / 2]} scale={[0.06, 0.04, 1]} />
    </group>
  )
}
