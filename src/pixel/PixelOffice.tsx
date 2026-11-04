import { useEffect, useMemo, useRef, useState } from 'react'
import type { Slot, Snapshot } from '../data'
import { studioClient } from '../data'
import { deriveSlotView } from '../lib/slotState'
import { formatClock, formatDuration, toMs } from '../lib/format'
import { useStudio } from '../store/studio'
import { slotAccent } from '../ui/SlotCard'
import { UserAvatar } from '../ui/UserAvatar'
import { useNow } from '../ui/useNow'
import { DOOR, H, IDLE_SPOTS, LOUNGE, ROWS, W, WAIT_SEATS, WAIT_STAND, deskLayouts, route, type DeskLayout, type P, type Spot } from './layout'
import { drawChair, drawCharacter, drawDesk, drawFurniture, drawNight, drawRoom, lookFor, type DeskState, type Facing } from './sprites'

/**
 * Top-down pixel-art office. Drawn on a small canvas at true pixel size and scaled up with
 * nearest-neighbour; DOM labels sit on top in the same coordinates.
 */

const WALK_SPEED = 44 // logical px per second
const KNOCK_MS = 4500

interface Station extends Spot {
  key: string
}

interface Sim {
  x: number
  y: number
  path: P[]
  face: Facing
  key: string
  sit: boolean
  moving: boolean
  /** Approach waypoints of the spot they're at (walked in reverse when leaving). */
  via: P[]
}

function deskState(slot: Slot, now: number): DeskState {
  const v = deriveSlotView(slot, now)
  if (v.kind === 'reserved') return 'reserved'
  if (!slot.user_id) return 'free'
  return v.overdue ? 'overdue' : 'in_use'
}

function isNight(mode: 'auto' | 'day' | 'night', now: number) {
  if (mode !== 'auto') return mode === 'night'
  const h = new Date(now).getHours()
  return h >= 19 || h < 6
}

function hashString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Where everyone should be, from board state + recent knocks. */
function computeStations(snapshot: Snapshot, desks: DeskLayout[], knocks: { userId: string; slotId: number; at: number }[], nowMs: number, nowPerf: number) {
  const out = new Map<string, Station>()
  for (const d of desks) {
    const s = snapshot.slots.find((x) => x.id === d.slotId)
    if (s?.user_id) out.set(s.user_id, { ...d.seat, key: `seat:${d.slotId}` })
  }
  const queue = [...snapshot.queue].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)
  queue.forEach((q, i) => {
    if (out.has(q.user_id)) return
    const seat = WAIT_SEATS[i]
    out.set(q.user_id, seat ? { ...seat, key: `sofa:${i}` } : { ...WAIT_STAND[(i - WAIT_SEATS.length) % WAIT_STAND.length]!, key: `wait:${i}` })
  })
  for (const k of knocks) {
    if (nowPerf - k.at > KNOCK_MS || out.get(k.userId)?.key.startsWith('seat:')) continue
    const d = desks.find((x) => x.slotId === k.slotId)
    if (d) out.set(k.userId, { ...d.knock, key: `knock:${k.slotId}` })
  }
  // Everyone else moves between idle spots on their own rhythm, never sharing a spot.
  const taken = new Set<number>()
  for (const p of [...snapshot.profiles].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!p.active || out.has(p.id)) continue
    const h = hashString(p.id)
    const period = 14000 + (h % 9000)
    const round = Math.floor((nowMs + h * 7) / period)
    let c = hashString(`${p.id}:${round}`) % IDLE_SPOTS.length
    for (let n = 0; n < IDLE_SPOTS.length && taken.has(c); n++) c = (c + 1) % IDLE_SPOTS.length
    taken.add(c)
    out.set(p.id, { ...IDLE_SPOTS[c]!, key: `idle:${c}` })
  }
  return out
}

