import * as Select from '@radix-ui/react-select'
import type { Slot, SlotStatus, Snapshot } from '../data'
import { slotGates, nameOf, type Viewer } from '../lib/availability'
import { deriveSlotView, type SlotView } from '../lib/slotState'
import { formatClock, formatDuration } from '../lib/format'
import { SELECTABLE_STATUSES, STATE_COLORS, STATUS_META } from '../lib/status'
import { useStudio } from '../store/studio'
import { Button, GateButton } from './controls'
import { PixelIcon, type IconName } from './PixelIcon'

export function slotAccent(slot: Slot, view: SlotView): string {
  if (view.kind === 'free') return STATE_COLORS.free
  if (view.kind === 'reserved') return STATE_COLORS.reserved
  if (view.kind === 'overdue') return STATE_COLORS.overdue
  if (view.kind === 'rendering') return STATE_COLORS.rendering
  return slot.status ? STATUS_META[slot.status].color : STATE_COLORS.free
}

export function SlotCard({
  slot,
  snapshot,
  viewer,
  now,
}: {
  slot: Slot
  snapshot: Snapshot
  viewer: Viewer
  now: number
}) {
  const act = useStudio((s) => s.act)
  const openClaim = useStudio((s) => s.openClaim)
  const openRenderEta = useStudio((s) => s.openRenderEta)
  const focusSlot = useStudio((s) => s.focusSlot)
  const setView = useStudio((s) => s.setView)
  const webgl = useStudio((s) => s.webgl)

  const view = deriveSlotView(slot, now)
  const g = slotGates(slot, viewer, snapshot, now)
  const accent = slotAccent(slot, view)
  const holder = slot.user_id ? snapshot.profiles.find((p) => p.id === slot.user_id) : null
  const pulse = view.kind === 'rendering' || view.kind === 'reserved'
  const heading = `Slot ${slot.slot_number}`

  const disabledReasons = [
    !g.isMine && !slot.user_id && g.claim ? `Claim: ${g.claim}` : null,
    g.knock !== 'hidden' && g.knock ? `Knock: ${g.knock}` : null,
    g.isMine && g.startBreak && slot.status === 'rendering' ? `Break: ${g.startBreak}` : null,
    g.isMine && g.status ? `Status: ${g.status}` : null,
  ].filter(Boolean)

  const onStatus = (v: string) => {
    const status = v as SlotStatus
    if (status === 'rendering') openRenderEta(slot.id)
    else void act((c) => c.setStatus(slot.id, status))
  }

  return (
    <article
      aria-labelledby={`slot-${slot.id}-title`}
      className={`px-panel relative overflow-hidden p-3 ${pulse ? 'pulse' : ''} ${g.isMine ? 'border-accent' : ''}`}
      style={{ ['--pulse-color' as string]: `${accent}66` }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-2 border-r-[3px] border-line" style={{ background: accent }} />
      <div className="flex items-start gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <h3 id={`slot-${slot.id}-title`} className="text-xs font-semibold uppercase tracking-wide text-muted">
            {heading}
          </h3>
          <p className="truncate text-sm font-semibold">
            {holder ? (
              <>
                <span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-full align-middle" style={{ background: holder.avatar_color }} />
                {holder.name}
                {g.isMine && <span className="ml-1 font-normal text-accent">(you)</span>}
              </>
            ) : view.kind === 'reserved' ? (
              <>
                Reserved for {nameOf(snapshot, slot.hold_user_id)}
                {slot.hold_user_id === viewer.userId && <span className="ml-1 font-normal text-accent">(you)</span>}
              </>
            ) : (
              'Free'
            )}
          </p>
        </div>
        <StateChip slot={slot} view={view} accent={accent} />
      </div>

      <div className="mt-2 pl-2 text-xs text-muted">
        {view.kind === 'free' && <p>Available now</p>}
        {view.kind === 'reserved' && view.holdRemainingMs !== null && (
          <p>
            Hold expires in <strong className="text-ink">{formatDuration(view.holdRemainingMs)}</strong>
          </p>
        )}
        {slot.user_id && (
          <>
            <div className="flex justify-between gap-2">
              <span>Used {formatDuration(view.elapsedMs)}</span>
              <span className={view.overdue ? 'font-semibold text-overdue' : ''}>
                {view.overdue
                  ? `Over by ${formatDuration(view.remainingMs)}`
                  : `${formatDuration(view.remainingMs)} left · until ${formatClock(now + view.remainingMs)}`}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${heading} session progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(view.progress * 100)}
              className="px-bar mt-1"
            >
              <span style={{ width: `${view.progress * 100}%`, color: accent }} />
            </div>
            {view.kind === 'rendering' && view.renderRemainingMs !== null && (
              <p className="mt-1 text-rendering">
                Render lock · ETA {formatDuration(view.renderRemainingMs)} ({formatClock(now + view.renderRemainingMs)})
              </p>
            )}
            {slot.status === 'break' && view.breakRemainingMs !== null && (
              <p className={`mt-1 ${view.breakRemainingMs < 0 ? 'text-overdue' : ''}`}>
                {view.breakRemainingMs >= 0
                  ? `Break: seat held ${formatDuration(view.breakRemainingMs)} more`
                  : `Break over by ${formatDuration(view.breakRemainingMs)}`}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 pl-2">
        {!slot.user_id && (
          <GateButton gate={g.claim} variant="primary" onClick={() => openClaim(slot.id)}>
            Claim
          </GateButton>
        )}
        {g.isMine && (
          <>
            <Button variant="secondary" onClick={() => void act((c) => c.releaseSlot(slot.id))}>
              Release
            </Button>
            <GateButton gate={g.extend} onClick={() => void act((c) => c.extendSlot(slot.id, 30))}>
              +30 min
            </GateButton>
            <StatusSelect slot={slot} disabledReason={g.status} onChange={onStatus} />
            {slot.status === 'break' ? (
              <GateButton gate={g.endBreak} onClick={() => void act((c) => c.endBreak(slot.id))}>
                Back
              </GateButton>
            ) : (
              <GateButton gate={g.startBreak} onClick={() => void act((c) => c.startBreak(slot.id))}>
                <PixelIcon name="mug" size={14} /> Break
              </GateButton>
            )}
          </>
        )}
        {g.knock !== 'hidden' && (
          <GateButton gate={g.knock} onClick={() => void act((c) => c.knock(slot.id))}>
            <PixelIcon name="door" size={14} /> Knock
          </GateButton>
        )}
        {g.forceRelease !== 'hidden' && (
          <GateButton gate={g.forceRelease} variant="danger" onClick={() => void act((c) => c.adminForceRelease(slot.id))}>
            Force release
          </GateButton>
        )}
        {webgl && (
          <Button
            variant="ghost"
            aria-label={`View ${heading} in 3D`}
            onClick={() => {
              setView('3d')
              focusSlot(slot.id)
            }}
          >
            View
          </Button>
        )}
      </div>

      {disabledReasons.length > 0 && (
        <ul className="mt-2 space-y-0.5 pl-2 text-[11px] text-muted" aria-hidden>
          {disabledReasons.map((r) => (
            <li key={r}>⦸ {r}</li>
          ))}
        </ul>
      )}
    </article>
  )
}

function StateChip({ slot, view, accent }: { slot: Slot; view: SlotView; accent: string }) {
  let icon: IconName = 'block'
  let label = 'Free'
  if (view.kind === 'reserved') {
    icon = 'ticket'
    label = 'Reserved'
  } else if (slot.status) {
    icon = STATUS_META[slot.status].icon
    label = STATUS_META[slot.status].label
    if (view.overdue && slot.status !== 'rendering') label = `${label} · overdue`
  }
  return (
    <span
      className="font-pixel inline-flex shrink-0 items-center gap-1 border-2 border-line px-1.5 py-0.5 text-xs font-semibold uppercase text-ink"
      style={{ background: `${accent}40` }}
    >
      <PixelIcon name={icon} size={14} />
      {label}
    </span>
  )
}

function StatusSelect({
  slot,
  disabledReason,
  onChange,
}: {
  slot: Slot
  disabledReason: string | null
  onChange: (v: string) => void
}) {
  const current = slot.status === 'break' ? undefined : (slot.status ?? undefined)
  return (
    <Select.Root value={current} onValueChange={onChange} disabled={!!disabledReason}>
      <Select.Trigger
        aria-label={disabledReason ? `Change status (unavailable: ${disabledReason})` : 'Change status'}
        title={disabledReason ?? undefined}
        className="inline-flex items-center gap-1 border-[3px] border-line bg-surface-2 px-2.5 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Select.Value placeholder="Status" />
        <span aria-hidden>▾</span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={4} className="z-50 overflow-hidden px-panel">
          <Select.Viewport className="p-1">
            {SELECTABLE_STATUSES.map((st) => (
              <Select.Item
                key={st}
                value={st}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-2"
              >
                <PixelIcon name={STATUS_META[st].icon} size={14} />
                <Select.ItemText>{STATUS_META[st].label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
