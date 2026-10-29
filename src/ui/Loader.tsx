import { useStudio } from '../store/studio'

/**
 * Pixel loader: a 3x3 grid of blocks lit one after another around the ring (stepped, like a
 * game loading icon). `size` is the whole grid in px.
 */
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  // Clockwise order around the ring; the centre stays dark.
  const order = [0, 1, 2, 5, 8, 7, 6, 3]
  return (
    <span aria-hidden className={`ss-spinner inline-grid shrink-0 grid-cols-3 grid-rows-3 ${className}`} style={{ width: size, height: size, gap: Math.max(1, size / 16) }}>
      {Array.from({ length: 9 }, (_, i) => {
        const step = order.indexOf(i)
        return (
          <span
            key={i}
            className={step < 0 ? 'opacity-0' : 'ss-spinner-cell bg-current'}
            style={step < 0 ? undefined : { animationDelay: `${(step - order.length) * 100}ms` }}
          />
        )
      })}
    </span>
  )
}

/** Grass blocks hopping one after another, with shadows that shrink as they rise. */
function HoppingBlocks() {
  return (
    <span aria-hidden className="flex items-end gap-2.5">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="flex flex-col items-center" style={{ ['--d' as string]: `${i * 120}ms` }}>
          <span className="ss-hop block size-6 border-2 border-black bg-[#866043] shadow-[inset_0_7px_0_#5fa83a,inset_0_9px_0_#4a8a2c,inset_0_-3px_0_rgba(0,0,0,0.3)]" />
          <span className="ss-hop-shadow mt-1.5 block h-1 w-6 bg-black/40" />
        </span>
      ))}
    </span>
  )
}

/** Centered loader with a label, for whole pages and panels. */
export function Loader({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`grid place-items-center gap-4 p-6 text-muted ${className}`}>
      <HoppingBlocks />
      <span className="ss-dots font-pixel text-sm uppercase">{label.replace(/…$/, '')}</span>
    </div>
  )
}

/** Thin stepped bar under the header while any board action is in flight. */
export function ActivityBar() {
  const busy = useStudio((s) => s.busy > 0)
  return (
    <div aria-hidden className="relative h-1 overflow-hidden bg-black">
      {busy && <span className="ss-progress absolute inset-y-0 w-1/3 bg-accent" />}
      {busy && <span className="sr-only" role="status">Saving…</span>}
    </div>
  )
}
