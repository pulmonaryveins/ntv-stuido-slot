import type { Slot, Snapshot } from '../data'
import { slotGates, nameOf, type Viewer } from '../lib/availability'
import { deriveSlotView, type SlotView } from '../lib/slotState'
import { formatClock, formatDuration } from '../lib/format'
import { STATE_COLORS } from '../lib/status'
import { useStudio } from '../store/studio'
import { Button, GateButton, Popover } from './controls'
import { PixelIcon } from './PixelIcon'
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

  const hold = view.kind === 'reserved' ? snapshot.profiles.find((p) => p.id === slot.hold_user_id) : null
  const end = slot.user_id ? now + view.remainingMs : null
  const endSession = () =>
    void act((c) => c.releaseSlot(slot.id)).then(
      (ok) =>
        ok &&
        slot.device_name &&
        pushToast({ kind: 'info', title: `Sign out of Adobe on ${slot.device_name}`, body: 'So the seat shows as free in Adobe too.' }),
    )
  const forceEnd = () =>
    void act((c) => c.adminForceRelease(slot.id)).then(
      (ok) =>
        ok &&
        pushToast({
          kind: 'info',
          title: slot.device_name ? `Now sign out device ${slot.device_name} in Adobe` : 'Now sign out the device in Adobe',
          body: "Use the Adobe account's activated-devices list so the next person can sign in.",
        }),
    )

  return (
    <article
      aria-labelledby={`slot-${slot.id}-title`}
      className={`px-panel flex flex-col overflow-hidden ${pulse ? 'pulse' : ''} ${g.isMine ? 'outline-2 outline-accent' : ''}`}
      style={{ ['--pulse-color' as string]: `${accent}66` }}
    >
      {/* State strip: slot number, status, and a shortcut to the seat in 3D */}
      <header className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-black" style={{ background: accent }}>
        <h3 id={`slot-${slot.id}-title`} className="text-sm normal-case">
          {heading}
        </h3>
        <StateChip slot={slot} view={view} />
        {(
          <button
            type="button"
            aria-label={`View ${heading} in the office`}
            title="View in the office"
            onClick={() => {
              setView('3d')
              focusSlot(slot.id)
            }}
            className="grid size-6 place-items-center border border-line bg-black/10 hover:bg-black/25"
          >
            <PixelIcon name="block" size={12} />
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {holder ? (
          <>
            <div className="flex items-center gap-3">
              <UserAvatar profile={holder} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {holder.name}
                  {g.isMine && <span className="ml-1.5 bg-accent px-1 font-pixel text-[10px] text-white">You</span>}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <span>PC</span>
                  <Popover
                    title="Adobe device"
                    trigger={
                      <button type="button" className="border border-line bg-white px-1 font-mono text-[11px] font-bold text-black hover:bg-accent hover:text-white">
                        {slot.device_name ?? 'unknown'}
                      </button>
                    }
                  >
                    <p>
                      <strong className="font-mono">{slot.device_name ?? 'Unknown device'}</strong> is signed in to Adobe on this seat for{' '}
                      <strong>{holder.name}</strong>.
                    </p>
                    <p className="mt-2 text-xs">In Adobe&apos;s activated-devices list, this is the computer to sign out when the session ends.</p>
                  </Popover>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className={`font-pixel text-xl tabular-nums ${view.overdue ? 'text-overdue' : 'text-ink'}`}>
                  {view.overdue ? `+${formatDuration(view.remainingMs)}` : formatDuration(view.remainingMs)}
                </span>
                <span className="text-xs text-muted">
                  {view.overdue ? 'over time' : 'left'} · until {end !== null ? formatClock(end) : '—'}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${heading} session progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(view.progress * 100)}
                className="px-bar mt-1.5"
              >
                <span style={{ width: `${Math.min(1, view.progress) * 100}%`, color: accent }} />
              </div>
              <p className="mt-1 text-[11px] text-muted">Used {formatDuration(view.elapsedMs)}</p>
            </div>
          </>
        ) : view.kind === 'reserved' ? (
          <div className="flex items-center gap-3">
            <UserAvatar profile={hold} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                Held for {nameOf(snapshot, slot.hold_user_id)}
                {slot.hold_user_id === viewer.userId && <span className="ml-1.5 bg-accent px-1 font-pixel text-[10px] text-white">You</span>}
              </p>
              <p className="text-xs text-muted">
                Next on the waiting list · {formatDuration(view.holdRemainingMs ?? 0)} to claim
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="px-btn grid size-11 place-items-center bg-surface-2">
              <PixelIcon name="block" size={22} />
            </span>
            <div>
              <p className="font-semibold">Free seat</p>
              <p className="text-xs text-muted">Available now · sign in to Adobe after you claim</p>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-1.5">
          {!slot.user_id && (
            <GateButton gate={g.claim} variant="primary" className="flex-1 py-1.5" onClick={() => openClaim(slot.id)}>
              Claim seat
            </GateButton>
          )}
          {g.isMine && (
            <>
              <Button variant="secondary" className="flex-1" onClick={endSession}>
                End session
              </Button>
              <GateButton gate={g.extend} onClick={() => void act((c) => c.extendSlot(slot.id, 30))}>
                +30 min
              </GateButton>
            </>
          )}
          {g.knock !== 'hidden' && (
            <GateButton gate={g.knock} className="flex-1" onClick={() => void act((c) => c.knock(slot.id))}>
              <PixelIcon name="door" size={14} /> Knock
            </GateButton>
          )}
          {g.forceRelease !== 'hidden' && (
            <GateButton gate={g.forceRelease} variant="danger" onClick={forceEnd}>
              Force end
            </GateButton>
          )}
        </div>
        {disabledReasons.length > 0 && <span className="sr-only">{disabledReasons.join('. ')}</span>}
      </div>
    </article>
  )
}

function StateChip({ slot, view }: { slot: Slot; view: SlotView }) {
  const label = view.kind === 'reserved' ? 'Reserved' : !slot.user_id ? 'Free' : view.overdue ? 'Over time' : 'In use'
  return <span className="font-pixel ml-auto shrink-0 text-xs">{label}</span>
}
