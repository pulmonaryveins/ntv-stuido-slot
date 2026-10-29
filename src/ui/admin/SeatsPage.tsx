import { useEffect, useState } from 'react'
import type { Account, Snapshot } from '../../data'
import { studioClient } from '../../data'
import { useStudio } from '../../store/studio'
import { formatAgo, formatClock, formatDuration, toMs } from '../../lib/format'
import { nameOf } from '../../lib/availability'
import { Button } from '../controls'
import { AdminHeader, UserName } from './AdminPage'

function AccountName({ account }: { account: Account }) {
  const act = useStudio((s) => s.act)
  const [label, setLabel] = useState(account.label)
  useEffect(() => setLabel(account.label), [account.label])
  const changed = label.trim() !== account.label && label.trim().length > 0
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (changed) void act((c) => c.adminUpdateAccount(account.id, label.trim()))
      }}
    >
      <input
        aria-label="Account name"
        value={label}
        maxLength={40}
        onChange={(e) => setLabel(e.target.value)}
        className="min-w-0 flex-1 border-2 border-line bg-surface-2 px-2 py-1 text-sm font-semibold"
      />
      {changed && (
        <button type="submit" className="px-btn bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">
          Rename
        </button>
      )}
    </form>
  )
}

export function SeatsPage({ snapshot }: { snapshot: Snapshot }) {
  const act = useStudio((s) => s.act)
  const pushToast = useStudio((s) => s.pushToast)
  const now = studioClient.now()
  const queue = [...snapshot.queue].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id - b.id)

  const forceEnd = (slotId: number, device: string | null) =>
    void act((c) => c.adminForceRelease(slotId)).then(
      (ok) =>
        ok &&
        pushToast({
          kind: 'info',
          title: device ? `Now sign out device ${device} in Adobe` : 'Now sign out the device in Adobe',
          body: "Use the Adobe account's activated-devices list so the next person can sign in.",
        }),
    )

  return (
    <div>
      <AdminHeader title="Seats" description="The Adobe accounts, who is on each seat, and the waiting list." />

      <div className="grid gap-4 lg:grid-cols-2">
        {snapshot.accounts.map((a) => (
          <section key={a.id} aria-label={a.label} className="px-panel p-4">
            <AccountName account={a} />
            <ul className="mt-3 space-y-2">
              {snapshot.slots
                .filter((s) => s.account_id === a.id)
                .map((s) => {
                  const holder = snapshot.profiles.find((p) => p.id === s.user_id)
                  const start = toMs(s.claimed_at)
                  const end = toMs(s.expected_until)
                  const over = end !== null && end <= now
                  return (
                    <li key={s.id} className="bg-surface-2 p-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Slot {s.slot_number}</span>
                        <span className="ml-auto text-xs">
                          {holder ? (
                            over ? <span className="font-semibold text-overdue">Over time</span> : <span className="text-ink">In use</span>
                          ) : s.hold_user_id ? (
                            <span className="text-reserved">Reserved</span>
                          ) : (
                            <span className="text-free">Free</span>
                          )}
                        </span>
                      </div>
                      {holder ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <UserName id={holder.id} name={holder.name} color={holder.avatar_color} />
                          {s.device_name && <span className="px-badge bg-surface px-1.5 font-mono text-xs">{s.device_name}</span>}
                          <span className="text-xs text-muted tabular-nums">
                            {start !== null && `${formatClock(start)} → `}
                            {end !== null && formatClock(end)}
                            {end !== null && (over ? ` · over ${formatDuration(now - end)}` : ` · ${formatDuration(end - now)} left`)}
                          </span>
                          <Button variant="danger" className="ml-auto px-2 py-0.5 text-xs" onClick={() => forceEnd(s.id, s.device_name)}>
                            Force end
                          </Button>
                        </div>
                      ) : s.hold_user_id ? (
                        <p className="mt-1.5 text-xs text-muted">
                          Held for {nameOf(snapshot, s.hold_user_id)} until {formatClock(toMs(s.hold_until) ?? now)}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted">Available</p>
                      )}
                    </li>
                  )
                })}
            </ul>
          </section>
        ))}
      </div>

      <section aria-labelledby="seats-queue" className="px-panel mt-4 p-4">
        <h3 id="seats-queue" className="text-sm font-semibold">
          Waiting list ({queue.length})
        </h3>
        {queue.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nobody is waiting.</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {queue.map((q, i) => {
              const p = snapshot.profiles.find((x) => x.id === q.user_id)
              return (
                <li key={q.id} className="flex items-center gap-2 bg-surface-2 px-2 py-1.5 text-sm">
                  <span className="w-6 text-xs text-muted">#{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <UserName id={p?.id} name={p?.name ?? 'Someone'} color={p?.avatar_color ?? '#888'} />
                  </span>
                  <span className="text-xs text-muted">joined {formatAgo(toMs(q.joined_at) ?? now, now)}</span>
                  <Button className="px-2 py-0.5 text-xs" onClick={() => void act((c) => c.adminRemoveFromQueue(q.user_id))}>
                    Remove
                  </Button>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
