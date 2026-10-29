import type { Slot, Snapshot } from '../data'
import { slotGates, nameOf, type Viewer } from '../lib/availability'
import { deriveSlotView, type SlotView } from '../lib/slotState'
import { formatClock, formatDuration } from '../lib/format'
import { STATE_COLORS } from '../lib/status'
import { useStudio } from '../store/studio'
import { Button, GateButton, Popover } from './controls'
import { PixelIcon, type IconName } from './PixelIcon'
import { UserAvatar } from './UserAvatar'

export function slotAccent(_slot: Slot, view: SlotView): string {
  if (view.kind === 'free') return STATE_COLORS.free
  if (view.kind === 'reserved') return STATE_COLORS.reserved
  if (view.kind === 'overdue') return STATE_COLORS.overdue
  return STATE_COLORS.in_use
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
  const pushToast = useStudio((s) => s.pushToast)
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
  ].filter(Boolean)

  return (
    <article
      aria-labelledby={`slot-${slot.id}-title`}
      className={`px-panel relative flex flex-col overflow-hidden p-3 ${pulse ? 'pulse' : ''} ${g.isMine ? 'border-accent' : ''}`}
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
                <UserAvatar profile={holder} size={22} className="mr-2 align-middle" />
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
        {slot.user_id && (
          <p className="mb-1 flex items-center gap-1.5">
            <span>Device</span>
            <Popover
              title="Adobe device"
              trigger={
                <button type="button" className="px-badge bg-surface-2 px-1.5 font-mono text-ink underline decoration-dotted underline-offset-2 hover:bg-accent hover:text-accent-ink">
                  {slot.device_name ?? 'unknown'}
                </button>
              }
            >
              <p>
                <strong className="font-mono">{slot.device_name ?? 'Unknown device'}</strong> is signed in to Adobe on this seat
                {holder ? (
                  <>
                    {' '}
                    for <strong>{holder.name}</strong>
                  </>
                ) : null}
                .
              </p>
              <p className="mt-2 text-xs">
                In Adobe&apos;s activated-devices list, this is the computer to sign out when the session ends.
              </p>
            </Popover>
          </p>
        )}
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
          </>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-3 pl-2">
        {!slot.user_id && (
          <GateButton gate={g.claim} variant="primary" onClick={() => openClaim(slot.id)}>
            Claim
          </GateButton>
        )}
        {g.isMine && (
          <>
            <Button
              variant="secondary"
              onClick={() =>
                void act((c) => c.releaseSlot(slot.id)).then(
                  (ok) =>
                    ok &&
                    slot.device_name &&
                    pushToast({ kind: 'info', title: `Sign out of Adobe on ${slot.device_name}`, body: 'So the seat shows as free in Adobe too.' }),
                )
              }
            >
              End session
            </Button>
            <GateButton gate={g.extend} onClick={() => void act((c) => c.extendSlot(slot.id, 30))}>
              +30 min
            </GateButton>
          </>
        )}
        {g.knock !== 'hidden' && (
          <GateButton gate={g.knock} onClick={() => void act((c) => c.knock(slot.id))}>
            <PixelIcon name="door" size={14} /> Knock
          </GateButton>
        )}
        {g.forceRelease !== 'hidden' && (
          <GateButton
            gate={g.forceRelease}
            variant="danger"
            onClick={() =>
              void act((c) => c.adminForceRelease(slot.id)).then(
                (ok) =>
                  ok &&
                  pushToast({
                    kind: 'info',
                    title: slot.device_name ? `Now sign out device ${slot.device_name} in Adobe` : 'Now sign out the device in Adobe',
                    body: "Use the Adobe account's activated-devices list so the next person can sign in.",
                  }),
              )
            }
          >
            Force end
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
            View in 3D
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
  } else if (slot.user_id) {
    icon = 'brush'
    label = view.overdue ? 'In use · overdue' : 'In use'
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
