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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:flex-row">
      <nav aria-label="Admin" className="md:w-48 md:shrink-0">
        <div className="mb-3 hidden items-center justify-between md:flex">
          <h2 className="text-lg font-semibold">Admin</h2>
        </div>
        <ul className="flex gap-1.5 overflow-x-auto md:flex-col">
          {TABS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => setTab(t.id)}
                className={`flex w-full items-center gap-2 whitespace-nowrap border-2 px-3 py-2 text-left text-sm font-medium ${
                  tab === t.id ? 'border-accent bg-accent/15 text-ink' : 'border-transparent text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <PixelIcon name={t.icon} size={16} />
                {t.label}
                {t.id === 'users' && pending > 0 && (
                  <span className="ml-auto bg-reserved px-1.5 text-xs font-semibold text-black">{pending}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
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
  )
}

/** Page heading shared by the admin pages. */
export function AdminHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end gap-3">
      <div className="mr-auto">
        <h2 className="text-xl font-semibold">{title}</h2>
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
