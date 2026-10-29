import type { Snapshot } from '../../data'
import { studioClient } from '../../data'
import { adminStats } from '../../lib/adminStats'
import { describeActivity } from '../../lib/activityText'
import { nameOf } from '../../lib/availability'
import { formatAgo, formatClock, formatDuration, toMs } from '../../lib/format'
import { useNow } from '../useNow'
import { PixelIcon, type IconName } from '../PixelIcon'
import { AdminHeader, UserName, formatMinutes, type AdminTab } from './AdminPage'

function Tile({
  label,
  value,
  sub,
  icon,
  tone,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  icon: IconName
  tone?: 'warn' | 'alert'
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        <PixelIcon name={icon} size={14} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      {sub && (
        <div className={`mt-0.5 text-xs ${tone === 'alert' ? 'text-overdue' : tone === 'warn' ? 'text-reserved' : 'text-muted'}`}>
          {sub}
        </div>
      )}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="px-panel p-3 text-left hover:brightness-105">
      {body}
    </button>
  ) : (
    <div className="px-panel p-3">{body}</div>
  )
}

export function Dashboard({ snapshot, goTo }: { snapshot: Snapshot; goTo: (t: AdminTab) => void }) {
  useNow(15_000)
  const now = studioClient.now()
  const s = adminStats(snapshot, now)
  const inactive = snapshot.profiles.filter((p) => !p.active)
  const overdue = snapshot.slots.filter((sl) => sl.user_id && (toMs(sl.expected_until) ?? Infinity) <= now)
  const top = s.topUsers.slice(0, 6)
  const topMax = Math.max(1, ...top.map((u) => u.minutes))
  const full = s.seatsInUse === s.seatsTotal

  return (
    <div>
      <AdminHeader title="Dashboard" description="Live seat use and recent history." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          icon="block"
          label="Seats in use"
          value={`${s.seatsInUse} / ${s.seatsTotal}`}
          sub={s.seatsReserved ? `${s.seatsReserved} reserved for the waiting list` : full ? 'All seats taken' : `${s.seatsTotal - s.seatsInUse} free`}
          tone={full ? 'warn' : undefined}
          onClick={() => goTo('seats')}
        />
        <Tile
          icon="ticket"
          label="Waiting list"
          value={String(s.waiting)}
          sub={s.waiting ? 'Waiting for a seat' : 'Nobody waiting'}
          onClick={() => goTo('seats')}
        />
        <Tile
          icon="warn"
          label="Over time"
          value={String(s.overdueNow)}
          sub={s.overdueNow ? 'Past their end time' : 'Everyone on time'}
          tone={s.overdueNow ? 'alert' : undefined}
          onClick={() => goTo('seats')}
        />
        <Tile
          icon="user"
          label="Active users"
          value={String(s.activeUsers)}
          sub={inactive.length ? `${inactive.length} waiting for approval or inactive` : `${s.admins} admin${s.admins === 1 ? '' : 's'}`}
          tone={inactive.length ? 'warn' : undefined}
          onClick={() => goTo('users')}
        />
        <Tile icon="sparkle" label="Sessions today" value={String(s.sessionsToday)} sub={`${s.endedToday} ended today`} />
        <Tile
          icon="clock"
          label="Average session"
          value={s.avgSessionMin === null ? '—' : formatMinutes(s.avgSessionMin)}
          sub={s.since ? `Since ${new Date(s.since).toLocaleDateString()}` : 'No history yet'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="dash-seats" className="px-panel p-4">
          <h3 id="dash-seats" className="text-sm font-semibold">
            Seats right now
          </h3>
          <div className="mt-3 space-y-3">
            {snapshot.accounts.map((a) => (
              <div key={a.id}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{a.label}</div>
                <ul className="mt-1 space-y-1">
                  {snapshot.slots
                    .filter((sl) => sl.account_id === a.id)
                    .map((sl) => {
                      const holder = snapshot.profiles.find((p) => p.id === sl.user_id)
                      const end = toMs(sl.expected_until)
                      const over = end !== null && end <= now
                      return (
                        <li key={sl.id} className="flex items-center gap-2 bg-surface-2 px-2 py-1.5 text-sm">
                          <span className="w-14 shrink-0 text-xs text-muted">Slot {sl.slot_number}</span>
                          {holder ? (
                            <>
                              <span className="min-w-0 flex-1">
                                <UserName id={holder.id} name={holder.name} color={holder.avatar_color} />
                              </span>
                              {sl.device_name && <span className="font-mono text-xs text-muted">{sl.device_name}</span>}
                              <span className={`shrink-0 text-xs tabular-nums ${over ? 'font-semibold text-overdue' : 'text-muted'}`}>
                                {end === null ? '' : over ? `Over ${formatDuration(now - end)}` : `until ${formatClock(end)}`}
                              </span>
                            </>
                          ) : sl.hold_user_id ? (
                            <span className="flex-1 text-reserved">Reserved for {nameOf(snapshot, sl.hold_user_id)}</span>
                          ) : (
                            <span className="flex-1 text-free">Free</span>
                          )}
                        </li>
                      )
                    })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="dash-top" className="px-panel p-4">
          <h3 id="dash-top" className="text-sm font-semibold">
            Seat time by user
          </h3>
          <p className="text-xs text-muted">From the loaded history; current sessions count up to now.</p>
          {top.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No sessions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {top.map((u) => {
                const p = snapshot.profiles.find((x) => x.id === u.userId)
                const name = p?.name ?? 'Deleted user'
                return (
                  <li key={u.userId}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <UserName id={p?.id} name={name} color={p?.avatar_color ?? '#888'} />
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {formatMinutes(u.minutes)} · {u.sessions} session{u.sessions === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-1 h-2 bg-surface-2">
                      <div className="h-full rounded-r bg-accent" style={{ width: `${(u.minutes / topMax) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-attention" className="px-panel p-4">
          <div className="flex items-center justify-between">
            <h3 id="dash-attention" className="text-sm font-semibold">
              Needs your attention
            </h3>
            <button type="button" className="text-xs text-muted underline hover:text-ink" onClick={() => goTo('users')}>
              Manage users
            </button>
          </div>
          {inactive.length === 0 && overdue.length === 0 ? (
            <p className="mt-2 text-sm text-muted">All clear.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {inactive.map((p) => (
                <li key={p.id} className="flex items-center gap-2 bg-surface-2 px-2 py-1.5">
                  <PixelIcon name="user" size={14} />
                  <span className="min-w-0 flex-1">
                    <UserName id={p.id} name={p.name} color={p.avatar_color} />
                  </span>
                  <span className="text-xs text-reserved">Not active</span>
                </li>
              ))}
              {overdue.map((sl) => (
                <li key={`o${sl.id}`} className="flex items-center gap-2 bg-surface-2 px-2 py-1.5">
                  <PixelIcon name="warn" size={14} />
                  <span className="min-w-0 flex-1 truncate">{nameOf(snapshot, sl.user_id)} is over time</span>
                  <span className="text-xs text-overdue">Over</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-recent" className="px-panel p-4">
          <div className="flex items-center justify-between">
            <h3 id="dash-recent" className="text-sm font-semibold">
              Recent activity
            </h3>
            <button type="button" className="text-xs text-muted underline hover:text-ink" onClick={() => goTo('activity')}>
              Full log
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {snapshot.activity.slice(0, 8).map((e) => {
              const d = describeActivity(e, snapshot)
              return (
                <li key={e.id} className="flex items-center gap-2">
                  <PixelIcon name={d.icon} size={14} />
                  <span className="min-w-0 flex-1 truncate">{d.text}</span>
                  <span className="shrink-0 text-xs text-muted">{formatAgo(toMs(e.created_at) ?? now, now)}</span>
                </li>
              )
            })}
            {snapshot.activity.length === 0 && <li className="text-muted">Nothing yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}
