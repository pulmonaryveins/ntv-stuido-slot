import { useEffect, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { SlotStatus } from '../data'
import { DEFAULT_STATUS_FOR_ROLE } from '../lib/status'
import { MINUTE, formatClock } from '../lib/format'
import { studioClient } from '../data'
import { useStudio } from '../store/studio'
import { Button } from './controls'
import { TimePicker } from './TimePicker'
import { Spinner } from './Loader'
import { recentDevices, rememberDevice } from '../lib/recentDevices'

export function Shell({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 px-panel p-5 text-ink">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Fewer, rounder choices; anything else goes through "Other". */
const CLAIM_DURATIONS = [30, 60, 120, 180, 240]

function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const r = m % 60
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`
}

/** A sensible first custom end: the chosen preset, rounded up to 5 min and kept within the limit. */
function defaultEnd(now: number, preset: number, max: number) {
  const mins = Math.min(preset, max)
  const d = new Date(now + mins * MINUTE)
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0)
  if (d.getTime() - now > max * MINUTE) d.setTime(now + max * MINUTE)
  if (d.getDate() !== new Date(now).getDate()) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Minutes from `now` until the next HH:MM today; null when unset or already past. */
function minutesUntil(hhmm: string, now: number): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const end = new Date(now)
  end.setHours(Number(m[1]), Number(m[2]), 0, 0)
  const diff = Math.ceil((end.getTime() - now) / MINUTE)
  return diff >= 1 ? diff : null
}

const DEVICE_NAME_RE = /^[A-Z0-9-]{1,15}$/

/** Windows device name (hostname) input; Adobe lists seats by it. Upper-cases as you type. */
function DeviceNameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      Device name (hostname)
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        maxLength={15}
        placeholder="e.g. H7"
        autoComplete="off"
        spellCheck={false}
        className="mt-1 block w-full border-2 border-line bg-surface-2 px-2.5 py-2 font-mono"
      />
      <span className="mt-1 block text-xs font-normal text-muted">Settings › System › About › Device name (or Win + R → cmd → hostname).</span>
    </label>
  )
}

/** One-click recent devices (plus an optional "Other…" action). */
function RecentDeviceChips({ devices, selected, onPick, onOther }: { devices: string[]; selected: string | null; onPick: (d: string) => void; onOther?: () => void }) {
  if (!devices.length && !onOther) return null
  return (
    <div role="group" aria-label="Recent devices" className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">Recent:</span>
      {devices.map((d) => {
        const on = selected?.toLowerCase() === d.toLowerCase()
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(d)}
            className={`px-badge px-2 py-0.5 font-mono text-xs ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink hover:brightness-105'}`}
          >
            {d}
          </button>
        )
      })}
      {onOther && (
        <button type="button" onClick={onOther} className="text-xs text-muted underline hover:text-ink">
          Other…
        </button>
      )}
    </div>
  )
}

