import type { Account, Snapshot } from '../data'
import { buildViewer, queueGates, type Viewer } from '../lib/availability'
import { describeActivity } from '../lib/activityText'
import { estimateWaits } from '../lib/waitEstimate'
import { formatAgo, formatClock, formatDuration, toMs } from '../lib/format'
import { useStudio } from '../store/studio'
import { Button, GateButton, Tip } from './controls'
import { SlotCard } from './SlotCard'
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
      <section aria-labelledby="slots-heading" className={wide ? 'flex min-w-0 flex-col gap-4' : 'space-y-4'}>
        <Summary snapshot={snapshot} viewer={viewer} now={now} />
        <h2 id="slots-heading" className="sr-only">
          Slots
        </h2>
        <div className={wide ? 'grid flex-1 gap-4 md:grid-cols-2' : 'space-y-4'}>
          {snapshot.accounts.map((account) => (
            <AccountSection key={account.id} account={account} snapshot={snapshot} viewer={viewer} now={now} wide={wide} />
          ))}
        </div>
      </section>
      <div className={wide ? 'flex min-w-0 flex-col gap-4' : 'space-y-4'}>
        <WaitingList snapshot={snapshot} viewer={viewer} now={now} />
        <ActivityFeed snapshot={snapshot} now={now} wide={wide} />
      </div>
    </div>
  )
}

