import * as Select from '@radix-ui/react-select'
import { mockClient } from '../data'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useStudio, type Speed, type TimeMode, type View } from '../store/studio'
import { Button, Segmented } from './controls'

export function TopBar() {
  const s = useStudio()
  const me = s.snapshot?.profiles.find((p) => p.id === s.actorId)
  const isAdmin = me?.role === 'admin'

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
      <div className="mr-auto flex items-center gap-2">
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent text-sm text-accent-ink">
          ◆
        </span>
        <h1 className="text-base font-semibold tracking-tight">Studio Slots</h1>
        {mockClient && (
          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
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
          { value: 'day', label: '☀', title: 'Day' },
          { value: 'night', label: '☾', title: 'Night' },
        ]}
      />

      <Button
        variant="ghost"
        aria-label={`Switch to ${s.theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={() => s.setTheme(s.theme === 'dark' ? 'light' : 'dark')}
      >
        {s.theme === 'dark' ? '☀︎' : '☾'}
      </Button>

      {supabaseConfigured && me && <AccountMenu name={me.name} color={me.avatar_color} />}

      {isAdmin && (
        <Button
          variant={s.page === 'admin' ? 'primary' : 'secondary'}
          aria-pressed={s.page === 'admin'}
          onClick={() => s.setPage(s.page === 'admin' ? 'board' : 'admin')}
        >
          Admin
        </Button>
      )}

      {mockClient && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-accent/60 bg-accent/5 px-2 py-1"
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium"
      >
        <span className="text-muted">Acting as</span>
        <Select.Value placeholder="Pick user" />
        <span aria-hidden>▾</span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={4} className="z-50 max-h-80 overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
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
