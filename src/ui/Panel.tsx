import type { Snapshot } from '../data'
import { buildViewer, queueGates, type Viewer } from '../lib/availability'
import { describeActivity } from '../lib/activityText'
import { estimateWaits } from '../lib/waitEstimate'
import { formatAgo, formatClock, formatDuration, toMs } from '../lib/format'
import { useStudio } from '../store/studio'
import { Button, GateButton } from './controls'
import { SlotCard } from './SlotCard'
import { useNow } from './useNow'

/** Slots, waiting list and activity. `wide` lays sections out in columns (List view). */
export function Panel({ wide }: { wide: boolean }) {
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const now = useNow(500)
  if (!snapshot) return <p className="p-4 text-sm text-muted">Loading board…</p>
  const viewer = buildViewer(snapshot, actorId)

  return (
    <div className={wide ? 'grid gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : 'space-y-4 p-3'}>
      <section aria-labelledby="slots-heading" className="space-y-3">
        <h2 id="slots-heading" className="sr-only">
          Slots
        </h2>
        <div className={wide ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>
          {snapshot.accounts.map((account) => (
            <section key={account.id} aria-labelledby={`account-${account.id}`} className="space-y-2">
              <h3 id={`account-${account.id}`} className="text-sm font-semibold">
                {account.label}
              </h3>
              {snapshot.slots
                .filter((s) => s.account_id === account.id)
                .sort((a, b) => a.slot_number - b.slot_number)
                .map((slot) => (
                  <SlotCard key={slot.id} slot={slot} snapshot={snapshot} viewer={viewer} now={now} />
                ))}
            </section>
          ))}
        </div>
      </section>
      <div className="space-y-4">
        <WaitingList snapshot={snapshot} viewer={viewer} now={now} />
        <ActivityFeed snapshot={snapshot} now={now} />
      </div>
    </div>
  )
}

function WaitingList({ snapshot, viewer, now }: { snapshot: Snapshot; viewer: Viewer; now: number }) {
  const act = useStudio((s) => s.act)
  const openClaim = useStudio((s) => s.openClaim)
  const gates = queueGates(viewer, snapshot)
  const waits = estimateWaits(snapshot.slots, snapshot.queue, now)
  const queue = [...snapshot.queue].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)

  return (
    <section aria-labelledby="queue-heading" className="rounded-xl border border-line bg-surface p-3">
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
        <ol className="mt-2 space-y-1.5">
          {queue.map((q, i) => {
            const p = snapshot.profiles.find((x) => x.id === q.user_id)
            const hold = snapshot.slots.find((s) => s.hold_user_id === q.user_id)
            const eta = waits.get(q.user_id) ?? now
            const isMe = q.user_id === viewer.userId
            const holdLeft = hold ? (toMs(hold.hold_until) ?? now) - now : 0
            return (
              <li
                key={q.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${hold ? 'pulse bg-reserved/10' : 'bg-surface-2'}`}
                style={{ ['--pulse-color' as string]: '#e2b33c55' }}
              >
                <span className="w-5 text-right text-xs font-semibold text-muted">{i + 1}</span>
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: p?.avatar_color }} />
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

function ActivityFeed({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const items = snapshot.activity.slice(0, 30)
  return (
    <section aria-labelledby="activity-heading" className="rounded-xl border border-line bg-surface p-3">
      <h2 id="activity-heading" className="text-sm font-semibold">
        Activity
      </h2>
      <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto pr-1 text-sm" tabIndex={0} aria-label="Recent activity">
        {items.map((e) => {
          const d = describeActivity(e, snapshot)
          const t = toMs(e.created_at) ?? now
          return (
            <li key={e.id} className="flex gap-2">
              <span aria-hidden className="w-5 shrink-0 text-center">
                {d.icon}
              </span>
              <span className="min-w-0 flex-1">{d.text}</span>
              <time dateTime={e.created_at} className="shrink-0 text-xs text-muted">
                {formatAgo(t, now)}
              </time>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