export function ClaimDialog() {
  const slotId = useStudio((s) => s.claimFor)
  const openClaim = useStudio((s) => s.openClaim)
  const close = () => openClaim(null)
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const act = useStudio((s) => s.act)
  const me = snapshot?.profiles.find((p) => p.id === actorId)
  const max = snapshot?.settings.max_session_min ?? 240

  const busy = useStudio((s) => s.busy > 0)
  const [presetMin, setPresetMin] = useState(60)
  const [custom, setCustom] = useState(false)
  const [endTime, setEndTime] = useState('')
  const openDeviceDialog = useStudio((s) => s.openDeviceDialog)
  const [chosen, setChosen] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  useEffect(() => {
    setPresetMin(60)
    setCustom(false)
    setEndTime('')
    setChosen(null)
    setPicking(false)
    // Only when the dialog opens for a slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId])

  if (!snapshot) return null
  const savedDevice = me?.device_name ?? null
  // The profile device (set at sign-up) unless they picked another recent one for this claim.
  const device = chosen ?? savedDevice
  const recent = recentDevices(snapshot, actorId)
  // Start is always "now" (the seat is taken immediately); the end is a preset or a clock time.
  const now = studioClient.now()
  const custMin = custom ? minutesUntil(endTime, now) : null
  const minutes = custom ? (custMin ?? 0) : presetMin
  const endError = custom ? (!endTime ? 'Pick the time you will finish.' : custMin === null || custMin < 1 ? 'End time must be later than now.' : custMin > max ? `Sessions are limited to ${formatMinutes(max)}. Extend later if needed.` : null) : null
  // The seat is recorded under the work they do by default; they can change it on the card.
  const status: SlotStatus = me ? DEFAULT_STATUS_FOR_ROLE[me.work_role] : 'designing'
  const submit = async () => {
    if (slotId === null || !device || endError) return
    // A different device is sent along; the server also remembers it as their device.
    const override = device !== savedDevice ? device : undefined
    if (await act((c) => c.claimSlot(slotId, status, minutes, override))) {
      rememberDevice(actorId, device)
      close()
    }
  }

  const end = now + minutes * MINUTE
  const slot = snapshot.slots.find((x) => x.id === slotId)
  const accountLabel = snapshot.accounts.find((a) => a.id === slot?.account_id)?.label ?? 'Account'
  const option = (on: boolean) =>
    `px-btn flex flex-col items-center justify-center px-2 py-2 leading-tight ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`

  return (
    <Shell
      open={slotId !== null}
      onClose={close}
      title={`Claim ${accountLabel} · Slot ${slot?.slot_number ?? ''}`}
      description="Sign in to Adobe only after you claim."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-5"
      >
        <fieldset>
          <legend className="mb-2 text-sm">Until when?</legend>
          {/* Each choice shows the finish time first: that is what people plan around. */}
          <div role="group" aria-label="Finish time" className="grid grid-cols-3 gap-2">
            {CLAIM_DURATIONS.filter((d) => d <= max).map((d) => {
              const on = !custom && presetMin === d
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setCustom(false)
                    setPresetMin(d)
                  }}
                  className={option(on)}
                >
                  <span className="font-mono text-base font-bold">{formatClock(now + d * MINUTE)}</span>
                  <span className="font-sans text-xs normal-case opacity-80">{formatMinutes(d)}</span>
                </button>
              )
            })}
            <button
              type="button"
              aria-pressed={custom}
              onClick={() => {
                setCustom(true)
                if (!endTime) setEndTime(defaultEnd(now, presetMin, max))
              }}
              className={option(custom)}
            >
              <span className="text-base font-bold">Other</span>
              <span className="font-sans text-xs normal-case opacity-80">pick a time</span>
            </button>
          </div>
          {custom && <TimePicker value={endTime} onChange={setEndTime} now={now} maxMinutes={max} />}
        </fieldset>

        {/* One-line summary of what will happen. */}
        <div className={`border-2 px-3 py-2.5 text-sm ${endError ? 'border-overdue/60 bg-overdue/10' : 'border-line bg-surface-2'}`}>
          {endError ? (
            <p role="alert" className="text-overdue">
              {endError}
            </p>
          ) : (
            <p>
              <span className="font-mono font-bold">{formatClock(now)}</span> → <span className="font-mono font-bold">{formatClock(end)}</span>
              <span className="text-muted"> · {formatMinutes(minutes)} · extend or end any time</span>
            </p>
          )}
        </div>

        {device ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Device</span>
              <span className="bg-accent px-1.5 font-mono font-bold text-accent-ink">{device}</span>
              {!picking && (
                <button type="button" className="ml-auto text-xs text-muted underline hover:text-ink" onClick={() => setPicking(true)}>
                  Not this PC?
                </button>
              )}
            </div>
            {picking && (
              <RecentDeviceChips
                devices={recent}
                selected={device}
                onPick={setChosen}
                onOther={() => {
                  close()
                  openDeviceDialog(true)
                }}
              />
            )}
          </div>
        ) : (
          // Only accounts created before device names existed land here.
          <p role="alert" className="border-2 border-overdue/60 bg-overdue/10 px-2.5 py-2 text-sm">
            Your account has no device name yet.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                close()
                openDeviceDialog(true)
              }}
            >
              Set device name
            </button>
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={close} className="flex-1 py-2">
            Cancel
          </Button>
          <button
            type="submit"
            disabled={!savedDevice || !!endError || busy}
            aria-busy={busy}
            className="px-btn inline-flex flex-[2] items-center justify-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Spinner size={14} /> Claiming…
              </>
            ) : endError ? (
              'Claim'
            ) : (
              `Claim until ${formatClock(end)}`
            )}
          </button>
        </div>
      </form>
    </Shell>
  )
}

export function DeviceNameDialog() {
  const open = useStudio((s) => s.deviceDialog)
  const setOpen = useStudio((s) => s.openDeviceDialog)
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const act = useStudio((s) => s.act)
  const busy = useStudio((s) => s.busy > 0)
  const me = snapshot?.profiles.find((p) => p.id === actorId)
  const mySeat = snapshot?.slots.find((s) => s.user_id === actorId && actorId !== null)
  const [device, setDevice] = useState('')
  useEffect(() => {
    if (open) setDevice(me?.device_name ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const save = async () => {
    const name = device.trim()
    if (!DEVICE_NAME_RE.test(name)) return
    const ok = await act(async (c) => {
      await c.setMyDevice(name)
      if (mySeat && mySeat.device_name !== name) await c.setSlotDevice(mySeat.id, name)
    })
    if (ok) {
      rememberDevice(actorId, name)
      setOpen(false)
    }
  }

  return (
    <Shell open={open} onClose={() => setOpen(false)} title="Your device name" description="The Windows computer you work on (its hostname). Adobe lists seats by this name.">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="space-y-4"
      >
        <RecentDeviceChips devices={recentDevices(snapshot, actorId)} selected={device.trim() || null} onPick={setDevice} />
        <DeviceNameField value={device} onChange={setDevice} />
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="px-btn inline-flex items-center gap-2 bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {busy && <Spinner size={14} />}
            Save
          </button>
        </div>
      </form>
    </Shell>
  )
}
