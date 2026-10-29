/**
 * Original 12x12 pixel-art icons (creative studio theme). Each icon is a list of rows; every
 * character maps to a colour in its palette, '.' is transparent. Rendered as crisp SVG rects.
 */
const OUTLINE = '#1f1913'

type IconDef = { rows: string[]; pal: Record<string, string> }

const ICONS = {
  // designing: paintbrush
  brush: {
    rows: [
      '..........kk',
      '.........kyk',
      '........kyyk',
      '.......kyyk.',
      '......kyyk..',
      '.....kssk...',
      '....kssk....',
      '...kcck.....',
      '..kccck.....',
      '.kccck......',
      'kccck.......',
      'kkkk........',
    ],
    pal: { y: '#e9b44c', s: '#b9c2cc', c: '#ec7a5c' },
  },
  // editing: film clapperboard
  clapper: {
    rows: [
      '............',
      'kkkkkkkkkkkk',
      'kwkkwkkwkkwk',
      'kkkkkkkkkkkk',
      'kbbbbbbbbbbk',
      'kbbwwwwwbbbk',
      'kbbbbbbbbbbk',
      'kbbwwwbbbbbk',
      'kbbbbbbbbbbk',
      'kbbwwwwbbbbk',
      'kkkkkkkkkkkk',
    ],
    pal: { w: '#f3ece1', b: '#3c4a63' },
  },
  // color grading: painter's palette
  palette: {
    rows: [
      '...kkkkkk...',
      '..kppppppk..',
      '.kprppppbpk.',
      'kppppppppppk',
      'kpyppppkkppk',
      'kppppppk.kpk',
      'kpgppppk.kpk',
      'kppppppkkppk',
      '.kpppmpppppk',
      '..kppppppkk.',
      '...kkkkkk...',
    ],
    pal: { p: '#e8cfa0', r: '#e04848', b: '#4a7be0', y: '#f2c230', g: '#4fb04a', m: '#c75b9b' },
  },
  // motion: sparkles
  sparkle: {
    rows: [
      '....k.......',
      '...kyk......',
      '...kyk......',
      '.kkyyykk....',
      'kyyywyyyk...',
      '.kkyyykk....',
      '...kyk...k..',
      '...kyk..kyk.',
      '....k..kyyyk',
      '........kyk.',
      '.........k..',
    ],
    pal: { y: '#f5d24a', w: '#ffffff' },
  },
  // rendering: hourglass
  hourglass: {
    rows: [
      '.kkkkkkkkkk.',
      '.kffffffffk.',
      '..kssssssk..',
      '...kssssk...',
      '....kssk....',
      '.....kk.....',
      '....k.sk....',
      '...k..s.k...',
      '..k.ssss.k..',
      '.kffffffffk.',
      '.kkkkkkkkkk.',
    ],
    pal: { f: '#b88c5f', s: '#2bb3a3' },
  },
  // break: coffee mug
  mug: {
    rows: [
      '..s.s.......',
      '...s.s......',
      '..s.s.......',
      'kkkkkkkk....',
      'kbbbbbbbkkk.',
      'kcccccck.k..',
      'kcccccckk.k.',
      'kcccccckkkk.',
      'kcccccck....',
      '.kcccck.....',
      '..kkkk......',
    ],
    pal: { s: '#9aa3ad', b: '#6b4423', c: '#ec7a5c' },
  },
  // free: a fresh grass-topped block
  block: {
    rows: [
      '.kkkkkkkkkk.',
      '.kggggggggk.',
      '.kgGggGgggk.',
      '.kGGGGGGGGk.',
      '.kddDdddDdk.',
      '.kdddddddDk.',
      '.kdDddddddk.',
      '.kddddDdddk.',
      '.kdddddddDk.',
      '.kDdddDdddk.',
      '.kkkkkkkkkk.',
    ],
    pal: { g: '#6cc04a', G: '#4f9a37', d: '#9b6b43', D: '#7a5232' },
  },
  // reserved: ticket
  ticket: {
    rows: [
      '............',
      '.kkkkkkkkkk.',
      'kyyykyyyyyyk',
      'kyyy.yrryyyk',
      '.yyykyrryyy.',
      '.yyy.yyyyyy.',
      'kyyykyrryyyk',
      'kyyy.yrryyyk',
      '.kkkkkkkkkk.',
    ],
    pal: { y: '#f2c230', r: '#e07a2c' },
  },
  // knock: door with knock marks
  door: {
    rows: [
      '..kkkkkkkk..',
      '..kddDddDk..',
      '..kddDddDk.k',
      '..kddDddDk..',
      '..kddDddDk.k',
      '..kddDdyDk..',
      '..kddDddDk..',
      '..kddDddDk..',
      '..kddDddDk..',
      '..kddDddDk..',
      '..kkkkkkkk..',
    ],
    pal: { d: '#c98e55', D: '#9c6a3c', y: '#f2c230' },
  },
  clock: {
    rows: [
      '...kkkkkk...',
      '..kwwwwwwk..',
      '.kwwwkwwwwk.',
      '.kwwwkwwwwk.',
      '.kwwwkwwwwk.',
      '.kwwwkkkwwk.',
      '.kwwwwwwwwk.',
      '.kwwwwwwwwk.',
      '..kwwwwwwk..',
      '...kkkkkk...',
    ],
    pal: { w: '#fff4de' },
  },
  warn: {
    rows: [
      '.kkkkkkkkkk.',
      '.krrrrrrrrk.',
      '.krrrwwrrrk.',
      '.krrrwwrrrk.',
      '.krrrwwrrrk.',
      '.krrrwwrrrk.',
      '.krrrrrrrrk.',
      '.krrrwwrrrk.',
      '.krrrrrrrrk.',
      '.kkkkkkkkkk.',
    ],
    pal: { r: '#e0524f', w: '#ffffff' },
  },
  user: {
    rows: [
      '....kkkk....',
      '...kssssk...',
      '...kskskk...',
      '...kssssk...',
      '....kkkk....',
      '..kkcccckk..',
      '.kcccccccck.',
      '.kcccccccck.',
      '.kcccccccck.',
      '.kkkkkkkkkk.',
    ],
    pal: { s: '#f2c7a5', c: '#4a7be0' },
  },
  list: {
    rows: [
      '............',
      'kkk.kkkkkkkk',
      'kgk.kwwwwwwk',
      'kkk.kkkkkkkk',
      '............',
      'kkk.kkkkkkkk',
      'kgk.kwwwwwwk',
      'kkk.kkkkkkkk',
      '............',
      'kkk.kkkkkkkk',
      'kgk.kwwwwwwk',
      'kkk.kkkkkkkk',
    ],
    pal: { g: '#6cc349', w: '#f1e7cf' },
  },
  mail: {
    rows: [
      '............',
      '............',
      'kkkkkkkkkkkk',
      'kwwkwwwwkwwk',
      'kwwwkwwkwwwk',
      'kwwwwkkwwwwk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwwwk',
      'kkkkkkkkkkkk',
      '............',
      '............',
    ],
    pal: { w: '#f1e7cf' },
  },
  key: {
    rows: [
      '............',
      '.kkkk.......',
      'kyyyyk......',
      'kykkyk......',
      'kykkykkkkkkk',
      'kyyyyyyyyyyk',
      '.kkkkkkykyyk',
      '.......kkkkk',
      '............',
      '............',
      '............',
      '............',
    ],
    pal: { y: '#e9b44c' },
  },
  shield: {
    rows: [
      '.kkkkkkkkkk.',
      '.kbbbbbbbbk.',
      '.kbbbwwbbbk.',
      '.kbbwwwwbbk.',
      '.kbbbwwbbbk.',
      '..kbbbbbbk..',
      '...kbbbbk...',
      '....kbbk....',
      '.....kk.....',
    ],
    pal: { b: '#4a7be0', w: '#ffffff' },
  },
  sun: {
    rows: [
      '.....y......',
      '..y..y..y...',
      '...y...y....',
      '....yyy.....',
      'yy.yyyyy.yy.',
      '....yyy.....',
      '...y...y....',
      '..y..y..y...',
      '.....y......',
    ],
    pal: { y: '#f5b82e' },
  },
  moon: {
    rows: [
      '....kkkk....',
      '...kmmmk....',
      '..kmmmk.....',
      '.kmmmk......',
      '.kmmmk......',
      '.kmmmk......',
      '.kmmmmk.....',
      '..kmmmmkkk..',
      '...kmmmmmk..',
      '....kkkkk...',
    ],
    pal: { m: '#e6e2c8' },
  },
  check: {
    rows: [
      '............',
      '..........kk',
      '.........kgk',
      '........kggk',
      'kk.....kggk.',
      'kgk...kggk..',
      'kggk.kggk...',
      '.kggkggk....',
      '..kgggk.....',
      '...kgk......',
      '....k.......',
    ],
    pal: { g: '#6cc04a' },
  },
} satisfies Record<string, IconDef>

export type IconName = keyof typeof ICONS

export function PixelIcon({ name, size = 16, title, className }: { name: IconName; size?: number; title?: string; className?: string }) {
  const icon: IconDef = ICONS[name]
  const rects: React.ReactElement[] = []
  icon.rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      const color = ch === 'k' ? OUTLINE : icon.pal[ch]
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
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`inline-block shrink-0 ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {rects}
    </svg>
  )
}
