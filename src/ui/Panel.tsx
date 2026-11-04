import { useState } from 'react'
import type { Account, Snapshot } from '../data'
import { activityCategory } from '../lib/adminStats'
import { deriveSlotView } from '../lib/slotState'
import { STATE_COLORS } from '../lib/status'
import { buildViewer, queueGates, type Viewer } from '../lib/availability'
import { describeActivity } from '../lib/activityText'
import { estimateWaits } from '../lib/waitEstimate'
import { formatAgo, formatClock, formatDuration, toMs } from '../lib/format'
import { useStudio } from '../store/studio'
import { Button, GateButton, Segmented, Tip } from './controls'
import { SlotCard, slotAccent } from './SlotCard'
import { useNow } from './useNow'
import { PixelIcon } from './PixelIcon'
import { Loader } from './Loader'
import { UserAvatar } from './UserAvatar'

/** Slots, waiting list and activity. `wide` lays sections out in columns (List view). */
export function Panel({ wide }: { wide: boolean }) {
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const now = useNow(1000)
  if (!snapshot) return <BoardSkeleton wide={wide} />
  const viewer = buildViewer(snapshot, actorId)

  return (
    <div
      className={
        wide
          ? 'grid gap-4 p-3 sm:p-4 lg:min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(320px,26rem)]'
          : 'space-y-4 p-3'
      }
    >
      <section aria-labelledby="slots-heading" className={wide ? 'min-w-0 space-y-5 self-start' : 'space-y-4'}>
        <Summary snapshot={snapshot} viewer={viewer} now={now} />
        <h2 id="slots-heading" className="sr-only">
          Slots
        </h2>
        <div className={wide ? 'grid gap-5 xl:grid-cols-2' : 'space-y-4'}>
          {snapshot.accounts.map((account) => (
            <AccountSection key={account.id} account={account} snapshot={snapshot} viewer={viewer} now={now} wide={wide} />
          ))}
        </div>
      </section>
      {/* Sidebar stays in view (sticky) with the activity feed filling its height. */}
      <div className={wide ? 'flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:h-[calc(100dvh-8.5rem)] lg:self-start' : 'space-y-4'}>
        <WaitingList snapshot={snapshot} viewer={viewer} now={now} />
        <ActivityFeed snapshot={snapshot} now={now} wide={wide} />
      </div>
    </div>
  )
}

