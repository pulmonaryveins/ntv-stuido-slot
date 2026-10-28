import * as RToast from '@radix-ui/react-toast'
import { useStudio, type Toast } from '../store/studio'

const STYLE: Record<Toast['kind'], { icon: string; ring: string; duration: number }> = {
  turn: { icon: '🎟️', ring: 'border-reserved', duration: 20_000 },
  knock: { icon: '✊', ring: 'border-accent', duration: 8000 },
  ending: { icon: '⏰', ring: 'border-overdue', duration: 12_000 },
  render: { icon: '🎉', ring: 'border-rendering', duration: 8000 },
  error: { icon: '⚠️', ring: 'border-overdue', duration: 6000 },
  info: { icon: 'ℹ️', ring: 'border-line', duration: 6000 },
}

export function Toasts() {
  const toasts = useStudio((s) => s.toasts)
  const dismiss = useStudio((s) => s.dismissToast)
  const openClaim = useStudio((s) => s.openClaim)
  const act = useStudio((s) => s.act)

  return (
    <RToast.Provider swipeDirection="right">
      {toasts.map((t) => {
        const st = STYLE[t.kind]
        return (
          <RToast.Root
            key={t.id}
            duration={st.duration}
            type={t.kind === 'error' || t.kind === 'turn' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && dismiss(t.id)}
            className={`flex items-start gap-3 rounded-xl border-2 bg-surface p-3 text-ink shadow-xl ${st.ring}`}
          >
            <span aria-hidden className="text-xl leading-none">
              {st.icon}
            </span>
            <div className="min-w-0 flex-1">
              <RToast.Title className="text-sm font-semibold">{t.title}</RToast.Title>
              {t.body && <RToast.Description className="text-xs text-muted">{t.body}</RToast.Description>}
              {t.kind === 'turn' && t.slotId !== undefined && (
                <RToast.Action altText="Claim your reserved slot now" asChild>
                  <button
                    type="button"
                    onClick={() => openClaim(t.slotId!)}
                    className="mt-2 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink"
                  >
                    Claim now
                  </button>
                </RToast.Action>
              )}
              {t.kind === 'ending' && t.slotId !== undefined && (
                <RToast.Action altText="Extend your session by 30 minutes" asChild>
                  <button
                    type="button"
                    onClick={() => void act((c) => c.extendSlot(t.slotId!, 30))}
                    className="mt-2 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold"
                  >
                    +30 min
                  </button>
                </RToast.Action>
              )}
            </div>
            <RToast.Close aria-label="Dismiss" className="text-muted hover:text-ink">
              ✕
            </RToast.Close>
          </RToast.Root>
        )
      })}
      <RToast.Viewport className="fixed bottom-3 right-3 z-50 flex w-[min(92vw,360px)] flex-col gap-2 outline-none" />
    </RToast.Provider>
  )
}
