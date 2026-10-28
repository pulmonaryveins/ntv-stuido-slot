import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Slot, Snapshot } from '../data'
import { deriveSlotView } from '../lib/slotState'
import { formatDuration } from '../lib/format'
import { STATUS_META } from '../lib/status'
import { slotAccent } from '../ui/SlotCard'
import { useNow } from '../ui/useNow'
import { useStudio } from '../store/studio'
import { studioClient } from '../data'
import { B, C, GEO, GLOW, PAL, mat } from './kit'
import { useAnchor } from './anchors'
import { PixelIcon, type IconName } from '../ui/PixelIcon'
import { BUILDING_D, BUILDING_W, BUILDING_Z, buildingX, type DeskSpot } from './layout'

function useSignTexture(text: string) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#2b2a33'
    ctx.fillRect(0, 0, 512, 128)
    ctx.strokeStyle = '#f0a63a'
    ctx.lineWidth = 8
    ctx.strokeRect(8, 8, 496, 112)
    ctx.fillStyle = '#fff4de'
    ctx.font = "600 66px 'Pixelify Sans', monospace"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text.toUpperCase(), 256, 68)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [text])
}

/** Studio extras on top of the voxel walls (world.ts): account sign and string lights. */
export function Building({ index, label }: { index: number; label: string }) {
  const bx = buildingX(index)
  const outer = index === 0 ? -1 : 1
  const sign = useSignTexture(label)
  const backZ = BUILDING_Z - BUILDING_D / 2
  const frontZ = BUILDING_Z + BUILDING_D / 2
  const wallTop = 3.5
  const bulbs = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 1; i < 16; i++) {
      const t = i / 16
      pts.push([bx - BUILDING_W / 2 + t * BUILDING_W, wallTop - 0.1 - (i % 2) * 0.12, backZ + 1.05])
    }
    const sideX = bx + outer * (BUILDING_W / 2 - 0.55)
    for (let i = 1; i < 12; i++) {
      const t = i / 12
      pts.push([sideX, wallTop - 0.15 - (i % 2) * 0.12, backZ + 0.5 + t * (frontZ - backZ - 0.5)])
    }
    return pts
  }, [bx, backZ, frontZ, outer])

  return (
    <group>
      <mesh geometry={GEO.plane} position={[bx, wallTop + 1.05, backZ + 0.52]} scale={[3.6, 0.9, 1]}>
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <B p={[bx, wallTop + 1.05, backZ + 0.48]} s={[3.9, 1.1, 0.06]} c={PAL.ink} />
      <B p={[bx - 1.6, wallTop + 0.3, backZ + 0.48]} s={[0.12, 0.6, 0.06]} c={PAL.woodDark} />
      <B p={[bx + 1.6, wallTop + 0.3, backZ + 0.48]} s={[0.12, 0.6, 0.06]} c={PAL.woodDark} />
      {bulbs.map((p, i) => (
        <mesh key={i} geometry={GEO.box} material={GLOW.bulb} position={p} scale={0.12} />
      ))}
    </group>
  )
}

