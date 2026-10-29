import { create } from 'zustand'
import { mockClient, mockClock, studioClient, StudioError, type Snapshot, type StudioClient } from '../data'
import { startDemo } from '../data/demo'
import { ERROR_TEXT } from '../lib/status'
import { nameOf } from '../lib/availability'
import { deriveSlotView } from '../lib/slotState'
import { MINUTE } from '../lib/format'

export type View = '3d' | 'list'
export type Page = 'board' | 'admin'
export type Theme = 'light' | 'dark'
export type TimeMode = 'auto' | 'day' | 'night'
export type Speed = 1 | 60 | 240

export interface Toast {
  id: number
  kind: 'turn' | 'knock' | 'ending' | 'render' | 'error' | 'info'
  title: string
  body?: string
  slotId?: number
}

/** Scene effects triggered by activity (knock walk, render celebration). */
export interface SceneEvent {
  id: number
  kind: 'knock' | 'render_done'
  slotId: number
  userId: string | null
  at: number
}

interface StudioState {
  snapshot: Snapshot | null
  loadError: string | null
  view: View
  page: Page
  theme: Theme
  /** The "your device name" dialog (Adobe lists seats by the Windows device name / hostname). */
  deviceDialog: boolean
  timeMode: TimeMode
  focusSlotId: number | null
  demo: boolean
  speed: Speed
  actorId: string | null
  toasts: Toast[]
  /** Board actions currently in flight (drives the progress bar). */
  busy: number
  sceneEvents: SceneEvent[]
  claimFor: number | null
  webgl: boolean
  /** The optional character GLB pack is present (avatars use it instead of blocky figures). */
  charactersAvailable: boolean
  /** Profile pictures rendered from the character pack (null until ready / if unavailable). */
  portraits: string[] | null

  setView(view: View): void
  setPage(page: Page): void
  setTheme(theme: Theme): void
  openDeviceDialog(open: boolean): void
  setTimeMode(mode: TimeMode): void
  focusSlot(slotId: number | null): void
  setDemo(on: boolean): void
  setSpeed(speed: Speed): void
  setActor(userId: string): void
  openClaim(slotId: number | null): void
  pushToast(t: Omit<Toast, 'id'>): void
  dismissToast(id: number): void
  /** Run a client action; failures become error toasts. Resolves true on success. */
  act(fn: (c: StudioClient) => Promise<unknown>): Promise<boolean>
}

const readPref = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const v = localStorage.getItem(key)
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
const writePref = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const webgl = typeof document !== 'undefined' && detectWebGL()
const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

let toastSeq = 0
let stopDemo: (() => void) | null = null

export const useStudio = create<StudioState>((set, get) => ({
  snapshot: null,
  loadError: null,
  view: webgl ? readPref<View>('ss.view', ['3d', 'list'], narrow ? 'list' : '3d') : 'list',
  page: 'board',
  theme: readPref<Theme>('ss.theme', ['light', 'dark'], prefersDark ? 'dark' : 'light'),
  deviceDialog: false,
  timeMode: readPref<TimeMode>('ss.time', ['auto', 'day', 'night'], 'auto'),
  focusSlotId: null,
  demo: false,
  speed: 1,
  actorId: studioClient.currentUserId(),
  toasts: [],
  busy: 0,
  sceneEvents: [],
  claimFor: null,
  webgl,
  charactersAvailable: false,
  portraits: null,

  setView: (view) => {
    if (view === '3d' && !get().webgl) return
    writePref('ss.view', view)
    set({ view })
  },
  setPage: (page) => set({ page }),
  openDeviceDialog: (deviceDialog) => set({ deviceDialog }),
  setTheme: (theme) => {
    writePref('ss.theme', theme)
    set({ theme })
  },
  setTimeMode: (timeMode) => {
    writePref('ss.time', timeMode)
    set({ timeMode })
  },
  focusSlot: (focusSlotId) => set({ focusSlotId }),
  setDemo: (on) => {
    stopDemo?.()
    stopDemo = null
    if (on && mockClient) stopDemo = startDemo(mockClient, () => get().actorId)
    set({ demo: on && !!mockClient })
  },
  setSpeed: (speed) => {
    mockClock.setSpeed(speed)
    set({ speed })
  },
  setActor: (userId) => {
    mockClient?.setActor(userId)
    lastSeenActivity = Math.max(lastSeenActivity, ...(get().snapshot?.activity.map((a) => a.id) ?? [0]))
    warned.clear()
    set({ actorId: userId, page: 'board', claimFor: null })
  },
  openClaim: (claimFor) => set({ claimFor }),
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id: ++toastSeq }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  act: async (fn) => {
    set((s) => ({ busy: s.busy + 1 }))
    try {
      await fn(studioClient)
      return true
    } catch (e) {
      const code = e instanceof StudioError ? e.code : 'unknown'
      get().pushToast({ kind: 'error', title: ERROR_TEXT[code] ?? ERROR_TEXT.unknown! })
      return false
    } finally {
      set((s) => ({ busy: Math.max(0, s.busy - 1) }))
    }
  },
}))

