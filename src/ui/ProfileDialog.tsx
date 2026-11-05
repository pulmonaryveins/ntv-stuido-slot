import * as Dialog from '@radix-ui/react-dialog'
import { useRef, type CSSProperties, type ReactNode } from 'react'
import type { Profile, Snapshot } from '../data'
import { STATE_COLORS, STATUS_META } from '../lib/status'
import { HOUR, formatAgo, formatClock, formatDuration, toMs } from '../lib/format'
import { deriveSlotView } from '../lib/slotState'
import { estimateWaits } from '../lib/waitEstimate'
import { describeActivity, slotLabel } from '../lib/activityText'
import { useStudio } from '../store/studio'
import { Button } from './controls'
import { PixelIcon, type IconName } from './PixelIcon'
import { UserAvatar } from './UserAvatar'
import { useNow } from './useNow'

const WORK_ROLE: Record<Profile['work_role'], { label: string; icon: IconName }> = {
  editor: { label: 'Editor', icon: 'clapper' },
  designer: { label: 'Designer', icon: 'brush' },
  motion: { label: 'Motion designer', icon: 'sparkle' },
}

interface Presence {
  icon: IconName
  color: string
  /** Short state word for the card's corner chip. */
  chip: string
  label: string
  detail: string | null
  /** Session progress 0..1 while seated. */
  progress: number | null
  /** Seat to jump to from "View seat" (held or reserved), if any. */
  slotId: number | null
}

/** What a user is doing right now: seated, waiting, or around the office. */
function presence(profile: Profile, snapshot: Snapshot, now: number): Presence {
  const slot = snapshot.slots.find((s) => s.user_id === profile.id)
  if (slot) {
    const view = deriveSlotView(slot, now)
    const meta = slot.status ? STATUS_META[slot.status] : null
    let detail: string
    if (view.kind === 'rendering' && view.renderRemainingMs !== null) detail = `Render done in ~${formatDuration(view.renderRemainingMs)}`
    else if (view.kind === 'break' && view.breakRemainingMs !== null) detail = `Back in ${formatDuration(view.breakRemainingMs)}`
    else if (view.overdue) detail = `Overdue by ${formatDuration(-view.remainingMs)}`
    else detail = `Until ${formatClock(now + view.remainingMs)} · ${formatDuration(view.remainingMs)} left`
    return {
      icon: view.overdue ? 'warn' : (meta?.icon ?? 'block'),
      color: view.overdue ? STATE_COLORS.overdue : (meta?.color ?? STATE_COLORS.in_use),
      chip: view.overdue ? 'Overdue' : 'In a seat',
      label: `${meta?.label ?? 'In use'} · ${slotLabel(snapshot, slot.id)}`,
      detail,
      progress: Math.min(1, Math.max(0, view.progress)),
      slotId: slot.id,
    }
  }
  const held = snapshot.slots.find((s) => s.hold_user_id === profile.id)
  const queue = [...snapshot.queue].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)
  const index = queue.findIndex((q) => q.user_id === profile.id)
  if (index >= 0) {
    const eta = estimateWaits(snapshot.slots, snapshot.queue, now).get(profile.id)
    return {
      icon: held ? 'check' : 'ticket',
      color: STATE_COLORS.reserved,
      chip: held ? 'Seat ready' : `#${index + 1} in line`,
      label: held ? `Seat ready · ${slotLabel(snapshot, held.id)}` : `#${index + 1} in the waiting list`,
      detail: held ? 'Reserved for them right now' : eta !== undefined ? `Seat expected around ${formatClock(Math.max(eta, now))}` : null,
      progress: null,
      slotId: held?.id ?? null,
    }
  }
  return { icon: 'user', color: STATE_COLORS.free, chip: 'Free', label: 'Around the office', detail: 'Not using a seat right now', progress: null, slotId: null }
}

/** Staggered entry: each block rises in after the one above it. */
const rise = (i: number): CSSProperties => ({ ['--d' as string]: `${80 + i * 50}ms` })

function Stat({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="ss-rise border-2 border-line bg-surface-2 px-2 py-1.5 shadow-[inset_0_2px_0_var(--hi),inset_0_-3px_0_var(--lo)]" style={style}>
      <div className="font-pixel text-[10px] uppercase text-muted">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{children}</div>
    </div>
  )
}

