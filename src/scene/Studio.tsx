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
import { BUILDING_D, BUILDING_Z, buildingX, type DeskSpot } from './layout'

const BOOTH_ACCENT = ['#5e7290', '#6f8a6f']

function useSignTexture(text: string, accent: string) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#23252c'
    ctx.fillRect(0, 0, 512, 128)
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, 28, 128)
    ctx.fillStyle = '#f4f1ea'
    ctx.font = "600 62px 'Pixelify Sans', monospace"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text.toUpperCase(), 270, 68)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [text, accent])
}

/** Office booth extras on top of the voxel walls (world.ts): name plate, whiteboard, wall clock. */
export function Building({ index, label }: { index: number; label: string }) {
  const bx = buildingX(index)
  const outer = index === 0 ? -1 : 1
  const accent = BOOTH_ACCENT[index % BOOTH_ACCENT.length]!
  const sign = useSignTexture(label, accent)
  const backZ = BUILDING_Z - BUILDING_D / 2
  const wallFace = backZ + 0.52
  const wallTop = 3.5

  return (
    <group>
      {/* name plate standing on the wall cap */}
      <mesh geometry={GEO.plane} position={[bx, wallTop + 0.55, backZ + 0.28]} scale={[3.4, 0.85, 1]}>
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <B p={[bx, wallTop + 0.55, backZ + 0.24]} s={[3.5, 0.95, 0.06]} c={PAL.metalDark} />
      {/* whiteboard with marker scribbles */}
      <B p={[bx, 1.75, wallFace]} s={[2.5, 1.1, 0.05]} c={PAL.metal} />
      <B p={[bx, 1.75, wallFace + 0.03]} s={[2.36, 0.96, 0.02]} c="#fbfbf8" />
      <B p={[bx - 0.6, 2.0, wallFace + 0.045]} s={[0.8, 0.05, 0.01]} c="#3a6fd8" />
      <B p={[bx - 0.75, 1.82, wallFace + 0.045]} s={[0.5, 0.05, 0.01]} c="#3a6fd8" />
      <B p={[bx + 0.55, 1.85, wallFace + 0.045]} s={[0.55, 0.4, 0.01]} c={accent} />
      <B p={[bx - 0.2, 1.5, wallFace + 0.045]} s={[1.2, 0.05, 0.01]} c="#d84a3a" />
      <B p={[bx, 1.24, wallFace + 0.06]} s={[2.2, 0.05, 0.1]} c={PAL.metalDark} />
      {/* wall clock */}
      <group position={[bx + outer * 2.9, 2.1, wallFace]}>
        <B p={[0, 0, 0]} s={[0.5, 0.5, 0.05]} c={PAL.ink} />
        <B p={[0, 0, 0.03]} s={[0.42, 0.42, 0.02]} c="#fbfbf8" />
        <B p={[0, 0.07, 0.045]} s={[0.03, 0.15, 0.01]} c={PAL.ink} />
        <B p={[0.06, 0, 0.045]} s={[0.12, 0.03, 0.01]} c={PAL.ink} />
      </group>
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
      {/* office desk: white top, aluminium side frames, modesty panel */}
      <B p={[dx, 0.8, dz]} s={[1.9, 0.08, 1.0]} c="#f1eee8" cast />
      {[-0.88, 0.88].map((x) => (
        <group key={x}>
          <B p={[dx + x, 0.38, dz - 0.38]} s={[0.07, 0.76, 0.07]} c={PAL.metal} />
          <B p={[dx + x, 0.38, dz + 0.38]} s={[0.07, 0.76, 0.07]} c={PAL.metal} />
          <B p={[dx + x, 0.05, dz]} s={[0.08, 0.06, 0.95]} c={PAL.metal} />
        </group>
      ))}
      <B p={[dx, 0.5, dz + 0.42]} s={[1.7, 0.5, 0.04]} c={PAL.metalDark} />
      {/* papers, pen cup, little succulent */}
      <B p={[dx + 0.3, 0.85, dz - 0.25]} s={[0.3, 0.02, 0.22]} c="#ffffff" r={0.2} />
      <B p={[dx + 0.82, 0.92, dz + 0.3]} s={[0.1, 0.16, 0.1]} c={PAL.ink} />
      <B p={[dx + 0.55, 0.88, dz + 0.32]} s={[0.12, 0.08, 0.12]} c="#c4683f" />
      <B p={[dx + 0.55, 0.97, dz + 0.32]} s={[0.1, 0.1, 0.1]} c={PAL.leaf} />
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
      {/* black office chair: five-star base, gas lift, seat, mesh back with headrest, arms */}
      <group position={[spot.chair[0], 0, spot.chair[1]]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <B key={i} p={[Math.sin((i / 5) * Math.PI * 2) * 0.17, 0.05, Math.cos((i / 5) * Math.PI * 2) * 0.17]} s={[0.07, 0.05, 0.34]} r={(i / 5) * Math.PI * 2} c={PAL.ink} />
        ))}
        <B p={[0, 0.32, 0]} s={[0.07, 0.5, 0.07]} c={PAL.metal} />
        <B p={[0, 0.6, 0]} s={[0.62, 0.12, 0.58]} c="#2b2d35" cast />
        <B p={[0, 1.02, -0.29]} s={[0.56, 0.7, 0.08]} c="#2b2d35" cast />
        <B p={[0, 1.42, -0.29]} s={[0.34, 0.16, 0.08]} c="#2b2d35" />
        {[-0.33, 0.33].map((x) => (
          <B key={x} p={[x, 0.82, 0]} s={[0.06, 0.06, 0.38]} c={PAL.ink} />
        ))}
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