// --- live wiring -------------------------------------------------------------

let lastSeenActivity = 0
let primed = false
const warned = new Set<string>()

type Meta = { target_user_id?: string }

/** Turn new activity into toasts (for the current user) and scene events (for everyone). */
function onSnapshot(snapshot: Snapshot) {
  const { actorId, pushToast } = useStudio.getState()
  const fresh = snapshot.activity.filter((a) => a.id > lastSeenActivity).reverse()
  const first = !primed
  primed = true
  if (snapshot.activity.length) lastSeenActivity = Math.max(lastSeenActivity, snapshot.activity[0]!.id)

  const sceneEvents: SceneEvent[] = []
  if (!first) {
    for (const a of fresh) {
      if ((a.action === 'knock' || a.action === 'render_done') && a.slot_id !== null) {
        sceneEvents.push({ id: a.id, kind: a.action, slotId: a.slot_id, userId: a.user_id, at: performance.now() })
      }
      const target = (a.meta as Meta | null)?.target_user_id
      if (!actorId || target !== actorId) continue
      const slot = snapshot.slots.find((s) => s.id === a.slot_id)
      const account = snapshot.accounts.find((x) => x.id === slot?.account_id)
      const where = slot && account ? `${account.label} · Slot ${slot.slot_number}` : 'a slot'
      switch (a.action) {
        case 'hold_granted':
          pushToast({
            kind: 'turn',
            title: 'Your turn!',
            body: `${where} is reserved for you for ${snapshot.settings.hold_minutes} minutes.`,
            slotId: a.slot_id ?? undefined,
          })
          break
        case 'knock':
          pushToast({ kind: 'knock', title: `${nameOf(snapshot, a.user_id)} knocked`, body: `Someone is waiting for ${where}.` })
          break
        case 'render_done':
          pushToast({ kind: 'render', title: 'Render finished', body: `${where} is back to editing.` })
          break
        case 'hold_expired':
          pushToast({ kind: 'info', title: 'Reservation expired', body: 'You were removed from the waiting list.' })
          break
        case 'force_release':
          pushToast({ kind: 'info', title: 'An admin ended your session' })
          break
      }
    }
  }
  useStudio.setState((s) => ({
    snapshot,
    loadError: null,
    sceneEvents: sceneEvents.length ? [...s.sceneEvents, ...sceneEvents].slice(-20) : s.sceneEvents,
  }))
}

/** "Session ending" warning, computed from timestamps every second. */
function checkSessionEnding() {
  const { snapshot, actorId, pushToast } = useStudio.getState()
  if (!snapshot || !actorId) return
  const mine = snapshot.slots.find((s) => s.user_id === actorId)
  if (!mine) return
  const v = deriveSlotView(mine, studioClient.now())
  const key = `${mine.id}|${mine.expected_until}`
  if (v.remainingMs > 0 && v.remainingMs <= 10 * MINUTE && !warned.has(key)) {
    warned.add(key)
    pushToast({ kind: 'ending', title: 'Session ending soon', body: 'Less than 10 minutes left.', slotId: mine.id })
  }
}

let started = false
export function startStudio() {
  if (started) return
  started = true
  studioClient.subscribe(onSnapshot)
  studioClient
    .getSnapshot()
    .then(onSnapshot)
    .catch((e) => useStudio.setState({ loadError: String(e) }))
  setInterval(checkSessionEnding, 1000)

  fetch('/models/superhero_minecraft_character.glb', { method: 'HEAD' })
    .then((r) => {
      const type = r.headers.get('content-type') ?? ''
      const ok = r.ok && !type.includes('text/html')
      useStudio.setState({ charactersAvailable: ok })
      // Profile pictures: rendered once from the pack in the background (then cached).
      if (ok)
        void import('../scene/portraits')
          .then((m) => m.loadPortraits())
          .then((portraits) => useStudio.setState({ portraits: portraits.length ? portraits : null }))
          .catch((e) => console.warn('[studio] portraits unavailable', e))
    })
    .catch(() => {})
}
