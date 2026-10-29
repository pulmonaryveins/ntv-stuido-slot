import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Slot, Snapshot } from '../data'
import { deriveSlotView } from '../lib/slotState'
import { formatClock, formatDuration } from '../lib/format'
import { slotAccent } from '../ui/SlotCard'
import { useNow } from '../ui/useNow'
import { useStudio } from '../store/studio'
import { studioClient } from '../data'
import { B, C, GEO, GLOW, PAL } from './kit'
import { useAnchor } from './anchors'
import { PixelIcon, type IconName } from '../ui/PixelIcon'
import { UserAvatar } from '../ui/UserAvatar'
import { CUBE_BACK, CUBE_FRONT, CUBE_W, buildingX, type DeskSpot } from './layout'

const BOOTH_ACCENT = ['#c9a670', '#7a5a3c']

function useSignTexture(text: string, accent: string) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    // Wooden sign board: plank face with grain lines, dark lettering.
    ctx.fillStyle = '#b8945f'
    ctx.fillRect(0, 0, 512, 128)
    ctx.fillStyle = '#a3824f'
    for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 512, 3)
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, 18, 128)
    ctx.fillStyle = '#2a1d10'
    ctx.font = "600 62px 'Pixelify Sans', monospace"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text.toUpperCase(), 270, 68)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [text, accent])
}

const PANEL_H = 1.35
const NOTE_COLORS = ['#f7e26b', '#f59fb5', '#8fd3f0', '#b6e388']

/**
 * Cubicle pod for one Adobe account: two cubicles sharing a back panel and a middle panel,
 * fabric partitions in the account colour with aluminium caps, open toward the camera, and the
 * account name hung above. Desks/chairs are added per slot by <Desk>.
 */
