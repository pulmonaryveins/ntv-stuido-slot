import { useState } from 'react'
import type { Snapshot } from '../../data'
import { studioClient } from '../../data'
import { describeActivity } from '../../lib/activityText'
import { activityCategory, type ActivityCategory } from '../../lib/adminStats'
import { formatAgo, formatClock, toMs } from '../../lib/format'
import { PixelIcon } from '../PixelIcon'
import { Select } from '../controls'
import { UserAvatar } from '../UserAvatar'
import { AdminHeader } from './AdminPage'

const CATEGORIES: { id: ActivityCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'queue', label: 'Waiting list' },
  { id: 'admin', label: 'Admin actions' },
  { id: 'accounts', label: 'Accounts' },
]

/** Which log an entry belongs to: the account of its slot, or 'other' for board-wide events. */
type LogId = number | 'other' | 'all'

export function ActivityPage({ snapshot }: { snapshot: Snapshot }) {
  const [log, setLog] = useState<LogId>(() => snapshot.accounts[0]?.id ?? 'all')
  const [category, setCategory] = useState<ActivityCategory>('all')
  const [userId, setUserId] = useState('')
  const [query, setQuery] = useState('')
  const now = studioClient.now()
  const q = query.trim().toLowerCase()

  const accountOf = (slotId: number | null): number | 'other' => snapshot.slots.find((sl) => sl.id === slotId)?.account_id ?? 'other'
  const logs: { id: LogId; label: string; count: number }[] = [
    ...snapshot.accounts.map((a) => ({ id: a.id as LogId, label: a.label, count: snapshot.activity.filter((e) => accountOf(e.slot_id) === a.id).length })),
    { id: 'other', label: 'Board & users', count: snapshot.activity.filter((e) => accountOf(e.slot_id) === 'other').length },
    { id: 'all', label: 'All', count: snapshot.activity.length },
  ]
  const current = logs.find((l) => l.id === log) ?? logs[logs.length - 1]!

  const rows = snapshot.activity
    .filter((e) => log === 'all' || accountOf(e.slot_id) === log)
    .map((e) => ({ e, d: describeActivity(e, snapshot) }))
    .filter(({ e }) => category === 'all' || activityCategory(e.action) === category)
    .filter(({ e }) => !userId || e.user_id === userId || (e.meta as { target_user_id?: string } | null)?.target_user_id === userId)
    .filter(({ d }) => !q || d.text.toLowerCase().includes(q))

  const people = [...snapshot.profiles].sort((a, b) => a.name.localeCompare(b.name))
  let lastDay = ''

  return (
    <div>
      <AdminHeader
        title="Activity"
        description={
          log === 'all'
            ? `The latest ${snapshot.activity.length} events on the board.`
            : log === 'other'
              ? `${current.count} board-wide events: waiting list, breaks, registrations and admin changes to users.`
              : `${current.count} events on ${current.label}'s seats.`
        }
      />

      {/* one log per Adobe account, plus board-wide events */}
      <div role="tablist" aria-label="Activity log" className="mb-3 flex flex-wrap gap-0 border-b-2 border-line">
        {logs.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={log === l.id}
            onClick={() => setLog(l.id)}
            className={`-mb-0.5 border-b-2 px-3 py-2 font-pixel text-sm ${log === l.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {l.label} <span className="ml-1 text-xs text-muted">{l.count}</span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`px-badge px-2.5 py-1 text-sm ${category === c.id ? 'bg-accent text-accent-ink' : 'bg-surface-2 hover:brightness-105'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Select
          label="Filter by user"
          value={userId || 'everyone'}
          onChange={(v) => setUserId(v === 'everyone' ? '' : v)}
          options={[
            { value: 'everyone', label: 'Everyone' },
            ...people.map((p) => ({ value: p.id, label: p.name, icon: <UserAvatar profile={p} size={18} /> })),
          ]}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search activity"
          className="ml-auto w-full border-2 border-line bg-surface-2 px-2.5 py-1.5 text-sm sm:w-48"
        />
      </div>

      <div className="px-panel p-2">
        {rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted">No matching activity.</p>
        ) : (
          <ul className="text-sm">
            {rows.map(({ e, d }) => {
              const at = toMs(e.created_at) ?? now
              const day = new Date(at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              const header = day !== lastDay
              lastDay = day
              return (
                <li key={e.id}>
                  {header && <div className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted first:pt-1">{day}</div>}
                  <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-2">
                    <span className="w-16 shrink-0 font-mono text-xs text-muted">{formatClock(at)}</span>
                    <PixelIcon name={d.icon} size={14} />
                    <span className="min-w-0 flex-1">{d.text}</span>
                    <span className="hidden shrink-0 text-xs text-muted sm:inline">{formatAgo(at, now)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
