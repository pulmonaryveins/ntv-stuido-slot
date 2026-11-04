import * as Menu from '@radix-ui/react-dropdown-menu'
import { mockClient } from '../data'
import { backendMode } from '../lib/backend'
import { useAuth } from '../store/auth'
import { useStudio, type Page, type Speed, type TimeMode, type View } from '../store/studio'
import { Segmented, Select, Tip } from './controls'
import { useNow } from './useNow'
import { slotAccent } from './SlotCard'
import { deriveSlotView } from '../lib/slotState'
import { formatClock } from '../lib/format'
import { UserAvatar } from './UserAvatar'
import { PixelIcon, type IconName } from './PixelIcon'

export function TopBar() {
  const s = useStudio()
  const me = s.snapshot?.profiles.find((p) => p.id === s.actorId)
  const isAdmin = me?.role === 'admin'
  const pendingCount = isAdmin ? (s.snapshot?.profiles.filter((p) => !p.active).length ?? 0) : 0
  const now = useNow(30_000)

  return (
    <header className="on-dark border-b border-white/10 bg-[#1f1108]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="px-btn grid size-10 place-items-center bg-accent">
            <PixelIcon name="brush" size={22} />
          </span>
          <div className="leading-tight">
            <h1 className="text-lg">Studio Slots</h1>
            <p className="text-[11px] text-muted">Adobe seat board</p>
          </div>
          {mockClient && (
            <span className="border border-line bg-reserved px-1.5 text-[10px] font-semibold text-black">
              Mock
            </span>
          )}
        </div>

        {isAdmin && (
          <nav aria-label="Main" className="flex h-11 items-stretch gap-1 border-l border-white/10 pl-4">
            <NavTab page="board" current={s.page} onClick={s.setPage} icon="block">
              Board
            </NavTab>
            <NavTab page="admin" current={s.page} onClick={s.setPage} icon="shield" badge={pendingCount}>
              Admin
            </NavTab>
          </nav>
        )}

        {s.snapshot && <SeatStrip />}

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <span className="hidden font-pixel text-sm tabular-nums text-muted xl:inline" aria-label="Current time">
            {formatClock(now)}
          </span>
          {s.page === 'board' && (
            <>
              <Segmented<View>
                size="lg"
                label="View"
                value={s.view}
                onChange={s.setView}
                options={[
                  { value: '3d', label: <><PixelIcon name="brush" size={14} />Office</>, title: 'Office view' },
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
          className="flex flex-wrap items-center gap-2 border-t border-dashed border-accent/60 bg-accent/5 px-3 py-1.5 sm:px-4"
          role="group"
          aria-label="Dev tools (mock data only)"
        >
          <span className="text-[10px] font-bold text-accent">Dev tools</span>
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

/** Live seat strip: one block per seat (portrait when taken), free count and waiting count. */
function SeatStrip() {
  const snapshot = useStudio((s) => s.snapshot)!
  const openClaim = useStudio((s) => s.openClaim)
  const setPage = useStudio((s) => s.setPage)
  const now = useNow(5_000)
  const free = snapshot.slots.filter((x) => !x.user_id && !x.hold_user_id).length
  return (
    <div className="hidden items-center gap-3 border-l border-white/10 pl-5 lg:flex" aria-label="Seats">
      <div className="flex gap-2">
        {snapshot.accounts.map((a) => (
          <div key={a.id} className="flex gap-1">
            {snapshot.slots
              .filter((sl) => sl.account_id === a.id)
              .sort((x, y) => x.slot_number - y.slot_number)
              .map((sl) => {
                const v = deriveSlotView(sl, now)
                const holder = snapshot.profiles.find((p) => p.id === (sl.user_id ?? sl.hold_user_id))
                const isFree = !sl.user_id && !sl.hold_user_id
                const label = `${a.label} · Slot ${sl.slot_number}: ${isFree ? 'free' : v.kind === 'reserved' ? `held for ${holder?.name ?? 'someone'}` : `${holder?.name ?? 'in use'}${sl.device_name ? ` on ${sl.device_name}` : ''}`}`
                return (
                  <Tip key={sl.id} content={label} side="bottom">
                    <button
                      type="button"
                      aria-label={label}
                      onClick={() => {
                        setPage('board')
                        if (isFree) openClaim(sl.id)
                      }}
                      className="grid size-8 place-items-center border border-line hover:brightness-110"
                      style={{ background: slotAccent(sl, v) }}
                    >
                      {holder ? <UserAvatar profile={holder} size={20} className="border" /> : null}
                    </button>
                  </Tip>
                )
              })}
          </div>
        ))}
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">
          <span className={free ? 'text-free' : 'text-reserved'}>{free}</span>
          <span className="text-muted">/{snapshot.slots.length}</span> free
        </p>
        <p className="text-[11px] text-muted">{snapshot.queue.length ? `${snapshot.queue.length} waiting` : 'No one waiting'}</p>
      </div>
    </div>
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
      className={`font-pixel inline-flex items-center gap-2 border-b px-3 text-sm ${
        on ? 'border-accent bg-white/[0.06] text-ink' : 'border-transparent text-muted hover:bg-white/[0.04] hover:text-ink'
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
        className="group inline-flex h-11 items-center gap-2.5 border border-line bg-surface-2 pl-1 pr-3 text-sm hover:brightness-110 data-[state=open]:outline-2 data-[state=open]:outline-accent"
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
