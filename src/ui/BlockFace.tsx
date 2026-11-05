import { memo, type ReactElement } from 'react'
import type { Look } from '../lib/look'
import { outfitGrid, portraitGrid, type Grid } from '../lib/skin'

/** Merge horizontal runs of one colour into single rects (fewer SVG nodes). */
function PixelGrid({ grid }: { grid: Grid }) {
  const rects: ReactElement[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      let end = x + 1
      while (end < row.length && row[end] === c) end++
      if (c) rects.push(<rect key={`${x},${y}`} x={x} y={y} width={end - x} height={1} fill={c} />)
      x = end
    }
  })
  return <>{rects}</>
}

/**
 * Profile picture for a block character: the front of the head with hair and headwear, drawn from
 * the same pixel skin as the 3D figure (lib/skin.ts), so 2D and 3D always match.
 */
export const BlockFace = memo(function BlockFace({ look, size, className = '', background }: { look: Look; size: number; className?: string; background?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      aria-hidden
      className={`inline-block shrink-0 border-2 border-black ${className}`}
      style={{ background: background ?? look.shirt }}
    >
      <PixelGrid grid={portraitGrid(look)} />
    </svg>
  )
})

/** Front view of an outfit (arms, body, top of the legs), for the editor's outfit buttons. */
export const OutfitThumb = memo(function OutfitThumb({ look, height }: { look: Look; height: number }) {
  const g = outfitGrid(look)
  const w = g[0]!.length
  return (
    <svg width={(height * w) / g.length} height={height} viewBox={`0 0 ${w} ${g.length}`} shapeRendering="crispEdges" aria-hidden>
      <PixelGrid grid={g} />
    </svg>
  )
})