/** Desk with laptop, chair, mug, lamp; clickable to focus the camera. */
export function Desk({ spot, slot }: { spot: DeskSpot; slot: Slot }) {
  const focusSlot = useStudio((s) => s.focusSlot)
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4caf7a', transparent: true, opacity: 0.7 }), [])
  const [dx, dz] = spot.desk
  const occupied = !!slot.user_id

  useFrame(({ clock }) => {
    const view = deriveSlotView(slot, studioClient.now())
    ringMat.color.set(slotAccent(slot, view))
    const pulsing = view.kind === 'rendering' || view.kind === 'reserved' || view.kind === 'overdue'
    ringMat.opacity = pulsing ? 0.45 + Math.sin(clock.elapsedTime * 4) * 0.3 : 0.65
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        focusSlot(slot.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <mesh ref={ring} geometry={GEO.ring} material={ringMat} position={[dx, 0.03, dz - 0.5]} rotation={[-Math.PI / 2, 0, 0]} scale={4.2} />
      {/* desk */}
      <B p={[dx, 0.8, dz]} s={[1.9, 0.1, 1.0]} c={PAL.wood} cast />
      {[-0.85, 0.85].map((x) => (
        <B key={x} p={[dx + x, 0.38, dz]} s={[0.12, 0.76, 0.9]} c={PAL.woodDark} />
      ))}
      {/* laptop facing the chair (back toward camera side is the lid) */}
      <B p={[dx, 0.87, dz - 0.05]} s={[0.7, 0.04, 0.45]} c={PAL.metalDark} />
      <mesh geometry={GEO.box} material={mat(PAL.metal)} position={[dx, 1.1, dz + 0.17]} rotation={[0.25, 0, 0]} scale={[0.7, 0.45, 0.04]} castShadow />
      <mesh geometry={GEO.box} material={occupied ? GLOW.screen : GLOW.screenOff} position={[dx, 1.1, dz + 0.145]} rotation={[0.25, 0, 0]} scale={[0.62, 0.38, 0.02]} />
      {/* mug */}
      <C p={[dx + 0.65, 0.93, dz - 0.2]} rad={0.08} h={0.16} c={PAL.cream} />
      {/* lamp */}
      <C p={[dx - 0.72, 0.87, dz + 0.25]} rad={0.1} h={0.04} c={PAL.ink} />
      <B p={[dx - 0.72, 1.1, dz + 0.25]} s={[0.04, 0.45, 0.04]} c={PAL.ink} />
      <mesh geometry={GEO.cone} material={mat(PAL.amber)} position={[dx - 0.62, 1.35, dz + 0.2]} rotation={[0, 0, -0.9]} scale={[0.26, 0.2, 0.26]} />
      <mesh geometry={GEO.ico} material={GLOW.lamp} position={[dx - 0.56, 1.29, dz + 0.17]} scale={0.08} />
      {/* chair */}
      <group position={[spot.chair[0], 0, spot.chair[1]]}>
        <B p={[0, 0.04, 0]} s={[0.5, 0.08, 0.5]} c={PAL.ink} />
        <B p={[0, 0.32, 0]} s={[0.1, 0.5, 0.1]} c={PAL.metalDark} />
        <B p={[0, 0.6, 0]} s={[0.6, 0.12, 0.55]} c={PAL.tealDark} cast />
        <B p={[0, 0.98, -0.27]} s={[0.6, 0.65, 0.1]} c={PAL.tealDark} cast />
      </group>
    </group>
  )
}

/** DOM plate pinned above a desk (rendered outside the Canvas): name, status icon, time left, progress. */
export function DeskPlate({ spot, slot, snapshot, actorId }: { spot: DeskSpot; slot: Slot; snapshot: Snapshot; actorId: string | null }) {
  const now = useNow(1000)
  const focusSlot = useStudio((s) => s.focusSlot)
  const view = deriveSlotView(slot, now)
  const accent = slotAccent(slot, view)
  const holder = snapshot.profiles.find((p) => p.id === (slot.user_id ?? slot.hold_user_id))
  const mine = !!actorId && (slot.user_id === actorId || slot.hold_user_id === actorId)
  const pulse = view.kind === 'rendering' || view.kind === 'reserved'
  // Left desk's plate extends left, right desk's extends right, so neighbours never overlap.
  const anchor = useAnchor(`desk:${slot.id}`, spot.desk[0], spot.side < 0 ? 2.4 : 3.4, spot.desk[1], spot.side < 0 ? -0.85 : -0.15)

  let icon: IconName = 'block'
  let line = 'Free'
  if (view.kind === 'reserved') {
    icon = 'ticket'
    line = `Reserved · ${formatDuration(view.holdRemainingMs ?? 0)}`
  } else if (slot.status) {
    icon = STATUS_META[slot.status].icon
    line =
      view.kind === 'rendering' && view.renderRemainingMs !== null
        ? `Render ${formatDuration(view.renderRemainingMs)}`
        : view.overdue
          ? `Over ${formatDuration(view.remainingMs)}`
          : `${formatDuration(view.remainingMs)} left`
  }

  return (
    <div ref={anchor} className="absolute left-0 top-0 will-change-transform">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => focusSlot(slot.id)}
        className={`px-panel w-36 select-none px-2 py-1 text-left text-ink ${pulse ? 'pulse' : ''}`}
        style={{ borderColor: accent, ['--pulse-color' as string]: accent }}
      >
        <div className="flex items-center gap-1 text-[11px] font-semibold leading-tight">
          <PixelIcon name={icon} size={14} />
          <span className="truncate">{holder?.name ?? `Slot ${slot.slot_number}`}</span>
          {mine && <span className="text-accent">(you)</span>}
        </div>
        <div className="font-pixel text-[10px] uppercase leading-tight" style={{ color: accent }}>
          {line}
        </div>
        {slot.user_id && (
          <div className="px-bar mt-0.5 h-2">
            <span style={{ width: `${view.progress * 100}%`, color: accent }} />
          </div>
        )}
      </button>
    </div>
  )
}