/** The viewer's situation in one line, with the one action that matters most. */
function Summary({ snapshot, viewer, now }: { snapshot: Snapshot; viewer: Viewer; now: number }) {
  const openClaim = useStudio((s) => s.openClaim)
  const free = snapshot.slots.filter((s) => !s.user_id && !s.hold_user_id)
  const mine = viewer.mySlot
  const end = mine ? toMs(mine.expected_until) : null
  const account = (id: number) => snapshot.accounts.find((a) => a.id === id)?.label ?? 'Account'
  const queuePos = [...snapshot.queue]
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)
    .findIndex((q) => q.user_id === viewer.userId)

  let tone = 'border-l-free'
  let title: string
  let detail: string
  let action: React.ReactNode = null
  if (mine) {
    const over = end !== null && end <= now
    tone = over ? 'border-l-overdue' : 'border-l-accent'
    title = `You're on ${account(mine.account_id)} · Slot ${mine.slot_number}`
    detail = end === null ? '' : over ? `Over time by ${formatDuration(now - end)}. Extend or end your session.` : `${formatDuration(end - now)} left · until ${formatClock(end)}`
  } else if (viewer.myHold) {
    tone = 'border-l-reserved'
    title = 'A seat is reserved for you'
    detail = `${account(viewer.myHold.account_id)} · Slot ${viewer.myHold.slot_number} · ${formatDuration((toMs(viewer.myHold.hold_until) ?? now) - now)} to claim it`
    action = (
      <Button variant="primary" onClick={() => openClaim(viewer.myHold!.id)}>
        Claim now
      </Button>
    )
  } else if (free.length) {
    title = `${free.length} of ${snapshot.slots.length} seats free`
    detail = 'Claim a seat before you sign in to Adobe.'
    action = (
      <Button variant="primary" onClick={() => openClaim(free[0]!.id)}>
        Claim a seat
      </Button>
    )
  } else {
    tone = 'border-l-reserved'
    title = 'All seats are taken'
    detail = queuePos >= 0 ? `You're #${queuePos + 1} on the waiting list.` : 'Join the waiting list and the next free seat is held for you.'
  }

  return (
    <div className={`px-panel flex flex-wrap items-center gap-3 border-l-[6px] p-3 ${tone}`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {detail && <p className="text-sm text-muted">{detail}</p>}
      </div>
      {action}
    </div>
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
    <section aria-labelledby={`account-${account.id}`} className={wide ? 'flex flex-col gap-2' : 'space-y-2'}>
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
      {/* In the list view the seats stretch to fill the page height. */}
      <div className={wide ? 'grid flex-1 auto-rows-fr gap-3' : 'space-y-3'}>
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
    <section aria-labelledby="queue-heading" className="px-panel p-3">
      <div className="flex items-center gap-2">
        <h2 id="queue-heading" className="mr-auto text-sm font-semibold">
          Waiting list <span className="font-normal text-muted">({queue.length})</span>
        </h2>
        {viewer.queued ? (
          <GateButton gate={gates.leave} onClick={() => void act((c) => c.leaveQueue())}>
            Leave
          </GateButton>
        ) : (
          <GateButton gate={gates.join} variant="primary" onClick={() => void act((c) => c.joinQueue())}>
            Join
          </GateButton>
        )}
      </div>
      {!viewer.queued && gates.join && (
        <p className="mt-1 text-[11px] text-muted">⦸ {gates.join}</p>
      )}
      {queue.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nobody is waiting.</p>
      ) : (
        // A long waiting list scrolls inside its card instead of pushing the activity feed away.
        <ol className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1 lg:max-h-[38vh]" tabIndex={0} aria-label="Waiting list">
          {queue.map((q, i) => {
            const p = snapshot.profiles.find((x) => x.id === q.user_id)
            const hold = snapshot.slots.find((s) => s.hold_user_id === q.user_id)
            const eta = waits.get(q.user_id) ?? now
            const isMe = q.user_id === viewer.userId
            const holdLeft = hold ? (toMs(hold.hold_until) ?? now) - now : 0
            return (
              <li
                key={q.id}
                className={`flex items-center gap-2 px-2 py-1.5 text-sm ${hold ? 'pulse bg-reserved/10' : 'bg-surface-2'}`}
                style={{ ['--pulse-color' as string]: '#e2b33c55' }}
              >
                <span className="w-5 text-right text-xs font-semibold text-muted">{i + 1}</span>
                <UserAvatar profile={p} size={22} />
                <span className="min-w-0 flex-1 truncate">
                  {p?.name ?? 'Unknown'}
                  {isMe && <span className="ml-1 text-accent">(you)</span>}
                </span>
                <span className="text-xs text-muted">
                  {hold
                    ? `Reserved · ${formatDuration(holdLeft)} left`
                    : eta <= now
                      ? 'Any moment'
                      : `~${formatDuration(eta - now)} · ${formatClock(eta)}`}
                </span>
                {hold && isMe && (
                  <Button variant="primary" className="px-2 py-0.5 text-xs" onClick={() => openClaim(hold.id)}>
                    Claim
                  </Button>
                )}
                {viewer.isAdmin && (
                  <Button
                    variant="ghost"
                    className="px-1.5 py-0.5 text-xs"
                    aria-label={`Remove ${p?.name ?? 'user'} from waiting list`}
                    onClick={() => void act((c) => c.adminRemoveFromQueue(q.user_id))}
                  >
                    ✕
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function ActivityFeed({ snapshot, now, wide }: { snapshot: Snapshot; now: number; wide: boolean }) {
  const items = snapshot.activity.slice(0, wide ? 80 : 30)
  return (
    <section aria-labelledby="activity-heading" className={`px-panel p-3 ${wide ? 'flex min-h-80 flex-1 flex-col lg:min-h-0' : ''}`}>
      <h2 id="activity-heading" className="text-sm font-semibold">
        Activity
      </h2>
      <ul className={`mt-2 space-y-1 overflow-y-auto pr-1 text-sm ${wide ? 'max-h-96 min-h-0 flex-1 lg:h-0 lg:max-h-none' : 'max-h-96'}`} tabIndex={0} aria-label="Recent activity">
        {items.map((e) => {
          const d = describeActivity(e, snapshot)
          const t = toMs(e.created_at) ?? now
          return (
            <li key={e.id} className="flex items-start gap-2 py-0.5">
              <Tip content={`${new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · ${formatAgo(t, now)}`} side="left">
                <time dateTime={e.created_at} tabIndex={0} className="w-16 shrink-0 cursor-default pt-px font-mono text-xs text-muted">
                  {now - t < 24 * 3_600_000 ? formatClock(t) : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </time>
              </Tip>
              <PixelIcon name={d.icon} size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1 leading-snug">{d.text}</span>
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
