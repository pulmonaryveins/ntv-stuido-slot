import { useState } from 'react'
import { useStudio } from '../../store/studio'
import { PixelIcon, type IconName } from '../PixelIcon'
import { Loader } from '../Loader'
import { UserAvatar } from '../UserAvatar'
import { Dashboard } from './Dashboard'
import { UsersPage } from './UsersPage'
import { SeatsPage } from './SeatsPage'
import { ActivityPage } from './ActivityPage'
import { SettingsPage } from './SettingsPage'

export type AdminTab = 'dashboard' | 'users' | 'seats' | 'activity' | 'settings'

const TABS: { id: AdminTab; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'sparkle' },
  { id: 'users', label: 'Users', icon: 'user' },
  { id: 'seats', label: 'Seats', icon: 'block' },
  { id: 'activity', label: 'Activity', icon: 'clock' },
  { id: 'settings', label: 'Settings', icon: 'shield' },
]

const GROUPS: { label: string; tabs: AdminTab[] }[] = [
  { label: 'Overview', tabs: ['dashboard'] },
  { label: 'Manage', tabs: ['users', 'seats'] },
  { label: 'Records', tabs: ['activity'] },
  { label: 'Configure', tabs: ['settings'] },
]

const KEY = 'ss.adminTab'
function readTab(): AdminTab {
  try {
    const v = localStorage.getItem(KEY)
    return TABS.some((t) => t.id === v) ? (v as AdminTab) : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

/** Admin area: sidebar navigation (tabs on small screens) and one page at a time. */
export function AdminPage() {
  const snapshot = useStudio((s) => s.snapshot)
  const [tab, setTabState] = useState<AdminTab>(readTab)
  const setTab = (t: AdminTab) => {
    setTabState(t)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* remembered tab is only a convenience */
    }
  }
  const pending = snapshot?.profiles.filter((p) => !p.active).length ?? 0

  const free = snapshot?.slots.filter((x) => !x.user_id && !x.hold_user_id).length ?? 0
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <nav aria-label="Admin" className="on-dark shrink-0 border-b border-line bg-[#2a170b] md:flex md:w-64 md:flex-col md:border-b-0 md:border-r">
        <div className="hidden items-center gap-2.5 px-4 pb-3 pt-5 md:flex">
          <span className="px-btn grid size-9 place-items-center bg-[#5b8def]">
            <PixelIcon name="shield" size={18} />
          </span>
          <div className="leading-tight">
            <p className="font-pixel text-base text-ink">Admin</p>
            <p className="text-[11px] text-muted">Manage seats and people</p>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:gap-4 md:overflow-y-auto md:px-3 md:py-2">
          {GROUPS.map((g) => (
            <div key={g.label} className="contents md:block">
              <p className="hidden px-2 pb-1 font-pixel text-[10px] text-muted md:block">{g.label}</p>
              <ul className="contents md:block md:space-y-1">
                {g.tabs.map((id) => {
                  const t = TABS.find((x) => x.id === id)!
                  const on = tab === id
                  return (
                    <li key={id} className="shrink-0">
                      <button
                        type="button"
                        aria-current={on ? 'page' : undefined}
                        onClick={() => setTab(id)}
                        className={`flex w-full items-center gap-2.5 whitespace-nowrap border px-2 py-1.5 text-left text-sm font-medium ${
                          on ? 'border-line bg-accent text-white' : 'border-transparent text-muted hover:bg-white/[0.05] hover:text-ink'
                        }`}
                      >
                        <span className={`grid size-7 place-items-center border ${on ? 'border-line bg-black/20' : 'border-white/10 bg-white/[0.04]'}`}>
                          <PixelIcon name={t.icon} size={14} />
                        </span>
                        {t.label}
                        {id === 'users' && pending > 0 && (
                          <span className="ml-auto border border-line bg-reserved px-1.5 text-[11px] font-bold text-black" aria-label={`${pending} waiting for approval`}>
                            {pending}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        {snapshot && (
          <div className="m-3 hidden border border-line bg-[#1f1108] p-3 text-xs md:block">
            <p className="font-pixel text-[10px] text-muted">Right now</p>
            <p className="mt-1 text-ink">
              <span className="font-semibold text-free">{free}</span> of {snapshot.slots.length} seats free
            </p>
            <p className="text-muted">
              {snapshot.queue.length} waiting · {pending} pending approval
            </p>
          </div>
        )}
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          <p className="mb-1 text-xs text-muted">
            Admin <span aria-hidden>›</span> <span className="text-ink">{current.label}</span>
          </p>
          {!snapshot ? (
            <Loader label="Loading admin" />
          ) : tab === 'dashboard' ? (
            <Dashboard snapshot={snapshot} goTo={setTab} />
          ) : tab === 'users' ? (
            <UsersPage snapshot={snapshot} />
          ) : tab === 'seats' ? (
            <SeatsPage snapshot={snapshot} />
          ) : tab === 'activity' ? (
            <ActivityPage snapshot={snapshot} />
          ) : (
            <SettingsPage snapshot={snapshot} />
          )}
        </div>
      </div>
    </div>
  )
}

/** Page heading shared by the admin pages. */
export function AdminHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end gap-3 border-b border-line pb-4">
      <div className="mr-auto">
        <h2 className="text-2xl">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </header>
  )
}

export function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const r = Math.round(m % 60)
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`
}

/** Small colored dot + name, as used across the board. */
export function UserName({ id, name, color, you }: { id?: string; name: string; color: string; you?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <UserAvatar profile={{ id: id ?? name, name, avatar_color: color }} size={22} />
      <span className="truncate">{name}</span>
      {you && <span className="text-accent">(you)</span>}
    </span>
  )
}
