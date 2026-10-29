import * as Menu from '@radix-ui/react-dropdown-menu'
import { mockClient } from '../data'
import { backendMode } from '../lib/backend'
import { useAuth } from '../store/auth'
import { useStudio, type Page, type Speed, type TimeMode, type View } from '../store/studio'
import { Segmented, Select } from './controls'
import { UserAvatar } from './UserAvatar'
import { PixelIcon, type IconName } from './PixelIcon'

export function TopBar() {
  const s = useStudio()
  const me = s.snapshot?.profiles.find((p) => p.id === s.actorId)
  const isAdmin = me?.role === 'admin'
  const pendingCount = isAdmin ? (s.snapshot?.profiles.filter((p) => !p.active).length ?? 0) : 0
  const seatsFree = s.snapshot ? s.snapshot.slots.filter((x) => !x.user_id && !x.hold_user_id).length : null

  return (
    <header className="on-dark border-b-2 border-black bg-black">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="px-btn grid size-9 place-items-center bg-accent">
            <PixelIcon name="brush" size={20} />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-semibold">Studio Slots</h1>
            {seatsFree !== null && (
              <p className="text-xs text-muted">
                <span className={seatsFree ? 'text-free' : 'text-reserved'}>●</span>{' '}
                {seatsFree ? `${seatsFree} seat${seatsFree === 1 ? '' : 's'} free` : 'All seats taken'}
              </p>
            )}
          </div>
          {mockClient && (
            <span className="border-2 border-line bg-reserved px-1.5 text-[10px] font-semibold uppercase tracking-wide text-black">
              Mock
            </span>
          )}
        </div>

        {isAdmin && (
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavTab page="board" current={s.page} onClick={s.setPage} icon="block">
              Board
            </NavTab>
            <NavTab page="admin" current={s.page} onClick={s.setPage} icon="shield" badge={pendingCount}>
              Admin
            </NavTab>
          </nav>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {s.page === 'board' && (
            <>
              <Segmented<View>
                size="lg"
                label="View"
                value={s.view}
                onChange={s.setView}
                options={[
                  { value: '3d', label: <><PixelIcon name="block" size={14} />3D</>, title: s.webgl ? '3D studio' : '3D unavailable (no WebGL)', disabled: !s.webgl },
                  { value: 'list', label: <><PixelIcon name="list" size={14} />List</>, title: 'List view' },
                ]}
              />
              {s.view === '3d' && (
                <Segmented<TimeMode>
                  size="lg"
                  label="Time of day"
                  value={s.timeMode}
                  onChange={s.setTimeMode}
                  options={[
                    { value: 'auto', label: 'Auto', title: 'Time of day: follow clock' },
                    { value: 'day', label: <PixelIcon name="sun" size={18} />, title: 'Day' },
                    { value: 'night', label: <PixelIcon name="moon" size={18} />, title: 'Night' },
                  ]}
                />
              )}
            </>
          )}
          {me && <AccountMenu id={me.id} name={me.name} color={me.avatar_color} role={me.role} device={me.device_name} />}
        </div>
      </div>

      {mockClient && (
        <div
          className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-accent/60 bg-accent/5 px-3 py-1.5 sm:px-4"
          role="group"
          aria-label="Dev tools (mock data only)"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Dev tools</span>
          <label className="flex items-center gap-1.5 text-xs font-medium">
            <input type="checkbox" checked={s.demo} onChange={(e) => s.setDemo(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Live demo
          </label>
          <Segmented<`${Speed}`>
            label="Mock clock speed"
            value={`${s.speed}`}
            onChange={(v) => s.setSpeed(Number(v) as Speed)}
            options={[
              { value: '1', label: '1×', title: 'Speed 1×' },
              { value: '60', label: '60×', title: 'Speed 60×' },
              { value: '240', label: '240×', title: 'Speed 240×' },
            ]}
          />
          <ActingAs />
        </div>
      )}
    </header>
  )
}

function NavTab({
  page,
  current,
  onClick,
  icon,
  badge = 0,
  children,
}: {
  page: Page
  current: Page
  onClick: (p: Page) => void
  icon: IconName
  badge?: number
  children: string
}) {
  const on = page === current
  return (
    <button
      type="button"
      aria-current={on ? 'page' : undefined}
      onClick={() => onClick(page)}
      className={`font-pixel inline-flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-sm font-semibold uppercase ${
        on ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      <PixelIcon name={icon} size={14} />
      {children}
      {badge > 0 && (
        <span className="bg-reserved px-1.5 font-sans text-[11px] font-bold text-black" aria-label={`${badge} waiting for approval`}>
          {badge}
        </span>
      )}
    </button>
  )
}

const itemClass =
  'flex cursor-pointer select-none items-center gap-2.5 px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-ink'

/** Avatar button opening the account menu: device, theme, sign out. */
function AccountMenu({ id, name, color, role, device }: { id: string; name: string; color: string; role: string; device: string | null }) {
  const signOut = useAuth((s) => s.signOut)
  const theme = useStudio((s) => s.theme)
  const setTheme = useStudio((s) => s.setTheme)
  const openDeviceDialog = useStudio((s) => s.openDeviceDialog)
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={`Account menu for ${name}`}
        className="group inline-flex h-11 items-center gap-2.5 border-2 border-line bg-surface-2 pl-1 pr-3 text-sm shadow-[inset_0_-3px_0_var(--lip),inset_0_2px_0_var(--hi)] hover:brightness-110 data-[state=open]:outline-2 data-[state=open]:outline-accent"
      >
        <UserAvatar profile={{ id, name, avatar_color: color }} size={34} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-32 truncate font-semibold leading-tight">{name}</span>
          {/* The hostname is what Adobe lists: keep it prominent. */}
          <DeviceTag device={device} />
        </span>
        <svg width="10" height="6" viewBox="0 0 5 3" shapeRendering="crispEdges" aria-hidden className="text-muted transition-transform group-data-[state=open]:rotate-180">
          <path fill="currentColor" d="M0 0h5v1H4v1H3v1H2V2H1V1H0z" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="px-panel z-50 w-60 p-1">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <UserAvatar profile={{ id, name, avatar_color: color }} size={44} />
            <div className="min-w-0">
              <div className="truncate font-medium">{name}</div>
              <div className="text-xs capitalize text-muted">{role}</div>
            </div>
          </div>
          <Menu.Separator className="my-1 h-0.5 bg-line" />
          <Menu.Item className={itemClass} onSelect={() => openDeviceDialog(true)}>
            <PixelIcon name="block" size={14} />
            <span className="flex-1">Device name</span>
            <DeviceTag device={device} />
          </Menu.Item>
          <Menu.Item className={itemClass} onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <PixelIcon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            <span className="flex-1">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
          </Menu.Item>
          {backendMode === 'bff' && (
            <>
              <Menu.Separator className="my-1 h-0.5 bg-line" />
              <Menu.Item className={itemClass} onSelect={() => void signOut()}>
                <PixelIcon name="door" size={14} />
                <span className="flex-1">Sign out</span>
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/** The user's Adobe device name (hostname), highlighted; a warning when it is missing. */
function DeviceTag({ device }: { device: string | null }) {
  return device ? (
    <span className="mt-0.5 inline-flex items-center gap-1 bg-accent px-1 font-mono text-[11px] font-bold leading-4 text-accent-ink">
      <span className="font-sans font-semibold opacity-80">PC</span>
      {device}
    </span>
  ) : (
    <span className="mt-0.5 inline-block bg-overdue px-1 text-[11px] font-bold leading-4 text-white">Set device</span>
  )
}

/** DEV TOOL: impersonate any seed user (mock data only). */
function ActingAs() {
  const profiles = useStudio((s) => s.snapshot?.profiles) ?? []
  const actorId = useStudio((s) => s.actorId)
  const setActor = useStudio((s) => s.setActor)
  if (!actorId) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted">Acting as</span>
      <Select
        size="sm"
        label="Acting as (dev tool)"
        value={actorId}
        onChange={setActor}
        options={profiles.map((p) => ({ value: p.id, label: p.role === 'admin' ? `${p.name} (admin)` : p.name, icon: <UserAvatar profile={p} size={18} /> }))}
      />
    </span>
  )
}
