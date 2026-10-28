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
    ctx.font = 'bold 64px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text.toUpperCase(), 256, 68)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [text])
}

/** Open-front studio: back wall, one side wall, wood floor, string lights, sign. */
export function Building({ index, label }: { index: number; label: string }) {
  const bx = buildingX(index)
  const outer = index === 0 ? -1 : 1
  const sign = useSignTexture(label)
  const backZ = BUILDING_Z - BUILDING_D / 2
  const frontZ = BUILDING_Z + BUILDING_D / 2
  const wallH = 3.2
  const bulbs = useMemo(() => {
    const pts: [number, number, number][] = []
    for (const x0 of [bx - BUILDING_W / 2 + 0.2, bx + BUILDING_W / 2 - 0.2]) {
      for (let i = 1; i < 9; i++) {
        const t = i / 9
        pts.push([x0, wallH - Math.sin(t * Math.PI) * 0.45, backZ + t * (frontZ - backZ)])
      }
    }
    for (let i = 1; i < 10; i++) {
      const t = i / 10
      pts.push([bx - BUILDING_W / 2 + t * BUILDING_W, wallH - 0.1 - Math.sin(t * Math.PI) * 0.4, frontZ])
    }
    return pts
  }, [bx, backZ, frontZ])

  return (
    <group>
      {/* foundation + plank floor */}
      <B p={[bx, 0.12, BUILDING_Z]} s={[BUILDING_W + 0.4, 0.24, BUILDING_D + 0.4]} c={PAL.stoneDark} />
      {Array.from({ length: 8 }, (_, i) => (
        <B key={i} p={[bx - BUILDING_W / 2 + 0.5 + i, 0.27, BUILDING_Z]} s={[0.96, 0.06, BUILDING_D]} c={i % 2 ? PAL.plank : PAL.wood} />
      ))}
      {/* back wall: brick base, plaster upper, windows */}
      <B p={[bx, 1.0, backZ]} s={[BUILDING_W, 1.6, 0.3]} c={PAL.brick} cast />
      <B p={[bx, 2.4, backZ]} s={[BUILDING_W, 1.6, 0.3]} c={PAL.plaster} cast />
      {[-2.4, 0, 2.4].map((dx) => (
        <group key={dx}>
          <mesh geometry={GEO.box} material={GLOW.window} position={[bx + dx, 2.3, backZ + 0.17]} scale={[1.1, 0.9, 0.04]} />
          <B p={[bx + dx, 2.3, backZ + 0.2]} s={[0.06, 0.9, 0.04]} c={PAL.woodDark} />
          <B p={[bx + dx, 1.8, backZ + 0.22]} s={[1.3, 0.08, 0.1]} c={PAL.woodDark} />
        </group>
      ))}
      {/* side wall */}
      <B p={[bx + outer * BUILDING_W / 2, wallH / 2 + 0.2, BUILDING_Z]} s={[0.3, wallH, BUILDING_D]} c={PAL.plaster} cast />
      <B p={[bx + outer * BUILDING_W / 2, 0.7, BUILDING_Z]} s={[0.32, 1.0, BUILDING_D]} c={PAL.brickDark} />
      <mesh geometry={GEO.box} material={GLOW.window} position={[bx + outer * (BUILDING_W / 2 - 0.17), 2.2, BUILDING_Z]} scale={[0.04, 0.9, 1.6]} />
      {/* beams + front posts */}
      <B p={[bx, wallH + 0.3, backZ]} s={[BUILDING_W + 0.4, 0.3, 0.5]} c={PAL.woodDark} cast />
      <B p={[bx + outer * BUILDING_W / 2, wallH + 0.3, BUILDING_Z]} s={[0.5, 0.3, BUILDING_D + 0.4]} c={PAL.woodDark} />
      {[-1, 1].map((sx) => (
        <C key={sx} p={[bx + sx * (BUILDING_W / 2 - 0.2), wallH / 2 + 0.2, frontZ]} rad={0.12} h={wallH} c={PAL.woodDark} cast />
      ))}
      {/* teal awning on the back wall */}
      <mesh geometry={GEO.box} material={mat(PAL.teal)} position={[bx, wallH + 0.55, backZ + 0.5]} rotation={[0.35, 0, 0]} scale={[BUILDING_W + 0.2, 0.12, 1.2]} castShadow />
      {/* sign */}
      <mesh geometry={GEO.plane} position={[bx, wallH + 1.25, backZ + 0.05]} scale={[3.6, 0.9, 1]}>
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <B p={[bx, wallH + 1.25, backZ - 0.04]} s={[3.8, 1.05, 0.1]} c={PAL.ink} />
      {/* string lights */}
      {bulbs.map((p, i) => (
        <mesh key={i} geometry={GEO.ico} material={GLOW.bulb} position={p} scale={0.11} />
      ))}
      {/* plant + shelf */}
      <B p={[bx - outer * 3.3, 0.7, backZ + 0.45]} s={[0.9, 0.9, 0.5]} c={PAL.woodDark} />
      <mesh geometry={GEO.ico} material={mat(PAL.leaf)} position={[bx - outer * 3.3, 1.5, backZ + 0.45]} scale={0.7} />
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
      <mesh ref={ring} geometry={GEO.ring} material={ringMat} position={[dx, 0.31, dz - 0.5]} rotation={[-Math.PI / 2, 0, 0]} scale={4.2} />
      {/* desk */}
      <B p={[dx, 0.8, dz]} s={[1.9, 0.1, 1.0]} c={PAL.wood} cast />
      {[-0.85, 0.85].map((x) => (
        <B key={x} p={[dx + x, 0.55, dz]} s={[0.1, 0.5, 0.9]} c={PAL.woodDark} />
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
        <C p={[0, 0.32, 0]} rad={0.25} h={0.06} c={PAL.ink} />
        <C p={[0, 0.45, 0]} rad={0.04} h={0.3} c={PAL.metalDark} />
        <B p={[0, 0.62, 0]} s={[0.6, 0.1, 0.55]} c={PAL.tealDark} cast />
        <B p={[0, 0.98, -0.27]} s={[0.6, 0.65, 0.08]} c={PAL.tealDark} cast />
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

  let icon = '🟢'
  let line = 'Free'
  if (view.kind === 'reserved') {
    icon = '🎟️'
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
        className={`w-32 select-none rounded-lg border-2 bg-surface/95 px-2 py-1 text-left text-ink shadow-lg ${pulse ? 'pulse' : ''}`}
        style={{ borderColor: accent, ['--pulse-color' as string]: `${accent}88` }}
      >
        <div className="flex items-center gap-1 text-[11px] font-semibold leading-tight">
          <span aria-hidden>{icon}</span>
          <span className="truncate">{holder?.name ?? `Slot ${slot.slot_number}`}</span>
          {mine && <span className="text-accent">(you)</span>}
        </div>
        <div className="text-[10px] leading-tight" style={{ color: accent }}>
          {line}
        </div>
        {slot.user_id && (
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full" style={{ width: `${view.progress * 100}%`, background: accent }} />
          </div>
        )}
      </button>
    </div>
  )
}
