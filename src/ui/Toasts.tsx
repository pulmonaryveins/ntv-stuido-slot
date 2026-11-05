import * as RToast from '@radix-ui/react-toast'
import type { CSSProperties } from 'react'
import { useStudio, type Toast } from '../store/studio'
import { PixelIcon, type IconAnim, type IconName } from './PixelIcon'

interface Kind {
  icon: IconName
  anim: IconAnim
  /** Accent colour: icon tile, side stripe and countdown bar. */
  tone: string
  /** Small label over the title. */
  label: string
  duration: number
}

const KIND: Record<Toast['kind'], Kind> = {
  turn: { icon: 'bell', anim: 'ring', tone: '#e2b33c', label: 'Your turn', duration: 20_000 },
  knock: { icon: 'door', anim: 'shake', tone: '#6cc349', label: 'Knock knock', duration: 8000 },
  ending: { icon: 'clock', anim: 'shake', tone: '#e0524f', label: 'Time check', duration: 12_000 },
  render: { icon: 'sparkle', anim: 'twinkle', tone: '#2bb3a3', label: 'Render done', duration: 8000 },
  error: { icon: 'warn', anim: 'shake', tone: '#e0524f', label: 'Oops', duration: 6000 },
  info: { icon: 'check', anim: 'pop', tone: '#5b8def', label: 'Done', duration: 6000 },
}

/**
 * Notifications. Bottom-right above the footer and above every dialog and 3D overlay, so they
 * are never hidden. Each slides in, shows a countdown bar (paused on hover/focus, like the timer),
 * and can be swiped right or closed.
 */
export function Toasts() {
  const toasts = useStudio((s) => s.toasts)
  const dismiss = useStudio((s) => s.dismissToast)
  const openClaim = useStudio((s) => s.openClaim)
  const act = useStudio((s) => s.act)

  return (
    <RToast.Provider swipeDirection="right" label="Notifications">
      {toasts.map((t) => {
        const k = KIND[t.kind]
        return (
          <RToast.Root
            key={t.id}
            duration={k.duration}
            type={t.kind === 'error' || t.kind === 'turn' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && dismiss(t.id)}
            className="ss-toast on-dark relative overflow-hidden border-2 border-black bg-surface text-ink shadow-[inset_0_2px_0_var(--hi),5px_5px_0_rgba(0,0,0,0.4)]"
            style={{ ['--tone' as string]: k.tone, ['--dur' as string]: `${k.duration}ms` } as CSSProperties}
          >
            {/* side stripe */}
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[var(--tone)]" />
            <div className="flex items-start gap-3 py-3 pl-4 pr-2.5">
              <span
                aria-hidden
                className="grid size-11 shrink-0 place-items-center border-2 border-black bg-[var(--tone)] shadow-[inset_0_-4px_0_rgba(0,0,0,0.3),inset_0_2px_0_rgba(255,255,255,0.35)]"
              >
                <PixelIcon name={k.icon} size={26} anim={k.anim} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="font-pixel text-[10px] uppercase leading-none text-[var(--tone)]">{k.label}</div>
                <RToast.Title className="mt-1 text-sm font-semibold leading-snug text-white">{t.title}</RToast.Title>
                {t.body && <RToast.Description className="mt-0.5 text-xs leading-snug text-muted">{t.body}</RToast.Description>}
                {t.kind === 'turn' && t.slotId !== undefined && (
                  <RToast.Action altText="Claim your reserved slot now" asChild>
                    <button type="button" onClick={() => openClaim(t.slotId!)} className="px-btn mt-2 bg-accent px-3 py-1 text-xs text-accent-ink">
                      Claim now
                    </button>
                  </RToast.Action>
                )}
                {t.kind === 'ending' && t.slotId !== undefined && (
                  <RToast.Action altText="Extend your session by 30 minutes" asChild>
                    <button type="button" onClick={() => void act((c) => c.extendSlot(t.slotId!, 30))} className="px-btn mt-2 bg-surface-2 px-3 py-1 text-xs">
                      +30 min
                    </button>
                  </RToast.Action>
                )}
              </div>
              <RToast.Close aria-label="Dismiss" className="px-btn grid size-7 shrink-0 place-items-center bg-surface-2">
                <PixelIcon name="close" size={12} />
              </RToast.Close>
            </div>
            {/* countdown */}
            <span aria-hidden className="block h-1 bg-black/40">
              <span className="ss-toast-timer block h-full bg-[var(--tone)]" />
            </span>
          </RToast.Root>
        )
      })}
      <RToast.Viewport className="ss-toasts fixed bottom-10 right-3 z-[70] flex w-[min(calc(100vw-1.5rem),380px)] flex-col gap-2 outline-none max-sm:left-3 max-sm:w-auto" />
    </RToast.Provider>
  )
}
