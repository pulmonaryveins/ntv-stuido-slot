import { useEffect, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { SlotStatus } from '../data'
import { slotLabel } from '../lib/activityText'
import { CLAIM_STATUSES, DEFAULT_STATUS_FOR_ROLE, STATUS_META } from '../lib/status'
import { MINUTE, formatClock, toIso } from '../lib/format'
import { studioClient } from '../data'
import { useStudio } from '../store/studio'
import { Button } from './controls'
import { PixelIcon } from './PixelIcon'

function Shell({
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

const DURATIONS = [30, 60, 90, 120, 180, 240]

export function ClaimDialog() {
  const slotId = useStudio((s) => s.claimFor)
  const openClaim = useStudio((s) => s.openClaim)
  const close = () => openClaim(null)
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const act = useStudio((s) => s.act)
  const me = snapshot?.profiles.find((p) => p.id === actorId)
  const max = snapshot?.settings.max_session_min ?? 240

  const [status, setStatus] = useState<SlotStatus>('designing')
  const [minutes, setMinutes] = useState(60)
  useEffect(() => {
    if (slotId !== null && me) setStatus(DEFAULT_STATUS_FOR_ROLE[me.work_role])
  }, [slotId, me])

  if (!snapshot) return null
  const submit = async () => {
    if (slotId === null) return
    if (await act((c) => c.claimSlot(slotId, status, minutes))) close()
  }

  return (
    <Shell
      open={slotId !== null}
      onClose={close}
      title={`Claim ${slotLabel(snapshot, slotId)}`}
      description="Only log in to Adobe after your claim succeeds."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-4"
      >
        <fieldset>
          <legend className="text-sm font-medium">What are you working on?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {CLAIM_STATUSES.map((st) => (
              <label
                key={st}
                className="flex cursor-pointer items-center gap-2 border-[3px] border-line px-2.5 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10"
              >
                <input
                  type="radio"
                  name="claim-status"
                  value={st}
                  checked={status === st}
                  onChange={() => setStatus(st)}
                  className="accent-[var(--accent)]"
                />
                <PixelIcon name={STATUS_META[st].icon} size={16} />
                {STATUS_META[st].label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">
          How long?
          <select
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-1 block w-full border-[3px] border-line bg-surface-2 px-2.5 py-2"
          >
            {DURATIONS.filter((d) => d <= max).map((d) => (
              <option key={d} value={d}>
                {d < 60 ? `${d} min` : `${d / 60} h`} (until {formatClock(studioClient.now() + d * MINUTE)})
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <button type="submit" className="px-btn bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
            Claim slot
          </button>
        </div>
      </form>
    </Shell>
  )
}

export function RenderEtaDialog() {
  const slotId = useStudio((s) => s.renderEtaFor)
  const openRenderEta = useStudio((s) => s.openRenderEta)
  const close = () => openRenderEta(null)
  const snapshot = useStudio((s) => s.snapshot)
  const act = useStudio((s) => s.act)
  const [eta, setEta] = useState(30)

  if (!snapshot) return null
  const valid = Number.isFinite(eta) && eta >= 1 && eta <= 24 * 60
  const submit = async () => {
    if (slotId === null || !valid) return
    const at = toIso(studioClient.now() + eta * MINUTE)
    if (await act((c) => c.setStatus(slotId, 'rendering', at))) close()
  }

  return (
    <Shell
      open={slotId !== null}
      onClose={close}
      title="Start render"
      description="Rendering locks the slot: nobody can knock until it finishes."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-4"
      >
        <label className="block text-sm font-medium">
          Render ETA (minutes)
          <input
            type="number"
            min={1}
            max={1440}
            value={eta}
            onChange={(e) => setEta(Number(e.target.value))}
            aria-invalid={!valid}
            className="mt-1 block w-full border-[3px] border-line bg-surface-2 px-2.5 py-2"
          />
        </label>
        <p className="text-xs text-muted">
          {valid ? `Done around ${formatClock(studioClient.now() + eta * MINUTE)}. Status returns to Editing automatically.` : 'Enter 1 to 1440 minutes.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <button
            type="submit"
            disabled={!valid}
            className="px-btn bg-rendering px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Start render
          </button>
        </div>
      </form>
    </Shell>
  )
}