export function Building({ index, label }: { index: number; label: string }) {
  const bx = buildingX(index)
  const accent = BOOTH_ACCENT[index % BOOTH_ACCENT.length]!
  // Account 1 in oak, account 2 in spruce planks.
  const fabric = index === 0 ? '#b8945f' : '#7a5a3c'
  const sign = useSignTexture(label, accent)
  const depth = CUBE_FRONT - CUBE_BACK
  const midZ = (CUBE_BACK + CUBE_FRONT) / 2

  const Panel = ({ x, z, w, d }: { x: number; z: number; w: number; d: number }) => (
    <group>
      <B p={[x, PANEL_H / 2, z]} s={[w, PANEL_H, d]} c={fabric} cast />
      <B p={[x, PANEL_H + 0.05, z]} s={[w + 0.08, 0.1, d + 0.08]} c="#6b4f2e" />
      <B p={[x, 0.06, z]} s={[w + 0.06, 0.12, d + 0.06]} c="#8a8a8a" />
    </group>
  )

  return (
    <group>
      {/* back panel across both cubicles */}
      <Panel x={bx} z={CUBE_BACK} w={CUBE_W * 2} d={0.1} />
      {/* side panels: outer left, shared middle, outer right */}
      {[-CUBE_W, 0, CUBE_W].map((dx) => (
        <Panel key={dx} x={bx + dx} z={midZ} w={0.1} d={depth} />
      ))}
      {/* sticky notes and a calendar pinned to the fabric (inside faces) */}
      {[-1, 1].map((side) => (
        <group key={side} position={[bx + side * (CUBE_W / 2), 0, CUBE_BACK + 0.06]}>
          {NOTE_COLORS.map((c, i) => (
            <B key={c} p={[-1.25 + i * 0.22 + (side > 0 ? 1.7 : 0), 1.15 - (i % 2) * 0.18, 0]} s={[0.16, 0.16, 0.01]} c={c} />
          ))}
          <B p={[side > 0 ? -1.1 : 1.1, 1.05, 0]} s={[0.36, 0.42, 0.01]} c="#fbfbf8" />
          <B p={[side > 0 ? -1.1 : 1.1, 1.22, 0.005]} s={[0.36, 0.08, 0.01]} c={accent} />
        </group>
      ))}
      {/* plant on the middle panel's cap */}
      <B p={[bx, PANEL_H + 0.18, CUBE_FRONT - 0.35]} s={[0.22, 0.24, 0.22]} c="#c4683f" />
      <B p={[bx, PANEL_H + 0.4, CUBE_FRONT - 0.35]} s={[0.3, 0.22, 0.3]} c={PAL.leaf} />
      {/* account sign hung above the pod */}
      {[-1.5, 1.5].map((dx) => (
        <B key={dx} p={[bx + dx, PANEL_H + 0.85, CUBE_BACK]} s={[0.12, 1.6, 0.12]} c="#6b4f2e" />
      ))}
      <mesh geometry={GEO.plane} position={[bx, PANEL_H + 2.1, CUBE_BACK + 0.04]} scale={[3.4, 0.85, 1]}>
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <B p={[bx, PANEL_H + 2.1, CUBE_BACK]} s={[3.6, 1.0, 0.1]} c="#4e3a22" />
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
      <mesh ref={ring} geometry={GEO.ring} material={ringMat} position={[dx, 0.03, (dz + spot.chair[1]) / 2]} rotation={[-Math.PI / 2, 0, 0]} scale={4.6} />
      {/* cubicle work surface fixed to the back panel, pedestal drawers underneath */}
      <B p={[dx, 0.76, dz]} s={[CUBE_W - 0.2, 0.1, 0.9]} c="#c9a670" cast />
      <B p={[dx, 0.7, dz + 0.44]} s={[CUBE_W - 0.2, 0.06, 0.04]} c="#6b4f2e" />
      {/* drawer chest under the desk */}
      <B p={[dx + spot.side * 1.25, 0.36, dz]} s={[0.6, 0.72, 0.8]} c="#5e4630" cast />
      {[0.2, 0.45].map((y) => (
        <B key={y} p={[dx + spot.side * 1.25, y, dz + 0.41]} s={[0.12, 0.06, 0.02]} c="#c9c9c9" />
      ))}
      {/* dual monitors facing the user (and the camera) */}
      {[-0.42, 0.42].map((ox) => (
        <group key={ox} position={[dx + ox, 0, dz - 0.15]} rotation={[0, -ox * 0.35, 0]}>
          <B p={[0, 0.82, 0]} s={[0.24, 0.04, 0.18]} c={PAL.ink} />
          <B p={[0, 0.95, -0.02]} s={[0.05, 0.25, 0.05]} c={PAL.ink} />
          <B p={[0, 1.22, 0]} s={[0.76, 0.46, 0.05]} c={PAL.ink} cast />
          <mesh geometry={GEO.box} material={occupied ? GLOW.screen : GLOW.screenOff} position={[0, 1.22, 0.03]} scale={[0.68, 0.38, 0.01]} />
        </group>
      ))}
      {/* keyboard, mouse, mug, lamp */}
      <B p={[dx, 0.8, dz + 0.22]} s={[0.62, 0.03, 0.2]} c={PAL.ink} />
      <B p={[dx + 0.48, 0.8, dz + 0.24]} s={[0.08, 0.03, 0.12]} c={PAL.ink} />
      <C p={[dx - 0.75, 0.86, dz + 0.15]} rad={0.07} h={0.15} c={PAL.cream} />
      <B p={[dx - spot.side * 1.4, 0.82, dz - 0.25]} s={[0.16, 0.06, 0.16]} c={PAL.ink} />
      <B p={[dx - spot.side * 1.4, 1.05, dz - 0.25]} s={[0.04, 0.42, 0.04]} c={PAL.ink} />
      <mesh geometry={GEO.box} material={GLOW.lamp} position={[dx - spot.side * 1.4, 1.26, dz - 0.15]} scale={[0.22, 0.08, 0.22]} />
      {/* black swivel chair; the backrest is behind the user, toward the cubicle opening */}
      <group position={[spot.chair[0], 0, spot.chair[1]]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <B key={i} p={[Math.sin((i / 5) * Math.PI * 2) * 0.17, 0.05, Math.cos((i / 5) * Math.PI * 2) * 0.17]} s={[0.07, 0.05, 0.34]} r={(i / 5) * Math.PI * 2} c={PAL.ink} />
        ))}
        <B p={[0, 0.32, 0]} s={[0.07, 0.5, 0.07]} c={PAL.metal} />
        <B p={[0, 0.6, 0]} s={[0.62, 0.12, 0.58]} c="#7a5a3c" cast />
        <B p={[0, 1.02, 0.29]} s={[0.56, 0.7, 0.08]} c="#7a5a3c" cast />
        <B p={[0, 1.42, 0.29]} s={[0.34, 0.16, 0.08]} c="#4e3a22" />
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
  // Left desk's plate extends left, right desk's extends right; the projector un-overlaps the rest.
  const anchor = useAnchor(`desk:${slot.id}`, spot.desk[0], 1.7, spot.desk[1], spot.side < 0 ? -0.85 : -0.15)

  const state =
    view.kind === 'reserved'
      ? `Held ${formatDuration(view.holdRemainingMs ?? 0)}`
      : !slot.user_id
        ? 'Free'
        : view.overdue
          ? `Over ${formatDuration(view.remainingMs)}`
          : `${formatDuration(view.remainingMs)} left`
  const icon: IconName = view.kind === 'reserved' ? 'ticket' : slot.user_id ? 'brush' : 'block'
  const end = slot.user_id ? now + view.remainingMs : null

  // Compact by default (desks sit close together); details are on the card in the side panel.
  return (
    <div ref={anchor} className="absolute left-0 top-0 will-change-transform">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => focusSlot(slot.id)}
        title={end !== null ? `Until ${formatClock(end)}` : undefined}
        className={`on-dark block w-40 select-none border-2 border-black bg-[#1e1e1f] text-left text-ink shadow-[2px_2px_0_rgba(0,0,0,0.35)] ${pulse ? 'pulse' : ''} ${
          mine ? 'outline-2 outline-accent' : ''
        }`}
        style={{ ['--pulse-color' as string]: accent }}
      >
        <div className="flex items-center gap-1 px-1.5 py-0.5 text-black" style={{ background: accent }}>
          <PixelIcon name={icon} size={10} />
          <span className="font-pixel text-[10px] uppercase">Slot {slot.slot_number}</span>
          <span className="ml-auto font-pixel text-[10px] uppercase tabular-nums">{state}</span>
        </div>
        <div className="flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-semibold leading-none">
          {holder ? (
            <>
              <UserAvatar profile={holder} size={18} />
              <span className="min-w-0 flex-1 truncate">{holder.name}</span>
              {mine && <span className="shrink-0 bg-accent px-1 py-px font-pixel text-[9px] uppercase text-white">You</span>}
              {/* Hostname: what Adobe lists. Never truncated. */}
              {slot.user_id && (
                <span className="shrink-0 border border-black bg-white px-1 py-px font-mono text-[10px] font-bold text-black">
                  {slot.device_name ?? '?'}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted">Available</span>
          )}
        </div>
        {slot.user_id && (
          <div className="h-1 bg-black/60">
            <div className="h-full" style={{ width: `${Math.min(1, view.progress) * 100}%`, background: accent }} />
          </div>
        )}
      </button>
    </div>
  )
}