export default function PixelOffice({ active }: { active: boolean }) {
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const timeMode = useStudio((s) => s.timeMode)
  const sceneEvents = useStudio((s) => s.sceneEvents)
  const openClaim = useStudio((s) => s.openClaim)
  const now = useNow(1000)

  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [scale, setScale] = useState(2)
  const [hover, setHover] = useState<number | null>(null)
  const night = isNight(timeMode, now)
  const ready = !!snapshot

  const desks = useMemo(
    () => (snapshot ? deskLayouts(snapshot.slots, snapshot.accounts.map((a) => a.id)) : []),
    [snapshot],
  )

  // Fit the canvas in half steps so pixels stay nearly even.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e!.contentRect
      const fit = Math.min((width - 24) / W, (height - 24) / H)
      setScale(Math.max(0.5, Math.floor(fit * 2) / 2))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Static background (room + furniture), redrawn only for day/night.
  const background = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!
    drawRoom(ctx, night)
    drawFurniture(ctx)
    return c
  }, [night])

  const tiles = useMemo(() => ({ grass: groundTile('grass'), stone: groundTile('stone') }), [])

  const live = useRef({ snapshot, desks, actorId, night, hover, sceneEvents, background })
  live.current = { snapshot, desks, actorId, night, hover, sceneEvents, background }
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  const sims = useRef(new Map<string, Sim>())
  const tags = useRef(new Map<string, HTMLDivElement>())
  const reducedMotion = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])

  useEffect(() => {
    if (!active) return
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    let raf = 0
    let last = performance.now()
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      const L = live.current
      if (!L.snapshot) return
      const nowMs = studioClient.now()
      const knocks = L.sceneEvents.filter((e) => e.kind === 'knock' && e.userId).map((e) => ({ userId: e.userId!, slotId: e.slotId, at: e.at }))
      const stations = computeStations(L.snapshot, L.desks, knocks, nowMs, t)

      for (const [id, st] of stations) {
        let s = sims.current.get(id)
        if (!s) {
          s = { x: DOOR.x, y: DOOR.y, path: [], face: 'up', key: '', sit: false, moving: false, via: [] }
          sims.current.set(id, s)
        }
        if (s.key !== st.key) {
          s.path = reducedMotion ? [] : route({ p: { x: s.x, y: s.y }, via: s.via }, st)
          if (reducedMotion) Object.assign(s, { x: st.p.x, y: st.p.y })
          s.key = st.key
          s.sit = false
          s.via = st.via
        }
        s.moving = false
        if (s.path.length) {
          const tgt = s.path[0]!
          const dx = tgt.x - s.x
          const dy = tgt.y - s.y
          const dist = Math.hypot(dx, dy)
          const step = WALK_SPEED * dt
          if (dist <= step) {
            s.x = tgt.x
            s.y = tgt.y
            s.path.shift()
          } else {
            s.x += (dx / dist) * step
            s.y += (dy / dist) * step
            s.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
            s.moving = true
          }
        }
        if (!s.path.length) {
          s.face = st.face
          s.sit = st.sit
        }
      }
      for (const id of [...sims.current.keys()]) if (!stations.has(id)) sims.current.delete(id)

      // draw: background, chairs, then everything depth-sorted by its base line
      ctx.drawImage(L.background, 0, 0)
      for (const d of L.desks) drawChair(ctx, d)
      const slotsById = new Map(L.snapshot.slots.map((s) => [s.id, s]))
      type Item = { y: number; draw: () => void }
      const items: Item[] = []
      for (const d of L.desks) {
        const slot = slotsById.get(d.slotId)
        if (!slot) continue
        const state = deskState(slot, nowMs)
        const mine = !!L.actorId && slot.user_id === L.actorId
        items.push({ y: d.desk.y + d.desk.h, draw: () => drawDesk(ctx, d, state, mine, L.hover === d.slotId, t / 1000) })
      }
      for (const [id, s] of sims.current) {
        const p = L.snapshot.profiles.find((x) => x.id === id)
        if (!p) continue
        const stepFrame = s.moving ? Math.floor(t / 140) % 2 : 0
        items.push({ y: s.y, draw: () => drawCharacter(ctx, s.x, s.y, lookFor(id, p.avatar_color), s.face, stepFrame, s.sit) })
      }
      items.sort((a, b) => a.y - b.y).forEach((i) => i.draw())
      if (L.night) {
        drawNight(ctx, [
          ...L.desks.map((d) => ({ x: d.desk.x + d.desk.w / 2, y: d.desk.y + 4 })),
          { x: LOUNGE.table.x + LOUNGE.table.w / 2, y: LOUNGE.table.y },
        ])
      }

      // floating tags (YOU / queue position) follow their characters
      for (const [id, el] of tags.current) {
        const s = sims.current.get(id)
        if (!s) {
          el.style.visibility = 'hidden'
          continue
        }
        el.style.visibility = 'visible'
        el.style.transform = `translate(${Math.round(s.x * scaleRef.current)}px, ${Math.round((s.y - (s.sit ? 15 : 18)) * scaleRef.current)}px) translate(-50%, -100%)`
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // `ready`: the canvas only exists once the board has loaded.
  }, [active, reducedMotion, ready])

  const toLogical = (e: React.PointerEvent | React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  const deskAt = (p: P) => desks.find((d) => p.x >= d.desk.x - 6 && p.x <= d.desk.x + d.desk.w + 6 && p.y >= d.desk.y - 18 && p.y <= d.panel.y + d.panel.h)

  if (!snapshot) return null
  const tile = 32 * scale
  const queue = [...snapshot.queue].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)
  const me = snapshot.profiles.find((p) => p.id === actorId)

  return (
    <div ref={wrap} className="relative grid h-full w-full place-items-center overflow-hidden">
      {/* garden around the office (dimmed at night; the office does its own night lighting) */}
      <div
        aria-hidden
        className="absolute inset-0 [image-rendering:pixelated]"
        style={{ filter: night ? 'brightness(0.5) saturate(0.8)' : undefined }}
      >
        <div className="absolute inset-0" style={{ backgroundImage: `url(${tiles.grass})`, backgroundSize: `${tile}px ${tile}px`, backgroundPosition: 'center' }} />
        {/* stone path from the door to the edge of the view */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{ top: `calc(50% + ${(H * scale) / 2 - 2}px)`, width: 30 * scale, backgroundImage: `url(${tiles.stone})`, backgroundSize: `${tile}px ${tile}px` }}
        />
      </div>
      <div className="relative shadow-[0_10px_0_rgba(0,0,0,0.25)]" style={{ width: W * scale, height: H * scale }}>
        <canvas
          ref={canvas}
          width={W}
          height={H}
          role="img"
          aria-label="Office. Use the List view for keyboard access."
          className="block h-full w-full [image-rendering:pixelated]"
          onPointerMove={(e) => {
            const d = deskAt(toLogical(e))
            const id = d?.slotId ?? null
            if (id !== hover) setHover(id)
            const slot = d && snapshot.slots.find((s) => s.id === d.slotId)
            e.currentTarget.style.cursor = slot && !slot.user_id && !slot.hold_user_id ? 'pointer' : 'default'
          }}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const d = deskAt(toLogical(e))
            const slot = d && snapshot.slots.find((s) => s.id === d.slotId)
            if (slot && !slot.user_id) openClaim(slot.id)
          }}
        />

        {/* account name plates above each cubicle row */}
        {snapshot.accounts.slice(0, 2).map((a, i) => (
          <div
            key={a.id}
            className="pointer-events-none absolute -translate-y-1/2 border-2 border-[#5b2d0e] bg-[#fbe6b5] px-2 py-0.5 text-[11px] text-[#4a2511] shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
            style={{ left: (ROWS.x0 + 4) * scale, top: (ROWS.ys[i]! - 26) * scale }}
          >
            <span className="mr-1 inline-grid size-4 place-items-center bg-[#5f9a36] text-[10px] text-[#ffffff]">{i + 1}</span>
            {a.label}
          </div>
        ))}

        {/* status plates on each desk's partition */}
        {desks.map((d) => {
          const slot = snapshot.slots.find((s) => s.id === d.slotId)
          return slot ? (
            <DeskLabel
              key={d.slotId}
              slot={slot}
              snapshot={snapshot}
              now={now}
              mine={slot.user_id === actorId}
              style={{ left: (d.panel.x + 1) * scale, top: (d.panel.y + 1) * scale, width: (d.panel.w - 2) * scale, height: (d.panel.h - 3) * scale }}
            />
          ) : null
        })}

        {me?.active && !snapshot.slots.some((s) => s.user_id === actorId) && (
          <div
            ref={(el) => void (el ? tags.current.set(me.id, el) : tags.current.delete(me.id))}
            className="pointer-events-none absolute left-0 top-0 border-2 border-[#5b2d0e] bg-[#5f9a36] px-1.5 text-[10px] text-[#ffffff]"
          >
            You
          </div>
        )}
        {queue
          .filter((q) => q.user_id !== actorId)
          .map((q) => (
            <div
              key={q.user_id}
              ref={(el) => void (el ? tags.current.set(q.user_id, el) : tags.current.delete(q.user_id))}
              className="pointer-events-none absolute left-0 top-0 border-2 border-[#5b2d0e] bg-[#f2b632] px-1 text-[10px] text-[#4a2511]"
            >
              #{queue.indexOf(q) + 1}
            </div>
          ))}
      </div>
      <p className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-white/45">Click a free desk to claim it</p>
    </div>
  )
}

