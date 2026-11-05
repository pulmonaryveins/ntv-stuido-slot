import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type CSSProperties } from 'react'
import { CHANGELOG, markChangelogSeen, seenChangelog, unseenEntries } from '../data/changelog'
import { useStudio } from '../store/studio'
import { Button } from './controls'
import { PixelIcon } from './PixelIcon'

const rise = (i: number): CSSProperties => ({ ['--d' as string]: `${80 + i * 45}ms` })

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** True while another dialog is up, so the update log never stacks on top of one. */
function useOtherModalOpen() {
  return useStudio((s) => s.slotModalId !== null || s.claimFor !== null || s.profileModalId !== null || s.customizeOpen || s.deviceDialog)
}

/**
 * "What's new" update log. Opens by itself shortly after sign-in when there are entries this
 * user has not seen (in this browser), once no other dialog is open; also from the account menu.
 */
export function WhatsNew() {
  const open = useStudio((s) => s.whatsNewOpen)
  const setOpen = useStudio((s) => s.openWhatsNew)
  const actorId = useStudio((s) => s.actorId)
  const loaded = useStudio((s) => !!s.snapshot)
  const busy = useOtherModalOpen()
  // What was new when the log opened: stays highlighted while it is open, even once marked seen.
  const [seenAtOpen, setSeenAtOpen] = useState('')

  useEffect(() => {
    if (!actorId || !loaded || open || busy || !unseenEntries(seenChangelog(actorId)).length) return
    // Give the board a moment to appear first.
    const t = window.setTimeout(() => setOpen(true), 900)
    return () => window.clearTimeout(t)
  }, [actorId, loaded, open, busy, setOpen])

  useEffect(() => {
    if (open && actorId) setSeenAtOpen(seenChangelog(actorId))
  }, [open, actorId])

  const close = () => {
    if (actorId) markChangelogSeen(actorId)
    setOpen(false)
  }
  const fresh = new Set(unseenEntries(seenAtOpen).map((e) => e.id))

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="ss-overlay fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="ss-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(94vw,480px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden px-panel p-0 text-ink shadow-[inset_0_2px_0_var(--hi),6px_6px_0_rgba(0,0,0,0.35)]">
          <div className="ss-banner relative shrink-0 border-b-2 border-line bg-accent px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center border-2 border-black bg-black/30 shadow-[inset_0_-3px_0_rgba(0,0,0,0.3)]">
                <PixelIcon name="sparkle" size={26} anim="twinkle" />
              </span>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-lg leading-tight">What's new</Dialog.Title>
                <Dialog.Description className="text-xs text-white/85">Latest updates to Studio Slots.</Dialog.Description>
              </div>
              <Dialog.Close className="px-btn grid size-8 shrink-0 place-items-center bg-surface-2" aria-label="Close">
                <PixelIcon name="close" size={12} />
              </Dialog.Close>
            </div>
          </div>

          <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {CHANGELOG.map((entry, i) => {
              const isNew = fresh.has(entry.id)
              return (
                <li key={entry.id} className="ss-rise" style={rise(i)}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm">{entry.title}</h3>
                    {isNew && <span className="ss-badge font-pixel border-2 border-black bg-reserved px-1.5 text-[10px] uppercase text-black">New</span>}
                    <time dateTime={entry.date} className="ml-auto text-xs text-muted">
                      {formatDate(entry.date)}
                    </time>
                  </div>
                  <ul className={`space-y-1.5 border-2 p-2.5 ${isNew ? 'border-accent bg-surface-2' : 'border-line'}`}>
                    {entry.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm leading-snug">
                        <PixelIcon name={item.icon} size={16} className="mt-0.5" />
                        <span className="min-w-0 flex-1">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ol>

          <div className="flex shrink-0 justify-end border-t-2 border-line p-3">
            <Button variant="primary" onClick={close}>
              <PixelIcon name="check" size={14} />
              Got it
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Unseen updates exist for the current user (for the account menu dot). */
export function useHasUnseenUpdates(): boolean {
  const actorId = useStudio((s) => s.actorId)
  const open = useStudio((s) => s.whatsNewOpen)
  // Re-read after the log closes (it marks entries seen).
  const [, bump] = useState(0)
  useEffect(() => {
    if (!open) bump((n) => n + 1)
  }, [open])
  return !!actorId && unseenEntries(seenChangelog(actorId)).length > 0
}
