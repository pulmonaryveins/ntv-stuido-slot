import type { ReactElement } from 'react'

/**
 * Original 12x12 pixel-art icons (block-game style, creative-studio theme). Every icon is exactly
 * 12 rows of 12 characters; each character is a palette colour, 'k' is the shared outline and '.'
 * is transparent. Light-fill icons keep the outline so they read on light and dark backgrounds.
 * Rendered as crisp SVG rects (runs of one colour are merged).
 */
const OUTLINE = '#1f1913'

type IconDef = { rows: string[]; pal: Record<string, string> }

const ICONS = {
  // designing: paintbrush
  brush: {
    rows: [
      '..........kk',
      '.........khk',
      '........kyyk',
      '.......kyyk.',
      '......kyyk..',
      '.....kssk...',
      '....kssk....',
      '...kcck.....',
      '..kcCck.....',
      '.kcCck......',
      '.kcck.......',
      '..kk........',
    ],
    pal: { h: '#f6d58a', y: '#e9b44c', s: '#c9d1d9', c: '#ec7a5c', C: '#c4553b' },
  },
  // editing: film clapperboard
  clapper: {
    rows: [
      '.kkkkkkkkkk.',
      'kwwkkwwkkwwk',
      'kkkkkkkkkkkk',
      'kbbbbbbbbbbk',
      'kbbbbbbbbbbk',
      'kbwwwwbbbbbk',
      'kbbbbbbbbbbk',
      'kbwwwwwwbbbk',
      'kbbbbbbbbbbk',
      'kBBBBBBBBBBk',
      'kkkkkkkkkkkk',
      '............',
    ],
    pal: { w: '#f3ece1', b: '#3c4a63', B: '#2a3446' },
  },
  // color grading: painter's palette
  palette: {
    rows: [
      '............',
      '...kkkkkk...',
      '.kkpppppphk.',
      'kpprppppbphk',
      'kpppppppppPk',
      'kpyppkkppppk',
      'kppppk.kpppk',
      'kpgppkkkpppk',
      'kpppppppppPk',
      '.kpppmpppPk.',
      '..kPPPPPPk..',
      '...kkkkkk...',
    ],
    pal: { p: '#e8cfa0', h: '#fbecc9', P: '#c9a874', r: '#e04848', b: '#4a7be0', y: '#f2c230', g: '#4fb04a', m: '#c75b9b' },
  },
  // motion: sparkles
  sparkle: {
    rows: [
      '.....k......',
      '....kyk.....',
      '.kkkkykkkk..',
      'kyyyywyyyyk.',
      '.kkkkykkkk..',
      '....kyk.....',
      '.....k......',
      '.........k..',
      '........kyk.',
      '.......kywyk',
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
      '..kwsssssk..',
      '..kssssssk..',
      '...kssssk...',
      '....kssk....',
      '....k.sk....',
      '...k..s.k...',
      '..k.ssss.k..',
      '..kssssssk..',
      '.kffffffffk.',
      '.kkkkkkkkkk.',
    ],
    pal: { f: '#b88c5f', s: '#2bb3a3', w: '#bff3ec' },
  },
  // break: coffee mug
  mug: {
    rows: [
      '...s..s.....',
      '....s..s....',
      '...s..s.....',
      '.kkkkkkkk...',
      '.kbbbbbbkkk.',
      '.khccccck.k.',
      '.khccccck.k.',
      '.khccccckkk.',
      '.khccccck...',
      '.kCccccCk...',
      '..kkkkkk....',
      '............',
    ],
    pal: { s: '#c7ced6', b: '#6b4423', c: '#ec7a5c', h: '#f6a58c', C: '#c4553b' },
  },
  // free: a grass-topped block
  block: {
    rows: [
      '.kkkkkkkkkk.',
      '.khggggggGk.',
      '.kgGggGgggk.',
      '.kGGGGGGGGk.',
      '.kddDdddDdk.',
      '.kdddddddDk.',
      '.kdDddddddk.',
      '.kddddDdddk.',
      '.kdddddddDk.',
      '.kDdddDdddk.',
      '.kkkkkkkkkk.',
      '............',
    ],
    pal: { h: '#9be070', g: '#6cc04a', G: '#4f9a37', d: '#9b6b43', D: '#7a5232' },
  },
  // reserved: ticket
  ticket: {
    rows: [
      '............',
      '............',
      '.kkkkkkkkkk.',
      'khhhhhkhhhhk',
      'kyrryy.yyyyk',
      '.kyyyykyyyk.',
      '.kyrry.yyyk.',
      'kyyyyykyyyyk',
      'kYYYYY.YYYYk',
      '.kkkkkkkkkk.',
      '............',
      '............',
    ],
    pal: { y: '#f2c230', h: '#f9dc72', Y: '#d29a1f', r: '#e07a2c' },
  },
  // knock: door with knock marks
  door: {
    rows: [
      '..kkkkkkkk..',
      '..khddddDk..',
      '..khPPPPDk..',
      '..khPddPDk.k',
      '..khPPPPDk..',
      '..khddddDk.k',
      '..khddydDk..',
      '..khPPPPDk..',
      '..khPddPDk..',
      '..khPPPPDk..',
      '..khddddDk..',
      '..kkkkkkkk..',
    ],
    pal: { d: '#c98e55', h: '#e0ac74', D: '#9c6a3c', P: '#b07a45', y: '#f2c230' },
  },
  clock: {
    rows: [
      '...kkkkkk...',
      '..kwwwwwwk..',
      '.kwwwkwwwwk.',
      'kwwwwkwwwwwk',
      'kwwwwkwwwwwk',
      'kwwwwrkkkwwk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwwwk',
      'kWwwwwwwwwWk',
      '.kWwwwwwwWk.',
      '..kWWWWWWk..',
      '...kkkkkk...',
    ],
    pal: { w: '#fff4de', W: '#e5d6b8', r: '#e0524f' },
  },
  // warning triangle
  warn: {
    rows: [
      '.....kk.....',
      '....kyyk....',
      '....kyyk....',
      '...kyyyyk...',
      '...kykkyk...',
      '..kyykkyyk..',
      '..kyykkyyk..',
      '.kyyyyyyyyk.',
      '.kyyykkyyyk.',
      'kYYYYkkYYYYk',
      'kkkkkkkkkkkk',
      '............',
    ],
    pal: { y: '#f5c542', Y: '#d99a1e' },
  },
  // a block person
  user: {
    rows: [
      '...kkkkkk...',
      '...kHHHHk...',
      '...kHssHk...',
      '...kessek...',
      '...kssssk...',
      '...kkkkkk...',
      '..kcccccck..',
      '.kcccccccck.',
      '.kcccccccck.',
      '.kCCCCCCCCk.',
      '.kkkkkkkkkk.',
      '............',
    ],
    pal: { H: '#3a2a22', s: '#f2c7a5', e: '#1e1e1f', c: '#4a7be0', C: '#3560b8' },
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
      'kWkwwwwwwkWk',
      'kwwkwwwwkwwk',
      'kwwwkwwkwwwk',
      'kwwwwkkwwwwk',
      'kwwwwwwwwwwk',
      'kwwwwwwwwwwk',
      'kWWWWWWWWWWk',
      'kkkkkkkkkkkk',
      '............',
    ],
    pal: { w: '#f1e7cf', W: '#d6c9a8' },
  },
  key: {
    rows: [
      '............',
      '............',
      '............',
      '.kkkk.......',
      'khhyykkkkkk.',
      'ky..yyyyyyyk',
      'ky..ykkykkyk',
      'kyyyyk.k..k.',
      '.kkkk.......',
      '............',
      '............',
      '............',
    ],
    pal: { y: '#e9b44c', h: '#f6d58a' },
  },
  shield: {
    rows: [
      '............',
      '.kkkkkkkkkk.',
      '.khbbbbbbBk.',
      '.khbbwwbbBk.',
      '.khbwwwwbBk.',
      '.khbbwwbbBk.',
      '.khbbwwbbBk.',
      '..khbbbbBk..',
      '...kbbbBk...',
      '....kbBk....',
      '.....kk.....',
      '............',
    ],
    pal: { b: '#4a7be0', h: '#7fa6ff', B: '#3560b8', w: '#ffffff' },
  },
  sun: {
    rows: [
      '.....oo.....',
      '.o...oo...o.',
      '..o.kkkk.o..',
      '...khyyyk...',
      'o.khyyyyyk.o',
      'ookyyyyyykoo',
      'ookyyyyyykoo',
      'o.kyyyyyYk.o',
      '...kyyyYk...',
      '..o.kkkk.o..',
      '.o...oo...o.',
      '.....oo.....',
    ],
    pal: { y: '#f5c542', h: '#fff0a0', Y: '#e0a020', o: '#f5a623' },
  },
  moon: {
    rows: [
      '....kkkkk...',
      '..kkmmmk....',
      '.kmmmhk..w..',
      '.kmmhk......',
      'kmmmk.......',
      'kmmmk...w...',
      'kmmmk.......',
      '.kmmmmk.....',
      '.kmmmmmk....',
      '..kkmmmmmkk.',
      '....kkkkk...',
      '............',
    ],
    pal: { m: '#e6e2c8', h: '#fffbe6', w: '#fff4a8' },
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
      '............',
    ],
    pal: { g: '#6cc04a' },
  },
  close: {
    rows: [
      '............',
      '.kk......kk.',
      'kxxk....kxxk',
      '.kxxk..kxxk.',
      '..kxxkkxxk..',
      '...kxxxxk...',
      '...kxxxxk...',
      '..kxxkkxxk..',
      '.kxxk..kxxk.',
      'kxxk....kxxk',
      '.kk......kk.',
      '............',
    ],
    pal: { x: '#ececec' },
  },
  bell: {
    rows: [
      '.....kk.....',
      '....kyyk....',
      '...kyhyyk...',
      '..kyhyyyyk..',
      '..kyhyyyyk..',
      '..kyyyyyyk..',
      '.kyyyyyyyyk.',
      'kyyyyyyyyyyk',
      'kkkkkkkkkkkk',
      '....kYYk....',
      '.....kk.....',
      '............',
    ],
    pal: { y: '#f5c542', h: '#fff0a0', Y: '#c48a1f' },
  },
  arrowLeft: {
    rows: [
      '............',
      '............',
      '....kk......',
      '...kak......',
      '..kaakkkkkk.',
      '.kaaaaaaaaak',
      '.kaaaaaaaaak',
      '..kaakkkkkk.',
      '...kak......',
      '....kk......',
      '............',
      '............',
    ],
    pal: { a: '#ececec' },
  },
  // randomize
  dice: {
    rows: [
      '............',
      '.kkkkkkkkkk.',
      '.kwwwwwwwWk.',
      '.kwddwwwwWk.',
      '.kwddwwwwWk.',
      '.kwwwddwwWk.',
      '.kwwwddwwWk.',
      '.kwwwwwddWk.',
      '.kwwwwwddWk.',
      '.kWWWWWWWWk.',
      '.kkkkkkkkkk.',
      '............',
    ],
    pal: { w: '#f4f4f4', W: '#c9c9c9', d: '#d9534f' },
  },
  undo: {
    rows: [
      '............',
      '...kk.......',
      '..kak.......',
      '.kaakkkkk...',
      'kaaaaaaaaak.',
      '.kaakkkkkaak',
      '..kak....kak',
      '...kk....kak',
      '....kkkkkaak',
      '....kaaaaak.',
      '....kkkkkk..',
      '............',
    ],
    pal: { a: '#ececec' },
  },
} satisfies Record<string, IconDef>

export type IconName = keyof typeof ICONS
/** Looping icon animations (stepped, see index.css; off under reduced motion). */
export type IconAnim = 'bob' | 'shake' | 'spin' | 'pop' | 'twinkle' | 'ring'

/** For tests: every icon must be exactly 12x12 with a colour for every character. */
export const ICON_DEFS: Record<string, IconDef> = ICONS

export function PixelIcon({ name, size = 16, title, className, anim }: { name: IconName; size?: number; title?: string; className?: string; anim?: IconAnim }) {
  const icon: IconDef = ICONS[name]
  const rects: ReactElement[] = []
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
      className={`inline-block shrink-0 ${anim ? `ss-i-${anim}` : ''} ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {rects}
    </svg>
  )
}
