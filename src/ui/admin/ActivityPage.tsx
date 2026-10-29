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

export function ActivityPage({ snapshot }: { snapshot: Snapshot }) {
  const [category, setCategory] = useState<ActivityCategory>('all')
  const [userId, setUserId] = useState('')
  const [query, setQuery] = useState('')
  const now = studioClient.now()
  const q = query.trim().toLowerCase()

  const rows = snapshot.activity
    .map((e) => ({ e, d: describeActivity(e, snapshot) }))
    .filter(({ e }) => category === 'all' || activityCategory(e.action) === category)
    .filter(({ e }) => !userId || e.user_id === userId || (e.meta as { target_user_id?: string } | null)?.target_user_id === userId)
    .filter(({ d }) => !q || d.text.toLowerCase().includes(q))

  const people = [...snapshot.profiles].sort((a, b) => a.name.localeCompare(b.name))
  let lastDay = ''

  return (
    <div>
      <AdminHeader title="Activity" description={`The latest ${snapshot.activity.length} events on the board.`} />

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
