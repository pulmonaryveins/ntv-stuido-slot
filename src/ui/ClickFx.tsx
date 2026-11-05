import { useEffect } from 'react'

const DIRS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const

/**
 * Pixel burst under the mouse on every click (mouse only; touch and pen get nothing).
 * Plain DOM, no React state: each burst removes itself when its animation ends.
 * Hidden by CSS under prefers-reduced-motion.
 */
export function ClickFx() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      const fx = document.createElement('div')
      fx.className = 'ss-click'
      fx.setAttribute('aria-hidden', 'true')
      fx.style.left = `${e.clientX}px`
      fx.style.top = `${e.clientY}px`
      for (const [dx, dy] of DIRS) {
        const px = document.createElement('i')
        px.style.setProperty('--x', `${dx * 12}px`)
        px.style.setProperty('--y', `${dy * 12}px`)
        fx.appendChild(px)
      }
      document.body.appendChild(fx)
      // animationend can be skipped (reduced motion hides the burst), so also time out.
      const done = () => fx.remove()
      fx.lastElementChild?.addEventListener('animationend', done, { once: true })
      window.setTimeout(done, 600)
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])
  return null
}