/** 32×32 pixel tile for the ground around the office: grass with blades, flowers and pebbles. */
function groundTile(kind: 'grass' | 'stone') {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')!
  const rnd = (n: number) => {
    const x = Math.sin(n * 91.7 + (kind === 'grass' ? 13 : 57)) * 43758.5453
    return x - Math.floor(x)
  }
  if (kind === 'grass') {
    ctx.fillStyle = '#5ea44a'
    ctx.fillRect(0, 0, 32, 32)
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = ['#4f9440', '#6cb556', '#57a046'][i % 3]!
      ctx.fillRect(Math.floor(rnd(i) * 32), Math.floor(rnd(i + 100) * 32), 1, 2)
    }
    const flowers = ['#f4f1e8', '#f7d84a', '#e86a8a']
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rnd(i + 300) * 30) + 1
      const y = Math.floor(rnd(i + 400) * 30) + 1
      ctx.fillStyle = flowers[i]!
      ctx.fillRect(x, y, 1, 1)
      ctx.fillRect(x - 1, y + 1, 1, 1)
      ctx.fillRect(x + 1, y + 1, 1, 1)
    }
    ctx.fillStyle = '#9aa0a8'
    ctx.fillRect(Math.floor(rnd(500) * 30), Math.floor(rnd(501) * 30), 2, 1)
  } else {
    ctx.fillStyle = '#b8b2a6'
    ctx.fillRect(0, 0, 32, 32)
    for (let y = 0; y < 32; y += 8)
      for (let x = (y / 8) % 2 ? -8 : 0; x < 32; x += 16) {
        ctx.fillStyle = '#c9c3b6'
        ctx.fillRect(x + 1, y + 1, 14, 6)
        ctx.fillStyle = '#d6d0c3'
        ctx.fillRect(x + 1, y + 1, 14, 1)
      }
  }
  return c.toDataURL()
}

