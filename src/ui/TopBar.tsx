import * as Select from '@radix-ui/react-select'
import { mockClient } from '../data'
import { backendMode } from '../lib/backend'
import { useAuth } from '../store/auth'
import { useStudio, type Speed, type TimeMode, type View } from '../store/studio'
import { Button, Segmented } from './controls'
import { PixelIcon } from './PixelIcon'

export function TopBar() {
  const s = useStudio()
  const me = s.snapshot?.profiles.find((p) => p.id === s.actorId)
  const isAdmin = me?.role === 'admin'
  const pendingCount = isAdmin ? (s.snapshot?.profiles.filter((p) => !p.active).length ?? 0) : 0

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-line bg-surface px-3 py-2 shadow-[inset_0_-3px_0_var(--lo)] sm:px-4">
      <div className="mr-auto flex items-center gap-2">
        <span aria-hidden className="px-btn grid size-8 place-items-center bg-accent">
          <PixelIcon name="brush" size={20} />
        </span>
        <h1 className="text-lg font-semibold tracking-wide">Studio Slots</h1>
        {mockClient && (
          <span className="border-2 border-line bg-reserved px-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
            Mock data
          </span>
        )}
      </div>

      <Segmented<View>
        label="View"
        value={s.view}
        onChange={s.setView}
        options={[
          { value: '3d', label: '3D', title: s.webgl ? '3D studio' : '3D unavailable (no WebGL)', disabled: !s.webgl },
          { value: 'list', label: 'List', title: 'List view' },
        ]}
      />

      <Segmented<TimeMode>
        label="Time of day"
        value={s.timeMode}
        onChange={s.setTimeMode}
        options={[
          { value: 'auto', label: 'Auto', title: 'Time of day: follow clock' },
          { value: 'day', label: <PixelIcon name="sun" size={14} />, title: 'Day' },
          { value: 'night', label: <PixelIcon name="moon" size={14} />, title: 'Night' },
        ]}
      />

      <Button
        variant="ghost"
        aria-label={`Switch to ${s.theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={() => s.setTheme(s.theme === 'dark' ? 'light' : 'dark')}
      >
        <PixelIcon name={s.theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </Button>

      {backendMode === 'bff' && me && <AccountMenu name={me.name} color={me.avatar_color} />}

      {isAdmin && (
        <Button
          variant={s.page === 'admin' ? 'primary' : 'secondary'}
          aria-pressed={s.page === 'admin'}
          onClick={() => s.setPage(s.page === 'admin' ? 'board' : 'admin')}
        >
          Admin
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-reserved px-1.5 text-[10px] font-bold text-ink" aria-label={`${pendingCount} waiting for approval`}>
              {pendingCount}
            </span>
          )}
        </Button>
      )}

      {mockClient && (
        <div
          className="flex flex-wrap items-center gap-2 border-[3px] border-dashed border-accent bg-accent/10 px-2 py-1"
          role="group"
          aria-label="Dev tools (mock data only)"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Dev</span>
          <label className="flex items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={s.demo}
              onChange={(e) => s.setDemo(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
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

/** Signed-in user and sign-out. */
function AccountMenu({ name, color }: { name: string; color: string }) {
  const signOut = useAuth((s) => s.signOut)
  return (
    <div className="flex items-center gap-2 text-sm">
      <span aria-hidden className="size-3 rounded-full" style={{ background: color }} />
      <span className="max-w-32 truncate font-medium">{name}</span>
      <Button variant="ghost" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}

const NO_PROFILES: never[] = []

/** DEV TOOL: impersonate any seed user. Remove when auth lands. */
function ActingAs() {
  const profiles = useStudio((s) => s.snapshot?.profiles) ?? NO_PROFILES
  const actorId = useStudio((s) => s.actorId)
  const setActor = useStudio((s) => s.setActor)
  return (
    <Select.Root value={actorId ?? undefined} onValueChange={setActor}>
      <Select.Trigger
        aria-label="Acting as (dev tool)"
        className="inline-flex items-center gap-1.5 px-panel px-2 py-1 text-xs font-medium"
      >
        <span className="text-muted">Acting as</span>
        <Select.Value placeholder="Pick user" />
        <span aria-hidden>▾</span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={4} className="z-50 max-h-80 overflow-hidden px-panel">
          <Select.Viewport className="p-1">
            {profiles.map((p) => (
              <Select.Item
                key={p.id}
                value={p.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-2"
              >
                <span aria-hidden className="size-3 rounded-full" style={{ background: p.avatar_color }} />
                <Select.ItemText>{p.name}</Select.ItemText>
                <span className="ml-auto text-[10px] uppercase text-muted">
                  {p.role === 'admin' ? 'admin' : p.work_role}
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