/** Character card for a user, opened by clicking their character in the 3D studio. */
export function ProfileDialog() {
  const userId = useStudio((s) => s.profileModalId)
  const close = useStudio((s) => s.openProfile)
  const openSlotModal = useStudio((s) => s.openSlotModal)
  const focusSlot = useStudio((s) => s.focusSlot)
  const openCustomize = useStudio((s) => s.openCustomize)
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const now = useNow(1000)
  // Keep showing the last user while the card animates out (userId is already null then).
  const shownId = useRef<string | null>(null)
  if (userId) shownId.current = userId
  const profile = snapshot?.profiles.find((p) => p.id === shownId.current)
  const info = profile && snapshot ? presence(profile, snapshot, now) : null
  const mine = profile && snapshot ? snapshot.activity.filter((e) => e.user_id === profile.id) : []
  const recent = mine.slice(0, 4)
  const sessionsToday = mine.filter((e) => e.action === 'claim' && now - (toMs(e.created_at) ?? 0) < 24 * HOUR).length
  const since = toMs(profile?.created_at)
  const role = profile ? WORK_ROLE[profile.work_role] : null

  return (
    <Dialog.Root open={!!userId && !!profile} onOpenChange={(o) => !o && close(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="ss-overlay fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="ss-dialog fixed left-1/2 top-1/2 z-50 w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 px-panel overflow-hidden p-0 text-ink shadow-[inset_0_2px_0_var(--hi),6px_6px_0_rgba(0,0,0,0.35)]">
          {profile && snapshot && info && role && (
            <>
              {/* Banner in the user's colour, with the portrait standing on its bottom edge. */}
              <div className="ss-banner relative h-20 border-b-2 border-line" style={{ backgroundColor: profile.avatar_color }}>
                <span
                  className="font-pixel absolute left-3 top-2.5 flex items-center gap-1.5 border-2 border-black bg-black/55 px-1.5 py-0.5 text-[10px] uppercase text-white"
                >
                  <span className="size-2 border border-black" style={{ background: info.color }} />
                  {info.chip}
                </span>
                <Dialog.Close
                  className="px-btn absolute right-2.5 top-2.5 grid size-8 place-items-center bg-surface-2"
                  aria-label="Close"
                >
                  <PixelIcon name="close" size={12} />
                </Dialog.Close>
              </div>

              <div className="px-4 pb-4">
                <div className="-mt-10 flex items-end gap-3">
                  <div className="ss-bob shrink-0 border-2 border-black bg-surface p-1 shadow-[3px_3px_0_rgba(0,0,0,0.35)]">
                    <UserAvatar profile={profile} size={72} className="border-0!" />
                  </div>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <div className="flex flex-wrap gap-1">
                      {profile.id === actorId && (
                        <span className="font-pixel border-2 border-black bg-accent px-1.5 py-px text-[10px] uppercase text-accent-ink">You</span>
                      )}
                      {profile.role === 'admin' && (
                        <span className="font-pixel flex items-center gap-1 border-2 border-black bg-reserved px-1.5 py-px text-[10px] uppercase text-black">
                          <PixelIcon name="shield" size={10} />
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Dialog.Title className="ss-rise mt-2 truncate text-xl" style={rise(0)}>
                  {profile.name}
                </Dialog.Title>
                <Dialog.Description className="ss-rise flex items-center gap-1.5 text-sm text-muted" style={rise(0)}>
                  <PixelIcon name={role.icon} size={14} />
                  {role.label}
                </Dialog.Description>

                {/* Now: what they are doing, with session progress while seated. */}
                <section
                  aria-label="Status"
                  className="ss-rise mt-3 border-2 border-line bg-surface-2 p-2.5 shadow-[inset_4px_0_0_var(--c),inset_0_2px_0_var(--hi)]"
                  style={{ ...rise(1), ['--c' as string]: info.color }}
                >
                  <div className="flex items-start gap-2.5 pl-1.5">
                    <span className="grid size-8 shrink-0 place-items-center border-2 border-black text-white" style={{ background: info.color }}>
                      <PixelIcon name={info.icon} size={16} anim={info.icon === 'hourglass' ? 'spin' : info.icon === 'warn' ? 'shake' : 'bob'} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{info.label}</div>
                      {info.detail && <div className="text-xs text-muted">{info.detail}</div>}
                    </div>
                  </div>
                  {info.progress !== null && (
                    <div className="px-bar mt-2 ml-1.5" style={{ color: info.color }} role="progressbar" aria-label="Session" aria-valuenow={Math.round(info.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${Math.round(info.progress * 100)}%` }} />
                    </div>
                  )}
                </section>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Stat label="Device" style={rise(2)}>
                    <span className="font-mono">{profile.device_name ?? '—'}</span>
                  </Stat>
                  <Stat label="Sessions 24h" style={rise(2)}>
                    {sessionsToday}
                  </Stat>
                  <Stat label="Joined" style={rise(2)}>
                    {since !== null ? new Date(since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'}
                  </Stat>
                </div>

                <section aria-label="Recent activity" className="mt-3">
                  <h3 className="ss-rise text-xs text-muted" style={rise(3)}>
                    Recent
                  </h3>
                  {recent.length ? (
                    <ol className="mt-1.5 border-l-2 border-line">
                      {recent.map((e, i) => {
                        const d = describeActivity(e, snapshot)
                        return (
                          <li key={e.id} className="ss-rise relative flex items-start gap-2 py-1 pl-3 text-sm" style={rise(4 + i)}>
                            <span aria-hidden className="absolute -left-[5px] top-2.5 size-2 border border-black bg-surface" />
                            <PixelIcon name={d.icon} size={14} className="mt-0.5 shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 leading-snug">{d.text}</span>
                            <time dateTime={e.created_at} className="shrink-0 text-xs text-muted">
                              {formatAgo(toMs(e.created_at) ?? now, now)}
                            </time>
                          </li>
                        )
                      })}
                    </ol>
                  ) : (
                    <p className="ss-rise mt-1 text-sm text-muted" style={rise(4)}>
                      Nothing in the last 24 hours.
                    </p>
                  )}
                </section>

                <div className="ss-rise mt-4 flex justify-end gap-2" style={rise(5 + recent.length)}>
                  {profile.id === actorId && (
                    <Button className="mr-auto" onClick={() => openCustomize(true)}>
                      <PixelIcon name="user" size={14} />
                      Customize
                    </Button>
                  )}
                  <Dialog.Close asChild>
                    <Button>Close</Button>
                  </Dialog.Close>
                  {info.slotId !== null && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        const id = info.slotId!
                        close(null)
                        focusSlot(id)
                        openSlotModal(id)
                      }}
                    >
                      <PixelIcon name="block" size={14} />
                      View seat
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