/** Name plate on a desk's partition: state colour, holder and PC, or "Free". */
function DeskLabel({ slot, snapshot, now, mine, style }: { slot: Slot; snapshot: Snapshot; now: number; mine: boolean; style: React.CSSProperties }) {
  const view = deriveSlotView(slot, now)
  const accent = slotAccent(slot, view)
  const holder = snapshot.profiles.find((p) => p.id === (slot.user_id ?? slot.hold_user_id))
  const end = toMs(slot.expected_until)
  const status = !slot.user_id
    ? view.kind === 'reserved'
      ? `Held ${formatDuration(view.holdRemainingMs ?? 0)}`
      : 'Free'
    : view.overdue
      ? `+${formatDuration(view.remainingMs)}`
      : formatDuration(view.remainingMs)
  return (
    <div
      className={`pointer-events-none absolute flex items-center gap-1 overflow-hidden px-1 text-[10px] leading-none text-[#fbe6b5] ${mine ? 'ring-2 ring-[#f2c94c]' : ''}`}
      style={style}
      title={end ? `Until ${formatClock(end)}` : undefined}
    >
      <span className="grid size-3.5 shrink-0 place-items-center text-[9px] font-bold text-white" style={{ background: accent }}>
        {slot.slot_number}
      </span>
      {holder ? (
        <>
          <UserAvatar profile={holder} size={12} className="border-0" />
          <span className="min-w-0 flex-1 truncate font-semibold">{holder.name}</span>
          {slot.user_id && <span className="shrink-0 bg-[#fbe6b5] px-0.5 font-mono text-[9px] font-bold text-[#4a2511]">{slot.device_name ?? '?'}</span>}
          <span className="shrink-0 font-bold" style={{ color: view.overdue ? '#ff8a7a' : '#fbe6b5' }}>
            {status}
          </span>
        </>
      ) : (
        <span className="font-semibold text-[#a8e07c]">{status}</span>
      )}
    </div>
  )
}