/** The viewer's situation in one line, with the one action that matters most. */
function Summary({ snapshot, viewer, now }: { snapshot: Snapshot; viewer: Viewer; now: number }) {
  const openClaim = useStudio((s) => s.openClaim)
  const focusSlot = useStudio((s) => s.focusSlot)
  const free = snapshot.slots.filter((s) => !s.user_id && !s.hold_user_id)
  const inUse = snapshot.slots.filter((s) => s.user_id).length
  const mine = viewer.mySlot
  const end = mine ? toMs(mine.expected_until) : null
  const account = (id: number) => snapshot.accounts.find((a) => a.id === id)?.label ?? 'Account'
  const queuePos = [...snapshot.queue]
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)
    .findIndex((q) => q.user_id === viewer.userId)

  let tone: string = STATE_COLORS.free
  let eyebrow = 'Seats'
  let title: string
  let detail: string
  let action: React.ReactNode = null
  if (mine) {
    const over = end !== null && end <= now
    tone = over ? STATE_COLORS.overdue : STATE_COLORS.in_use
    eyebrow = 'Your session'
    title = `${account(mine.account_id)} · Slot ${mine.slot_number}`
    detail = end === null ? '' : over ? `Over time by ${formatDuration(now - end)}. Extend or end your session.` : `${formatDuration(end - now)} left · until ${formatClock(end)}`
  } else if (viewer.myHold) {
    tone = STATE_COLORS.reserved
    eyebrow = 'Your turn'
    title = 'A seat is held for you'
    detail = `${account(viewer.myHold.account_id)} · Slot ${viewer.myHold.slot_number} · ${formatDuration((toMs(viewer.myHold.hold_until) ?? now) - now)} to claim it`
    action = (
      <Button variant="primary" className="px-4 py-2" onClick={() => openClaim(viewer.myHold!.id)}>
        Claim now
      </Button>
    )
  } else if (free.length) {
    title = `${free.length} of ${snapshot.slots.length} seats free`
    detail = 'Claim a seat first, then sign in to Adobe.'
    action = (
      <Button variant="primary" className="px-4 py-2" onClick={() => openClaim(free[0]!.id)}>
        Claim a seat
      </Button>
    )
  } else {
    tone = STATE_COLORS.reserved
    title = 'All seats are taken'
    detail = queuePos >= 0 ? `You're #${queuePos + 1} on the waiting list.` : 'Join the waiting list and the next free seat is held for you.'
  }

  return (
    <section aria-label="Seat summary" className="px-panel overflow-hidden">
      <div className="h-1.5" style={{ background: tone }} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-4">
        <div className="min-w-56 flex-1">
          <p className="font-pixel text-xs" style={{ color: tone }}>
            {eyebrow}
          </p>
          <p className="text-lg font-semibold leading-tight">{title}</p>
          {detail && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Stat label="Free" value={free.length} color={STATE_COLORS.free} />
            <Stat label="In use" value={inUse} color={STATE_COLORS.in_use} />
            <Stat label="Waiting" value={snapshot.queue.length} color={STATE_COLORS.reserved} />
          </div>
        </div>

        {/* Seat map: one block per seat, grouped by Adobe account. Click a free seat to claim it. */}
        <div className="flex gap-4" aria-label="Seat map">
          {snapshot.accounts.map((a) => (
            <div key={a.id}>
              <p className="mb-1 text-center text-[11px] font-semibold text-muted">{a.label}</p>
              <div className="flex gap-1.5">
                {snapshot.slots
                  .filter((sl) => sl.account_id === a.id)
                  .sort((x, y) => x.slot_number - y.slot_number)
                  .map((sl) => {
                    const v = deriveSlotView(sl, now)
                    const holder = snapshot.profiles.find((p) => p.id === (sl.user_id ?? sl.hold_user_id))
                    const isFree = !sl.user_id && !sl.hold_user_id
                    const label = isFree ? 'Free' : v.kind === 'reserved' ? `Held for ${holder?.name ?? 'someone'}` : `${holder?.name ?? 'In use'}${sl.device_name ? ` · ${sl.device_name}` : ''}`
                    return (
                      <Tip key={sl.id} content={`Slot ${sl.slot_number}: ${label}`}>
                        <button
                          type="button"
                          aria-label={`${a.label} slot ${sl.slot_number}: ${label}`}
                          onClick={() => (isFree ? openClaim(sl.id) : focusSlot(sl.id))}
                          className="relative grid size-14 place-items-center border border-line hover:brightness-110"
                          style={{ background: slotAccent(sl, v) }}
                        >
                          {holder ? <UserAvatar profile={holder} size={34} /> : <PixelIcon name="block" size={20} />}
                          <span className="absolute -bottom-0.5 -right-0.5 border border-line bg-[#3d2414] px-1 font-pixel text-[10px] text-white">
                            {sl.slot_number}
                          </span>
                        </button>
                      </Tip>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>

        {action}
      </div>
    </section>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-line bg-surface-2 px-2 py-0.5">
      <span aria-hidden className="size-2" style={{ background: color }} />
      <span className="font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-muted">{label}</span>
    </span>
  )
}

function AccountSection({
  account,
  snapshot,
  viewer,
  now,
  wide,
}: {
  account: Account
  snapshot: Snapshot
  viewer: Viewer
  now: number
  wide: boolean
}) {
  const slots = snapshot.slots.filter((s) => s.account_id === account.id).sort((a, b) => a.slot_number - b.slot_number)
  const used = slots.filter((s) => s.user_id)
  return (
    <section aria-labelledby={`account-${account.id}`} className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h3 id={`account-${account.id}`} className="text-sm font-semibold">
          {account.label}
        </h3>
        <span className="text-xs text-muted tabular-nums">
          {used.length}/{slots.length} in use
        </span>
      </div>
      {/* Mirrors the Adobe account's activated-devices list: which device is which seat. */}
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span>Signed in to Adobe:</span>
        {used.length ? (
          used.map((s) => (
            <span key={s.id} className="px-badge bg-surface-2 px-1.5 py-0.5 text-ink">
              <span className="font-mono">{s.device_name ?? '?'}</span>
              <span className="text-muted"> · {snapshot.profiles.find((p) => p.id === s.user_id)?.name ?? 'someone'}</span>
            </span>
          ))
        ) : (
          <span>no devices</span>
        )}
      </p>
      {/* Seats side by side at their natural height. */}
      <div className={wide ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
        {slots.map((slot) => (
          <SlotCard key={slot.id} slot={slot} snapshot={snapshot} viewer={viewer} now={now} />
        ))}
      </div>
    </section>
  )
}

function WaitingList({ snapshot, viewer, now }: { snapshot: Snapshot; viewer: Viewer; now: number }) {
  const act = useStudio((s) => s.act)
  const openClaim = useStudio((s) => s.openClaim)
  const gates = queueGates(viewer, snapshot)
  const waits = estimateWaits(snapshot.slots, snapshot.queue, now)
  const queue = [...snapshot.queue].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)

  return (
    <section aria-labelledby="queue-heading" className="px-panel flex flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <PixelIcon name="ticket" size={16} />
        <h2 id="queue-heading" className="text-sm">
          Waiting list
        </h2>
        <span className="ml-auto bg-surface-2 px-1.5 font-pixel text-xs tabular-nums">{queue.length}</span>
      </header>

      {queue.length === 0 ? (
        <div className="flex items-center gap-3 px-3 py-4">
          <span className="px-btn grid size-10 shrink-0 place-items-center bg-surface-2">
            <PixelIcon name="mug" size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold">Nobody's waiting</p>
            <p className="text-xs text-muted">When every seat is taken, join here and the next free seat is held for you.</p>
          </div>
        </div>
      ) : (
        // A long waiting list scrolls inside its card instead of pushing the activity feed away.
        <ol className="max-h-72 space-y-1.5 overflow-y-auto p-2 lg:max-h-[34vh]" tabIndex={0} aria-label="Waiting list">
          {queue.map((q, i) => {
            const p = snapshot.profiles.find((x) => x.id === q.user_id)
            const hold = snapshot.slots.find((s) => s.hold_user_id === q.user_id)
            const eta = waits.get(q.user_id) ?? now
            const isMe = q.user_id === viewer.userId
            const holdLeft = hold ? (toMs(hold.hold_until) ?? now) - now : 0
            return (
              <li
                key={q.id}
                className={`flex items-center gap-2.5 border px-2 py-1.5 text-sm ${hold ? 'pulse border-reserved/70 bg-reserved/10' : isMe ? 'border-accent/60 bg-surface-2' : 'border-transparent bg-surface-2'}`}
                style={{ ['--pulse-color' as string]: '#e2b33c55' }}
              >
                <span className="grid size-6 shrink-0 place-items-center border border-line bg-[#3d2414] font-pixel text-[11px] text-white">{i + 1}</span>
                <UserAvatar profile={p} size={28} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate font-semibold">
                    {p?.name ?? 'Unknown'}
                    {isMe && <span className="ml-1.5 bg-accent px-1 font-pixel text-[10px] text-white">You</span>}
                  </p>
                  <p className={`text-xs ${hold ? 'font-semibold text-reserved' : 'text-muted'}`}>
                    {hold ? `Seat ready · ${formatDuration(holdLeft)} to claim` : eta <= now ? 'Next up any moment' : `~${formatDuration(eta - now)} · around ${formatClock(eta)}`}
                  </p>
                </div>
                {hold && isMe && (
                  <Button variant="primary" className="px-2.5 py-1 text-xs" onClick={() => openClaim(hold.id)}>
                    Claim
                  </Button>
                )}
                {viewer.isAdmin && (
                  <Tip content="Remove from the waiting list">
                    <Button
                      variant="ghost"
                      className="px-1.5 py-0.5 text-xs"
                      aria-label={`Remove ${p?.name ?? 'user'} from waiting list`}
                      onClick={() => void act((c) => c.adminRemoveFromQueue(q.user_id))}
                    >
                      ✕
                    </Button>
                  </Tip>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <footer className="border-t border-line p-3">
        {viewer.queued ? (
          <GateButton gate={gates.leave} className="w-full py-1.5" onClick={() => void act((c) => c.leaveQueue())}>
            Leave the waiting list
          </GateButton>
        ) : (
          <GateButton gate={gates.join} variant="primary" className="w-full py-1.5" onClick={() => void act((c) => c.joinQueue())}>
            Join the waiting list
          </GateButton>
        )}
        {!viewer.queued && gates.join && <p className="mt-1.5 text-center text-[11px] text-muted">{gates.join}</p>}
      </footer>
    </section>
  )
}

const FEED_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'seats', label: 'Seats' },
  { id: 'queue', label: 'Queue' },
] as const
type FeedFilter = (typeof FEED_FILTERS)[number]['id']

/** Icon tile colour by kind of event (sessions, waiting list, admin, accounts). */
const CATEGORY_TONE: Record<string, string> = {
  sessions: '#3c8527',
  queue: '#e2b33c',
  admin: '#e0524f',
  accounts: '#5b8def',
}

function dayLabel(t: number, now: number) {
  const d = new Date(t)
  const today = new Date(now)
  const yesterday = new Date(now - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function ActivityFeed({ snapshot, now, wide }: { snapshot: Snapshot; now: number; wide: boolean }) {
  const [filter, setFilter] = useState<FeedFilter>('all')
  const items = snapshot.activity
    .filter((e) => {
      const cat = activityCategory(e.action)
      return filter === 'all' || (filter === 'queue' ? cat === 'queue' : cat === 'sessions' || cat === 'admin')
    })
    .slice(0, wide ? 80 : 30)
  let lastDay = ''
  return (
    <section aria-labelledby="activity-heading" className={`px-panel flex flex-col ${wide ? 'min-h-80 flex-1 lg:min-h-0' : ''}`}>
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <PixelIcon name="clock" size={16} />
        <h2 id="activity-heading" className="mr-auto text-sm">
          Activity
        </h2>
        <Segmented<FeedFilter> label="Filter activity" value={filter} onChange={setFilter} options={FEED_FILTERS.map((f) => ({ value: f.id, label: f.label }))} />
      </header>
      <ul className={`overflow-y-auto px-2 py-1 text-sm ${wide ? 'max-h-96 min-h-0 flex-1 lg:h-0 lg:max-h-none' : 'max-h-96'}`} tabIndex={0} aria-label="Recent activity">
        {items.length === 0 && <li className="px-1 py-4 text-center text-xs text-muted">Nothing here yet.</li>}
        {items.map((e) => {
          const d = describeActivity(e, snapshot)
          const t = toMs(e.created_at) ?? now
          const day = dayLabel(t, now)
          const header = day !== lastDay
          lastDay = day
          return (
            <li key={e.id}>
              {header && (
                <div className="sticky top-0 z-10 -mx-2 bg-surface px-3 pb-1 pt-2 font-pixel text-[11px] text-muted">{day}</div>
              )}
              <div className="flex items-start gap-2.5 px-1 py-1.5 hover:bg-surface-2">
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center border border-line"
                  style={{ background: `${CATEGORY_TONE[activityCategory(e.action)] ?? '#555'}55` }}
                >
                  <PixelIcon name={d.icon} size={12} />
                </span>
                <span className="min-w-0 flex-1 leading-snug">{d.text}</span>
                <Tip content={new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} side="left">
                  <time dateTime={e.created_at} tabIndex={0} className="shrink-0 cursor-default pt-0.5 text-[11px] text-muted tabular-nums">
                    {now - t < 3_600_000 ? formatAgo(t, now) : formatClock(t)}
                  </time>
                </Tip>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Placeholder seats while the board loads, so the layout does not jump. */
function BoardSkeleton({ wide }: { wide: boolean }) {
  return (
    <div aria-busy="true" className={wide ? 'grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,26rem)]' : 'space-y-4 p-3'}>
      <div className="space-y-4">
        <div className="ss-skeleton h-16" />
        <div className={wide ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>
          {[0, 1].map((a) => (
            <div key={a} className="space-y-3">
              <div className="ss-skeleton h-5 w-32" />
              <div className="ss-skeleton h-36" />
              <div className="ss-skeleton h-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="px-panel">
        <Loader label="Loading board" />
      </div>
    </div>
  )
}
