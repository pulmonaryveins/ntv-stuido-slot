/**
 * Studio Slots logo: a 16x16 pixel monitor whose screen shows the four shared seats as a 2x2
 * grid (free, in use, overdue, free). Same SVG-rect approach as PixelIcon; public/favicon.svg is
 * generated from these rows.
 */
export const LOGO_ROWS = [
  '.kkkkkkkkkkkkkk.',
  'kffffffffffffffk',
  'kfssssssssssssfk',
  'kfsGgggssAaaasfk',
  'kfsggggssaaaasfk',
  'kfsggggssaaaasfk',
  'kfssssssssssssfk',
  'kfsRrrrssGgggsfk',
  'kfsrrrrssggggsfk',
  'kfsrrrrssggggsfk',
  'kfssssssssssssfk',
  'kffffffffffffffk',
  '.kkkkkkkkkkkkkk.',
  '......kwwk......',
  '....kkwwwwkk....',
  '....kkkkkkkk....',
]

export const LOGO_PALETTE: Record<string, string> = {
  k: '#1f1913',
  f: '#4a5366',
  s: '#142030',
  g: '#4caf7a',
  G: '#8fe0ac',
  a: '#e9b44c',
  A: '#ffd98a',
  r: '#e05a4a',
  R: '#ff8f7f',
  w: '#b9c2cc',
}

export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  const rects: React.ReactElement[] = []
  LOGO_ROWS.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      const color = LOGO_PALETTE[ch]
      if (!color) {
        x++
        continue
      }
      let w = 1
      while (row[x + w] === ch) w++
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={color} />)
      x += w
    }
  })
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" className={`inline-block shrink-0 ${className ?? ''}`} aria-hidden>
      {rects}
    </svg>
  )
}
