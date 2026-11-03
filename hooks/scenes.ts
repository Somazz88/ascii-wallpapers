// Animated ASCII-tile wallpapers, each a self-contained SVG: tiles are
// pattern-filled runs, glyphs are <text>, motion is CSS keyframes (no script).

export type SceneId =
  | 'cloud' | 'lagoon' | 'koi' | 'jelly' | 'boats' | 'fireflies' | 'moon' | 'sakura'
  | 'train' | 'matsuri' | 'meteor' | 'neon' | 'sky' | 'sigil' | 'wisp' | 'blade'

export const SCENES: ReadonlyArray<{ id: SceneId; zh: string; en: string }> = [
  { id: 'cloud', zh: '云海漂流', en: 'Cloud Drift' },
  { id: 'lagoon', zh: '霓虹泻湖', en: 'Neon Lagoon' },
  { id: 'koi', zh: '锦鲤池', en: 'Koi Pond' },
  { id: 'jelly', zh: '水母', en: 'Jellyfish' },
  { id: 'boats', zh: '纸船', en: 'Paper Boats' },
  { id: 'fireflies', zh: '萤火虫', en: 'Fireflies' },
  { id: 'moon', zh: '月夜', en: 'Moonlit' },
  { id: 'sakura', zh: '樱花', en: 'Sakura' },
  { id: 'train', zh: '夏日电车', en: 'Summer Train' },
  { id: 'matsuri', zh: '夏日祭', en: 'Matsuri Night' },
  { id: 'meteor', zh: '流星雨', en: 'Meteor Shower' },
  { id: 'neon', zh: '霓虹雨夜', en: 'Neon Rain' },
  { id: 'sky', zh: '天空之岛', en: 'Sky Islands' },
  { id: 'sigil', zh: '魔法阵', en: 'Magic Circle' },
  { id: 'wisp', zh: '妖火', en: 'Spirit Flames' },
  { id: 'blade', zh: '刀光血月', en: 'Blood Moon' },
]

export type SceneOptions = {
  cols: number
  rows: number
  cell: number
  /** Letters drawn on the tiles (off for small thumbnails). */
  glyphs: boolean
  /** Opacity of a dark veil over the whole scene, 0 for none. */
  scrim: number
}

type Tile = [x: number, y: number, color: string, alpha?: number]
type Rand = () => number

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnopqrstuvwxyz0123456789#$%*+=?@'
const KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン'

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const fx = (v: number) => String(Math.round(v * 100) / 100)

function rng(seed: number): Rand {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hexOf = (c: number[]) =>
  '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')

const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => v + ((b[i] ?? v) - v) * t)

/** An index known to be in range (the checker cannot see it). */
const nth = <T>(list: readonly T[], i: number): T => list[i] as T

function glyphColor(color: string): string {
  const c = hex(color)
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

  return lum > 150 ? hexOf(mix(c, [0, 0, 0], 0.42)) : hexOf(mix(c, [255, 255, 255], 0.5))
}

// ------------------------------------------------------------------ builder

class Art {
  o: SceneOptions
  c: number
  W: number
  H: number
  body: string[] = []
  /** The letters tiles are stamped with. */
  glyphSet = GLYPHS
  private defs: string[] = []
  private frames: string[] = []
  private pats = new Map<string, string>()
  private grads = new Map<string, string>()

  constructor(o: SceneOptions) {
    this.o = o
    this.c = o.cell
    this.W = o.cols * o.cell
    this.H = o.rows * o.cell
  }

  add(markup: string) {
    this.body.push(markup)
  }

  def(id: string, markup: string) {
    this.defs.push(`<g id="${id}">${markup}</g>`)
  }

  keyframes(rule: string) {
    this.frames.push(rule)
  }

  /** A tile pattern of one color: every shape filled with it reads as cells. */
  pat(color: string): string {
    let id = this.pats.get(color)
    if (!id) {
      id = 'p' + this.pats.size
      this.pats.set(color, id)
      const g = this.c >= 12 ? 1 : 0.5
      this.defs.push(
        `<pattern id="${id}" width="${this.c}" height="${this.c}" patternUnits="userSpaceOnUse"><rect x="${g}" y="${g}" width="${this.c - 2 * g}" height="${this.c - 2 * g}" fill="${color}"/></pattern>`,
      )
    }

    return id
  }

  bg(stops: Array<[number, string]>) {
    const s = stops.map(([o, c]) => `<stop offset="${fx(clamp(o, 0, 1))}" stop-color="${c}"/>`).join('')
    this.defs.push(`<linearGradient id="bg" x2="0" y2="1">${s}</linearGradient>`)
    this.add(`<rect width="${this.W}" height="${this.H}" fill="url(#bg)"/>`)
  }

  /** A soft round light, centred on a cell position, radius in cells. */
  glow(gx: number, gy: number, rad: number, color: string, alpha: number, cls = ''): string {
    const key = color + alpha
    let id = this.grads.get(key)
    if (!id) {
      id = 'g' + this.grads.size
      this.grads.set(key, id)
      this.defs.push(
        `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${alpha}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
      )
    }

    return `<circle${cls ? ` class="${cls}"` : ''} cx="${fx(gx * this.c)}" cy="${fx(gy * this.c)}" r="${fx(rad * this.c)}" fill="url(#${id})"/>`
  }

  /** One glyph centred in a cell (no tile behind it). */
  glyph(gx: number, gy: number, ch: string, cls = ''): string {
    return `<text${cls ? ` class="${cls}"` : ''} x="${fx(gx * this.c + this.c / 2)}" y="${fx(gy * this.c + this.c * 0.74)}">${ch}</text>`
  }

  /** Cells in grid units: runs of one color merge into one path. */
  tiles(list: Tile[], seed = 0, withGlyphs = this.o.glyphs): string {
    const c = this.c
    const groups = new Map<string, Map<number, Set<number>>>()
    for (const [x, y, color, a = 1] of list) {
      const key = color + '|' + fx(a)
      let rows = groups.get(key)
      if (!rows) groups.set(key, (rows = new Map()))
      let xs = rows.get(y)
      if (!xs) rows.set(y, (xs = new Set()))
      xs.add(x)
    }

    let out = ''
    for (const [key, rows] of groups) {
      const [color = '#000000', alpha = '1'] = key.split('|')
      const op = alpha === '1' ? '' : ` opacity="${alpha}"`
      let d = ''
      let text = ''
      for (const [y, set] of rows) {
        const xs = [...set].sort((p, q) => p - q)
        for (let i = 0; i < xs.length; ) {
          let j = i
          while (j + 1 < xs.length && nth(xs, j + 1) === nth(xs, j) + 1) j++
          const len = (j - i + 1) * c
          d += `M${nth(xs, i) * c} ${y * c}h${len}v${c}h-${len}z`
          i = j + 1
        }
        if (withGlyphs) {
          const set = [...this.glyphSet]
          const chars = xs.map(x => nth(set, hash2(x * 7 + seed, y * 13 + seed * 3) % set.length)).join('')
          text += `<text x="${xs.map(x => x * c + c / 2).join(' ')}" y="${fx(y * c + c * 0.74)}">${chars}</text>`
        }
      }
      out += `<path fill="url(#${this.pat(color)})"${op} d="${d}"/>`
      if (text) out += `<g fill="${glyphColor(color)}"${op}>${text}</g>`
    }

    return out
  }

  /** A bitmap (rows of palette keys, '.' empty) at local cell origin. */
  sprite(bmp: readonly string[], pal: Record<string, string>, seed: number, withGlyphs = this.o.glyphs): string {
    const list: Tile[] = []
    bmp.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = pal[nth([...row], x)]
        if (color) list.push([x, y, color])
      }
    })

    return this.tiles(list, seed, withGlyphs)
  }

  /** Inline style for an endless move by `dist` px, snapped to cells. */
  move(name: 'dx' | 'dy', dist: number, dur: number, steps: number, delay: number): string {
    const timing = steps > 0 ? `steps(${steps})` : 'linear'

    return `--d:${fx(dist)}px;animation:${name} ${fx(dur)}s ${timing} ${fx(delay)}s infinite`
  }

  render(): string {
    const c = this.c
    const css =
      `text{font:700 ${fx(c * 0.7)}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-anchor:middle}` +
      '@keyframes dx{to{transform:translateX(var(--d))}}' +
      '@keyframes dy{to{transform:translateY(var(--d))}}' +
      '@keyframes tw{0%,100%{opacity:.12}50%{opacity:1}}' +
      '@keyframes fa{0%{opacity:1}50%{opacity:0}}' +
      '@keyframes fb{0%{opacity:0}50%{opacity:1}}' +
      '@keyframes bob{50%{transform:translateY(var(--b))}}' +
      '@keyframes sw{25%,75%{transform:translateY(var(--b))}50%{transform:translateY(calc(var(--b)*2))}}' +
      '@keyframes sx{25%,75%{transform:translateX(var(--b))}50%{transform:translateX(calc(var(--b)*2))}}' +
      '@keyframes pu{50%{opacity:.45}}' +
      '.t0{animation:tw 3.1s -.4s infinite}.t1{animation:tw 4.3s -1.9s infinite}.t2{animation:tw 5.7s -3.2s infinite}.t3{animation:tw 2.3s -1.1s infinite}' +
      '.fa{animation:fa 1s steps(1) infinite}.fb{animation:fb 1s steps(1) infinite}' +
      '.pu{animation:pu 3.4s ease-in-out infinite}' +
      this.frames.join('')
    const scrim = this.o.scrim > 0 ? `<rect width="${this.W}" height="${this.H}" fill="#000" opacity="${fx(this.o.scrim)}"/>` : ''

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.W} ${this.H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">` +
      `<style>${css}</style><defs>${this.defs.join('')}</defs>${this.body.join('')}${scrim}</svg>`
    )
  }
}

// ------------------------------------------------------------------ shapes

function genCloud(r: Rand, w: number, h: number): string[] {
  const circles: Array<[number, number, number]> = []
  const n = 3 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const rad = Math.min(h * (0.5 + r() * 0.5), w / 2)
    circles.push([rad + r() * Math.max(0, w - 2 * rad), h - rad * 0.85, rad])
  }

  return fillCircles(w, h, circles)
}

/** A towering summer cumulus: puffs stacked in three tiers. */
function genTower(r: Rand, w: number, h: number): string[] {
  const circles: Array<[number, number, number]> = []
  const tier = (count: number, rad: number, cy: number, spread: number) => {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1)
      circles.push([w / 2 + (t - 0.5) * w * spread + (r() - 0.5) * rad * 0.6, cy, rad * (0.85 + r() * 0.3)])
    }
  }
  tier(5, h * 0.2, h - h * 0.2, 0.78)
  tier(4, h * 0.21, h * 0.55, 0.52)
  tier(3, h * 0.18, h * 0.3, 0.3)
  tier(1, h * 0.15, h * 0.15, 0)

  return fillCircles(w, h, circles)
}

function fillCircles(w: number, h: number, circles: ReadonlyArray<readonly [number, number, number]>): string[] {
  const g = Array.from({ length: h }, () => Array<boolean>(w).fill(false))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      nth(g, y)[x] = circles.some(([cx, cy, rad]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rad * rad)
    }
  }
  if (h > 1) for (let x = 0; x < w; x++) if (nth(g, h - 2)[x]) nth(g, h - 1)[x] = true

  return g.map((row, y) =>
    row
      .map((on, x) => {
        if (!on) return '.'
        if (y === h - 1 || !nth(g, y + 1)[x]) return 'L'
        if (y === 0 || !nth(g, y - 1)[x]) return 'H'

        return 'W'
      })
      .join(''),
  )
}

function genPad(r: Rand, rad: number, flower: boolean): string[] {
  const n = rad * 2 + 1
  const a0 = r() * Math.PI * 2
  const rows: string[] = []
  for (let y = 0; y < n; y++) {
    let s = ''
    for (let x = 0; x < n; x++) {
      const dx = x - rad
      const dy = y - rad
      const d = Math.hypot(dx, dy)
      let ang = Math.atan2(dy, dx) - a0
      ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      if (d > rad + 0.35 || (d > 0.6 && ang < 0.55)) s += '.'
      else if (flower && d < 0.5) s += 'F'
      else if (flower && d < 1.2) s += 'f'
      else if (d > rad - 0.75) s += 'D'
      else s += hash2(x, y + rad) % 7 === 0 ? 'L' : 'G'
    }
    rows.push(s)
  }

  return rows
}

const flipX = (bmp: readonly string[]) => bmp.map(row => [...row].reverse().join(''))

const CLOUD_PAL = { H: '#ffffff', W: '#f2f7ff', L: '#c6d9ee' }
const NIGHT_CLOUD_PAL = { H: '#8293d6', W: '#6070b6', L: '#47559a' }
const PAD_PAL = { G: '#43b05c', D: '#2e8a48', L: '#7ad27f', F: '#ff7fb0', f: '#ffc2da' }
const KOI = [
  ['......OOOO...', 'TT..OOWWWOOO.', 'TTTOOOOOWWOEO', 'TT..OOWWOOOO.', '......OOO....'],
  ['T.....OOOO...', '.T..OOWWWOOO.', 'TTTOOOOOWWOEO', '.T..OOWWOOOO.', 'T.....OOO....'],
]
const KOI_PALS = [
  { O: '#ff7a2f', W: '#fff4e8', T: '#ffb37a', E: '#1b1b1b' },
  { O: '#e8392f', W: '#fffaf2', T: '#ffc9bd', E: '#222222' },
  { O: '#ffc23d', W: '#fff1c2', T: '#ffd98a', E: '#222222' },
  { O: '#f5f5f0', W: '#2b2b2b', T: '#e0e0dc', E: '#111111' },
]
const SHADOW_PAL = { O: '#0b3f3f', W: '#0b3f3f', T: '#0b3f3f', E: '#0b3f3f' }
const BELL = [
  ['...PPPPP...', '.PPPPPPPPP.', 'PPLPPPPPLPP', 'PPPPLPLPPPP', 'PPPPPPPPPPP', 'R.R.R.R.R.R'],
  ['....PPP....', '..PPPPPPP..', '..PLPPPLP..', '.PPPPLPPPP.', '.PPPPPPPPP.', '.R.R.R.R.R.'],
]
const JELLY_PALS = [
  { P: '#ff8fc8', L: '#ffd3ea', R: '#ff6fb5' },
  { P: '#b48cff', L: '#e6dbff', R: '#9b6dff' },
  { P: '#ffab7a', L: '#ffe2cf', R: '#ff8a57' },
  { P: '#6fe3ff', L: '#d8f8ff', R: '#3fc9f0' },
]
const BOATS = [
  ['.....S.....', '....SSS....', '...SSSSS...', '..SSSSSSS..', 'HHHHHHHHHHH', '.HHHHHHHHH.', '..HHHHHHH..'],
  ['...S...', '..SSS..', 'HHHHHHH', '.HHHHH.'],
]
const BOAT_PALS = [
  { S: '#fbf7ef', H: '#e3dccd' },
  { S: '#ffd9a8', H: '#f0b97a' },
  { S: '#cfe4ff', H: '#a9c8f0' },
  { S: '#ffd6e0', H: '#f3b0c2' },
]

function disk(cx: number, cy: number, R: number, color: (d: number, dx: number, dy: number) => string | null): Tile[] {
  const out: Tile[] = []
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy)
      if (d > R + 0.2) continue
      const col = color(d, dx, dy)
      if (col) out.push([cx + dx, cy + dy, col])
    }
  }

  return out
}

function scatter(a: Art, r: Rand, n: number, x0: number, y0: number, w: number, h: number, chars: string): string {
  let out = ''
  for (let i = 0; i < n; i++) {
    const ch = nth([...chars], Math.floor(r() * chars.length))
    out += a.glyph(Math.floor(x0 + r() * w), Math.floor(y0 + r() * h), ch, `t${i % 4}`)
  }

  return out
}

// ------------------------------------------------------------------ scenes

function cloud(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.bg([[0, '#2f7fd0'], [0.55, '#6db6ef'], [1, '#cfeaff']])
  const R = clamp(Math.round(rows * 0.07), 2, 4)
  const sx = Math.round(cols * 0.82)
  const sy = Math.round(clamp(rows * 0.18, R + 1, 8))
  a.add(a.glow(sx + 0.5, sy + 0.5, R * 4, '#fff0be', 0.6, 'pu'))
  a.add(a.tiles(disk(sx, sy, R, d => (d < R - 1 ? '#fff6cf' : '#ffe08a')), 7))

  const clouds = Array.from({ length: Math.max(4, Math.round(cols / 17)) }, (_, i) => {
    const z = r()
    const w = Math.min(cols, Math.round(16 + z * 18 + r() * 6))
    const h = Math.min(Math.max(3, Math.round(rows * 0.4)), Math.round(5 + z * 4 + r() * 2))

    return { i, z, w, bmp: genCloud(r, w, h), y: Math.floor(1 + r() * Math.max(1, rows * 0.68)) }
  }).sort((p, q) => p.z - q.z)
  for (const k of clouds) {
    a.def(`k${k.i}`, a.sprite(k.bmp, CLOUD_PAL, k.i + 1))
    const span = cols + k.w + 8
    const dur = span / (0.35 + k.z * 1.1)
    a.add(
      `<g style="${a.move('dx', span * c, dur, span, -r() * dur)}"><use href="#k${k.i}" x="${-(k.w + 4) * c}" y="${k.y * c}" opacity="${fx(0.82 + k.z * 0.18)}"/></g>`,
    )
  }

  if (!a.o.glyphs) return
  for (let i = 0; i < 3; i++) {
    const span = cols + 6
    const dur = span / (1.5 + r())
    const y = Math.round(2 + r() * rows * 0.4)
    const flap = `style="animation-duration:${fx(0.35 + r() * 0.25)}s"`
    a.add(
      `<g fill="#24496e" style="${a.move('dx', span * c, dur, span, -r() * dur)}">` +
        a.glyph(-3, y, 'v', 'fa').replace('<text', `<text ${flap}`) +
        a.glyph(-3, y, '^', 'fb').replace('<text', `<text ${flap}`) +
        '</g>',
    )
  }
}

function lagoon(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  const hz = Math.round(rows * 0.56)
  const R = clamp(Math.round(rows * 0.2), 4, 11)
  const cx = Math.round(cols / 2)
  const cy = hz - Math.round(R * 0.25)
  const f = hz / rows
  a.bg([[0, '#0d0824'], [f * 0.98, '#4b1462'], [f, '#0a2236'], [1, '#030d18']])
  a.add(`<g fill="#e9d8ff">${scatter(a, r, Math.round((cols * hz) / 60), 0, 0, cols, hz - 2, '··.')}</g>`)
  a.add(a.glow(cx + 0.5, cy, R * 3, '#ff50aa', 0.42))

  const top = hex('#ffd36e')
  const bot = hex('#ff3d8b')
  const sun: Tile[] = []
  for (let dy = -R; dy <= R; dy++) {
    const y = cy + dy
    if (y >= hz || (dy > -R * 0.2 && y % 3 === 0)) continue
    const hw = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)))
    const col = hexOf(mix(top, bot, (dy + R) / (2 * R)))
    for (let dx = -hw; dx <= hw; dx++) sun.push([cx + dx, y, col])
  }
  a.add(a.tiles(sun, 40))
  a.add(`<g class="pu">${a.tiles(Array.from({ length: cols }, (_, x): Tile => [x, hz, '#ff4fd8', 0.8]), 99)}</g>`)

  const frame = (phase: number) => {
    const list: Tile[] = []
    for (let i = 1; i <= Math.min(10, rows - hz - 1); i++) {
      const hw = Math.round(R * (1 - i * 0.08))
      const col = hexOf(mix(bot, top, (i / 10) * 0.5))
      for (let dx = -hw; dx <= hw; dx++) {
        if (Math.sin((cx + dx) * 0.7 + i * 1.9 + phase) > 0.35) continue
        list.push([cx + dx, hz + i, col, Math.max(0.15, Math.round((0.8 - i * 0.06) * 10) / 10)])
      }
    }

    return a.tiles(list, 500)
  }
  a.add(`<g class="fa" style="animation-duration:.7s">${frame(0)}</g><g class="fb" style="animation-duration:.7s">${frame(Math.PI)}</g>`)

  const P = 28
  const gap = Math.max(2, Math.round((rows - hz - 3) / 4))
  const waves: Array<[string, number]> = [['#2de2e6', 0.85], ['#8a5cff', 0.7], ['#2de2e6', 0.55], ['#ff4fd8', 0.45]]
  waves.forEach(([col, alpha], k) => {
    const base = hz + 3 + k * gap
    if (base >= rows) return
    const dir = k % 2 ? -1 : 1
    const list: Tile[] = []
    for (let x = 0; x < cols + P; x++) {
      const s = Math.sin((2 * Math.PI * x) / P + k * 1.7)
      if (s < -0.2) continue
      const y = base + Math.round(Math.sin((2 * Math.PI * x) / P + k) * 1.2)
      const lvl = s > 0.6 ? 1 : s > 0.2 ? 0.75 : 0.5
      list.push([dir > 0 ? x - P : x, y, col, Math.round(alpha * lvl * 100) / 100])
    }
    const dur = P / (2 + k * 0.6)
    a.add(`<g style="${a.move('dx', dir * P * c, dur, P, -r() * dur)}">${a.tiles(list, 700 + k)}</g>`)
  })
}

function koi(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.bg([[0, '#1f8a7c'], [0.5, '#17736b'], [1, '#0e5258']])
  a.add(`<g fill="#c8fff2" opacity=".5">${scatter(a, r, Math.round((cols * rows) / 45), 0, 0, cols, rows, '~~-')}</g>`)

  if (a.o.glyphs) {
    a.keyframes('@keyframes rp{0%{transform:scale(.15);opacity:.7}100%{transform:scale(1);opacity:0}}')
    for (let i = 0; i < 5; i++) {
      const px = Math.floor(r() * cols)
      const py = Math.floor(r() * rows)
      let ring = ''
      for (let k = 0; k < 22; k++) {
        const ang = (k / 22) * Math.PI * 2
        ring += a.glyph(px + Math.cos(ang) * 6, py + Math.sin(ang) * 6, 'o')
      }
      a.add(
        `<g fill="#e6fffa" style="transform-origin:${(px + 0.5) * c}px ${(py + 0.5) * c}px;opacity:0;animation:rp 3.6s ease-out ${fx(-r() * 9)}s infinite">${ring}</g>`,
      )
    }
  }

  const made = new Set<string>()
  const use = (id: string, bmp: readonly string[], pal: Record<string, string>, seed: number, glyphs?: boolean) => {
    if (!made.has(id)) {
      made.add(id)
      a.def(id, a.sprite(bmp, pal, seed, glyphs))
    }

    return id
  }
  const n = Math.max(3, Math.round((cols * rows) / 900))
  for (let i = 0; i < n; i++) {
    const pi = i % KOI_PALS.length
    const dir = r() < 0.5 ? 1 : -1
    const side = dir > 0 ? 'r' : 'l'
    const shape = (b: readonly string[]) => (dir > 0 ? b : flipX(b))
    const f1 = use(`f${pi}a${side}`, shape(nth(KOI, 0)), nth(KOI_PALS, pi), pi * 10 + 1)
    const f2 = use(`f${pi}b${side}`, shape(nth(KOI, 1)), nth(KOI_PALS, pi), pi * 10 + 1)
    const sh = use(`fs${side}`, shape(nth(KOI, 0)), SHADOW_PAL, 0, false)
    const span = cols + 26
    const dur = span / (1.6 + r() * 1.8)
    const x0 = dir > 0 ? -13 : cols
    const y0 = Math.floor(1 + r() * Math.max(1, rows - 9))
    const at = `x="${x0 * c}" y="${y0 * c}"`
    const wag = 'style="animation-duration:.42s"'
    a.add(
      `<g style="${a.move('dx', dir * span * c, dur, span, -r() * dur)}">` +
        `<g style="--b:${(r() < 0.5 ? 1 : -1) * c}px;animation:sw ${fx(6 + r() * 5)}s steps(1) ${fx(-r() * 9)}s infinite">` +
        `<use href="#${sh}" x="${(x0 + 1) * c}" y="${(y0 + 1) * c}" opacity=".3"/>` +
        `<use class="fa" ${wag} href="#${f1}" ${at}/><use class="fb" ${wag} href="#${f2}" ${at}/></g></g>`,
    )
  }

  const pads = Math.max(3, Math.round((cols * rows) / 1100))
  for (let i = 0; i < pads; i++) {
    const rad = 2 + Math.floor(r() * 2.5)
    a.def(`lp${i}`, a.sprite(genPad(r, rad, r() < 0.4), PAD_PAL, 50 + i))
    a.add(`<use href="#lp${i}" x="${(Math.floor(r() * cols) - rad) * c}" y="${(Math.floor(r() * rows) - rad) * c}"/>`)
  }
}

function jelly(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  const { W, H } = a
  a.bg([[0, '#0f4a72'], [0.45, '#0a2f52'], [1, '#030f1e']])

  a.keyframes('@keyframes ry{50%{transform:skewX(6deg)}}')
  a.add(
    '<defs><linearGradient id="ray" x2="0" y2="1"><stop offset="0" stop-color="#b4e6ff" stop-opacity=".13"/><stop offset="1" stop-color="#b4e6ff" stop-opacity="0"/></linearGradient></defs>',
  )
  for (let i = 0; i < 3; i++) {
    const x = W * (0.2 + i * 0.3)
    a.add(
      `<polygon fill="url(#ray)" points="${fx(x - W * 0.015)},0 ${fx(x + W * 0.02)},0 ${fx(x + W * 0.09)},${fx(H * 0.8)} ${fx(x - W * 0.04)},${fx(H * 0.8)}" style="transform-origin:${fx(x)}px 0px;animation:ry ${fx(9 + i * 2)}s ease-in-out ${-i * 3}s infinite"/>`,
    )
  }

  a.def('sn', `<g fill="#cfe8ff" opacity=".45">${scatter(a, r, Math.round((cols * rows) / 70), 0, 0, cols, rows, '·.')}</g>`)
  a.add(`<g style="--d:${H}px;animation:dy 80s linear infinite"><use href="#sn" y="${-H}"/><use href="#sn"/></g>`)
  if (a.o.glyphs) {
    a.def('bu', `<g fill="#bfe6ff" opacity=".5">${scatter(a, r, Math.max(6, Math.round(cols / 6)), 0, 0, cols, rows, 'oo°')}</g>`)
    a.add(`<g style="--d:${-H}px;animation:dy 28s linear infinite"><use href="#bu"/><use href="#bu" y="${H}"/></g>`)
  }

  const n = Math.max(3, Math.round(cols / 16))
  for (let i = 0; i < n; i++) {
    const pi = i % JELLY_PALS.length
    const pal = nth(JELLY_PALS, pi)
    if (i < JELLY_PALS.length) {
      a.def(`jo${pi}`, a.sprite(nth(BELL, 0), pal, 80 + pi))
      a.def(`jc${pi}`, a.sprite(nth(BELL, 1), pal, 80 + pi))
    }
    const lens = Array.from({ length: 5 }, () => 5 + Math.floor(r() * 5))
    const ph = r() * 6
    const tentacles = (cols0: number[], shift: number) => {
      const list: Tile[] = []
      cols0.forEach((ox, t) => {
        const L = nth(lens, t)
        for (let s = 0; s < L; s++) {
          const dx = Math.round(Math.sin(s * 0.6 + t * 1.3 + ph + shift) * (s / L) * 1.8)
          const q = s / L
          list.push([ox + dx, 6 + s, pal.R, q < 0.34 ? 0.9 : q < 0.67 ? 0.6 : 0.35])
        }
      })

      return a.tiles(list, 90 + i)
    }
    a.def(`ta${i}`, tentacles([1, 3, 5, 7, 9], 0))
    a.def(`tb${i}`, tentacles([2, 4, 5, 6, 8], Math.PI))

    const x = Math.floor(((i + 0.5) / n) * cols - 5 + (r() - 0.5) * 6)
    const y = rows + 4
    const span = rows + 24
    const dur = span / (0.9 + r() * 1.1)
    const at = `x="${x * c}" y="${y * c}"`
    const pulse = `style="animation-duration:${fx(1.5 + r() * 0.8)}s"`
    a.add(
      `<g style="${a.move('dy', -span * c, dur, span, -r() * dur)}">` +
        a.glow(x + 5.5, y + 4, 9, pal.P, 0.2) +
        `<g class="fa" ${pulse}><use href="#jo${pi}" ${at}/><use href="#ta${i}" ${at}/></g>` +
        `<g class="fb" ${pulse}><use href="#jc${pi}" ${at}/><use href="#tb${i}" ${at}/></g></g>`,
    )
  }
}

function boats(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  const hz = Math.round(rows * 0.45)
  const f = hz / rows
  a.bg([[0, '#26325e'], [f * 0.7, '#8a5a8c'], [f, '#f1a989'], [f + 0.002, '#3a5f86'], [1, '#13243d']])
  a.add(`<g fill="#fff3e0">${scatter(a, r, Math.round((cols * hz) / 80), 0, 0, cols, hz - 3, '·.')}</g>`)

  const R = clamp(Math.round(rows * 0.09), 2, 5)
  const sx = Math.round(cols * 0.3)
  a.add(a.glow(sx + 0.5, hz, R * 4, '#ffbe8c', 0.45, 'pu'))
  a.add(a.tiles(disk(sx, hz, R, (_d, _dx, dy) => (dy < 0 ? '#ffd59a' : null)), 300))

  a.add(`<g fill="#ffd9c2" opacity=".55">${scatter(a, r, Math.round((cols * (rows - hz)) / 14), 0, hz, cols, rows - hz, '~~-')}</g>`)

  const glint = (phase: number) => {
    const list: Tile[] = []
    for (let y = hz; y < Math.min(rows, hz + 14); y++) {
      const hw = Math.max(0, R - Math.floor((y - hz) / 3))
      for (let dx = -hw - 1; dx <= hw + 1; dx++) {
        if (Math.sin(dx * 1.3 + y * 2.1 + phase) > 0.2) continue
        list.push([sx + dx, y, '#ffc48a', Math.round(5 * (1 - (y - hz) / 14)) / 10])
      }
    }

    return a.tiles(list, 310)
  }
  a.add(`<g class="fa" style="animation-duration:.9s">${glint(0)}</g><g class="fb" style="animation-duration:.9s">${glint(Math.PI)}</g>`)

  const made = new Set<string>()
  const n = Math.max(3, Math.round(cols / 22))
  const list = Array.from({ length: n }, (_, i) => ({
    i,
    big: r() < 0.5,
    pi: i % BOAT_PALS.length,
    y: hz + 2 + Math.floor(r() * Math.max(1, rows - hz - 9)),
  })).sort((p, q) => p.y - q.y)
  for (const b of list) {
    const bmp = nth(BOATS, b.big ? 0 : 1)
    const pal = nth(BOAT_PALS, b.pi)
    const id = `b${b.big ? 'B' : 's'}${b.pi}`
    if (!made.has(id)) {
      made.add(id)
      a.def(id, a.sprite(bmp, pal, 120 + b.pi))
      a.def(id + 'r', a.sprite([...bmp].reverse(), pal, 0, false))
    }
    const w = nth(bmp, 0).length
    const dir = r() < 0.5 ? -1 : 1
    const span = cols + w + 10
    const dur = span / (0.25 + r() * 0.5)
    const x0 = dir > 0 ? -(w + 5) : cols + 5
    a.add(
      `<g style="${a.move('dx', dir * span * c, dur, span, -r() * dur)}">` +
        `<g style="--b:${-c}px;animation:bob ${fx(2.4 + r() * 1.4)}s steps(1) ${fx(-r() * 3)}s infinite">` +
        `<use href="#${id}r" x="${x0 * c}" y="${(b.y + bmp.length) * c}" opacity=".2"/>` +
        `<use href="#${id}" x="${x0 * c}" y="${b.y * c}"/></g></g>`,
    )
  }
}

function fireflies(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.bg([[0, '#040d14'], [0.6, '#081d1c'], [1, '#0c2a1b']])

  const pines: Tile[] = []
  for (let i = 0; i < Math.max(5, Math.round(cols / 9)); i++) {
    const h = Math.round(rows * (0.25 + r() * 0.35))
    const hw = Math.max(2, Math.round(h * 0.32))
    const px = Math.floor(r() * cols)
    const color = r() < 0.5 ? '#0c2219' : '#0f2a1f'
    const top = rows - 1 - h
    for (let y = top; y < rows; y++) {
      const w = Math.round(((y - top) / h) * hw)
      for (let dx = -w; dx <= w; dx++) pines.push([px + dx, y, color])
    }
  }
  a.add(a.tiles(pines, 0, false))

  const blades: Array<{ x: number; h: number; lean: number; color: string }> = []
  for (let x = 0; x < cols; x++) {
    if (r() < 0.75) blades.push({ x, h: 2 + Math.floor(r() * Math.max(2, rows * 0.12)), lean: r() < 0.5 ? 1 : -1, color: r() < 0.5 ? '#1f5a33' : '#2b7440' })
  }
  const grass = (k: number) => {
    const list: Tile[] = []
    for (const b of blades) {
      for (let s = 0; s < b.h; s++) {
        const q = (s + 1) / b.h
        list.push([b.x + (q > 0.6 ? b.lean * k : 0), rows - 1 - s, b.color])
      }
    }

    return a.tiles(list, 77)
  }
  a.add(`<g class="fa" style="animation-duration:2.6s">${grass(0)}</g><g class="fb" style="animation-duration:2.6s">${grass(1)}</g>`)

  a.keyframes('@keyframes bl{0%,40%,100%{opacity:0}55%{opacity:1}72%{opacity:.1}}')
  const n = Math.max(10, Math.round((cols * rows) / 220))
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * cols)
    const y = Math.floor(rows * 0.15 + r() * rows * 0.8)
    const pt = () => `translate(${fx((r() - 0.5) * 12 * c)}px,${fx((r() - 0.5) * 6 * c)}px)`
    a.keyframes(`@keyframes w${i}{25%{transform:${pt()}}50%{transform:${pt()}}75%{transform:${pt()}}}`)
    a.add(
      `<g style="animation:w${i} ${fx(14 + r() * 12)}s ease-in-out ${fx(-r() * 20)}s infinite">` +
        `<g style="opacity:0;animation:bl ${fx(2.2 + r() * 2.8)}s ${fx(-r() * 5)}s infinite">` +
        a.glow(x + 0.5, y + 0.5, 3.2, '#d6ff78', 0.4) +
        a.tiles([[x, y, '#eaff8a']], i) +
        '</g></g>',
    )
  }
}

function moon(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.bg([[0, '#070d26'], [0.6, '#142259'], [1, '#26357a']])
  a.add(`<g fill="#e3e9ff">${scatter(a, r, Math.round((cols * rows) / 45), 0, 0, cols, rows * 0.85, '··.+*')}</g>`)

  const R = clamp(Math.round(rows * 0.11), 3, 8)
  const mx = Math.round(cols * 0.76)
  const my = Math.round(Math.max(R + 1, rows * 0.24))
  a.add(a.glow(mx + 0.5, my + 0.5, R * 4, '#ffecb4', 0.32, 'pu'))
  a.add(
    a.tiles(
      disk(mx, my, R, (_d, dx, dy) => {
        const di = Math.hypot(dx - R * 0.55, dy + R * 0.25)
        if (di <= R * 0.92) return null

        return di < R * 1.25 ? '#e3c97f' : '#f7e8b8'
      }),
      20,
    ),
  )

  if (a.o.glyphs) {
    const dx = cols * 0.38 * c
    const dy = rows * 0.14 * c
    a.keyframes(
      `@keyframes ss{0%{transform:translate(0,0);opacity:0}1%{opacity:1}8%,100%{transform:translate(${fx(dx)}px,${fx(dy)}px);opacity:0}}`,
    )
    const hx = Math.round(cols * 0.12)
    const hy = Math.round(rows * 0.12)
    let trail = a.glyph(hx, hy, '*')
    for (let k = 1; k < 10; k++) trail += `<g opacity="${fx(1 - k / 10)}">${a.glyph(hx - k, hy - Math.round(k * 0.4), '-')}</g>`
    a.add(`<g fill="#fff" style="opacity:0;animation:ss 13s linear 4s infinite">${trail}</g>`)
  }

  for (let i = 0; i < Math.max(3, Math.round(cols / 22)); i++) {
    const w = Math.min(cols, 14 + Math.floor(r() * 18))
    const h = Math.min(Math.max(2, Math.round(rows * 0.3)), 3 + Math.floor(r() * 2))
    a.def(`k${i}`, a.sprite(genCloud(r, w, h), NIGHT_CLOUD_PAL, 200 + i))
    const span = cols + w + 8
    const dur = span / (0.2 + r() * 0.5)
    const y = Math.floor(rows * 0.15 + r() * rows * 0.5)
    a.add(
      `<g style="${a.move('dx', span * c, dur, span, -r() * dur)}"><use href="#k${i}" x="${-(w + 4) * c}" y="${y * c}" opacity=".85"/></g>`,
    )
  }
}

function sakura(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.bg([[0, '#24183c'], [0.55, '#5a2a5c'], [1, '#b9587a']])

  const branch: Tile[] = []
  const blossoms: Array<[number, number, number]> = []
  const BARK = '#6a3f52'
  const grow = (sx: number, sy: number, len: number, dirX: number) => {
    let x = sx
    let y = sy
    for (let i = 0; i < len; i++) {
      x += dirX
      if (r() < 0.35) y += r() < 0.6 ? 1 : -1
      y = clamp(y, 0, Math.round(rows * 0.38))
      branch.push([x, y, BARK])
      if (i < len * 0.55) branch.push([x, y + 1, '#4f2c3d'])
      if (i > 3 && r() < 0.18) {
        let tx = x
        let ty = y
        const dy = r() < 0.5 ? -1 : 1
        const tl = 3 + Math.floor(r() * 5)
        for (let k = 0; k < tl; k++) {
          if (r() < 0.6) tx += dirX
          ty += dy
          branch.push([tx, ty, BARK])
        }
        blossoms.push([tx, ty, 1.5 + r() * 1.2])
      }
      if (r() < 0.14) blossoms.push([x, y, 1.4 + r() * 1.4])
    }
    blossoms.push([x, y, 2.2])
  }
  grow(-2, Math.round(rows * 0.12), Math.round(cols * 0.34), 1)
  grow(cols + 1, Math.round(rows * 0.06), Math.round(cols * 0.16), -1)
  const bloom: Tile[] = []
  for (const [bx, by, rad] of blossoms) {
    const R = Math.ceil(rad)
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy)
        if (d <= rad) bloom.push([bx + dx, by + dy, d < 0.8 ? '#fff2f6' : r() < 0.5 ? '#ffb7cf' : '#ff95b8'])
      }
    }
  }
  a.add(a.tiles(branch, 1))
  a.add(a.tiles(bloom, 2))

  const n = Math.max(14, Math.round((cols * rows) / 160))
  const fall = rows + 6
  for (let i = 0; i < n; i++) {
    const dur = fall / (1.2 + r() * 2.2)
    const delay = -r() * dur
    const drift = Math.round(cols * (0.15 + r() * 0.2))
    const x = Math.floor(r() * (cols + drift)) - drift
    const color = r() < 0.5 ? '#ffc4d8' : '#ff9fc0'
    a.add(
      `<g style="${a.move('dy', fall * c, dur, fall, delay)}">` +
        `<g style="${a.move('dx', drift * c, dur, drift, delay)}">` +
        `<g style="--b:${c}px;animation:sx ${fx(3 + r() * 2)}s steps(1) ${fx(-r() * 4)}s infinite">` +
        a.tiles([[x, -3, color, 0.92]], 1000 + i) +
        '</g></g></g>',
    )
  }
}

// ------------------------------------------------------------------ anime-flavoured scenes

/** Cells on a straight line, both ends included. */
function line(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) out.push([Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)])

  return out
}

/** Cells on a circle's outline. */
function ring(cx: number, cy: number, R: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let dy = -R - 1; dy <= R + 1; dy++) {
    for (let dx = -R - 1; dx <= R + 1; dx++) {
      if (Math.abs(Math.hypot(dx, dy) - R) < 0.5) out.push([cx + dx, cy + dy])
    }
  }

  return out
}

/** A dashed wire of glyphs sagging between two points. */
function wire(a: Art, x0: number, y0: number, x1: number, y1: number, sag: number, ch = '-'): string {
  let out = ''
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    const t = (x - x0) / Math.max(1, x1 - x0)
    out += a.glyph(x, Math.round(y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag), ch)
  }

  return out
}

const LANTERN = ['.K.', 'RRR', 'RWR', 'RRR', '.K.']
const LANTERN_PAL = { R: '#ff4b3a', W: '#ffe7c2', K: '#2a1a1a' }
const TREE = ['.TTT.', 'TTTTT', 'TTLTT', '.TTT.', '..B..', '..B..']
const TREE_PAL = { T: '#2f9a4a', L: '#58c46a', B: '#6b4429' }
const HOUSE = ['..RRR..', '.RRRRR.', 'RRRRRRR', '.WWDWW.', '.WWDWW.']
const HOUSE_PAL = { R: '#d9534f', W: '#fff7ea', D: '#7a4f30' }
const FLAME = [
  ['..Y..', '.YY..', '.YCY.', 'YCWCY', 'YCWCY', '.YCY.', '..Y..'],
  ['..Y..', '..YY.', '.YCY.', 'YCWCY', 'YCWCY', '.YCY.', '..Y..'],
]
const FLAME_PALS = [
  { Y: '#5b6cff', C: '#8fb4ff', W: '#e8f0ff' },
  { Y: '#a24bff', C: '#d29bff', W: '#f6e8ff' },
  { Y: '#2fb8c9', C: '#8ff0ff', W: '#eaffff' },
]

function train(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.glyphSet = KANA
  const hz = Math.round(rows * 0.62)
  const f = hz / rows
  a.bg([[0, '#2f8fe6'], [f * 0.6, '#7cc6ff'], [f, '#e2f5ff'], [f + 0.002, '#7cc463'], [1, '#3d8a3f']])

  const tw = clamp(Math.round(cols * 0.3), 8, cols - 2)
  const th = clamp(Math.round(rows * 0.46), 5, hz - 1)
  a.def('tower', a.sprite(genTower(r, tw, th), CLOUD_PAL, 3))
  a.add(`<use href="#tower" x="${Math.round(cols * 0.06) * c}" y="${(hz - th) * c}"/>`)
  for (let i = 0; i < 3; i++) {
    const w = clamp(Math.round(cols * (0.08 + r() * 0.08)), 5, 24)
    a.def(`k${i}`, a.sprite(genCloud(r, w, 3), CLOUD_PAL, 20 + i))
    const span = cols + w + 8
    const dur = span / (0.3 + r() * 0.4)
    a.add(
      `<g style="${a.move('dx', span * c, dur, span, -r() * dur)}"><use href="#k${i}" x="${-(w + 4) * c}" y="${Math.floor(1 + r() * hz * 0.4) * c}" opacity=".9"/></g>`,
    )
  }

  const hills: Tile[] = []
  for (let x = 0; x < cols; x++) {
    const h = Math.round(1 + Math.sin(x * 0.11) * 1.2 + Math.sin(x * 0.037 + 1) * 1.5)
    for (let y = hz - Math.max(0, h); y <= hz; y++) hills.push([x, y, '#4f9a48'])
  }
  a.add(a.tiles(hills, 4, false))

  const top = hz - clamp(Math.round(rows * 0.3), 3, 24)
  const gapX = clamp(Math.round(cols * 0.24), 6, 30)
  const poles: Tile[] = []
  let wires = ''
  for (let x = 2; x < cols + gapX; x += gapX) {
    for (let y = top; y <= hz; y++) poles.push([x, y, '#3a4250'])
    for (let dx = -2; dx <= 2; dx++) poles.push([x + dx, top + 1, '#3a4250'])
    wires += wire(a, x - 2, top + 1, x - 2 + gapX, top + 1, 2) + wire(a, x + 2, top + 1, x + 2 + gapX, top + 1, 2.5)
  }
  a.add(`<g fill="#2b3340" opacity=".75">${wires}</g>`)
  a.add(a.tiles(poles, 5, false))

  const railY = Math.min(rows - 3, hz + Math.max(2, Math.round((rows - hz) * 0.3)))
  a.add(
    a.tiles(
      Array.from({ length: cols }, (_, x): Tile => [x, railY + 1, '#7a7a86']).concat(
        Array.from({ length: cols }, (_, x): Tile => [x, railY + 2, '#a69a8a']),
      ),
      6,
    ),
  )

  const car = ['.WWWWWWWWWWWWWWWWWWWW.', 'WWGGGWWGGGWWGGGWWGGGWW', 'WWGGGWWGGGWWGGGWWGGGWW', 'BBBBBBBBBBBBBBBBBBBBBB', 'WWWWWWWWWWWWWWWWWWWWWW', '..KK.KK........KK.KK..']
  const cars = 3
  const body = car.map((row, y) => Array.from({ length: cars }, () => row).join(y === 2 || y === 3 ? 'D' : '.'))
  const len = nth(body, 0).length
  a.def('train', a.sprite(body, { W: '#f5f1e6', G: '#86cdf5', B: '#2f6fd6', K: '#2b2b33', D: '#555560' }, 30))
  const span = cols + len + 50
  a.add(
    `<g style="${a.move('dx', -span * c, span / 9, span, -r() * (span / 9))}"><use href="#train" x="${(cols + 4) * c}" y="${(railY - 5) * c}"/></g>`,
  )

  const blades: Tile[][] = [[], []]
  for (let x = 0; x < cols; x++) {
    if (r() < 0.3) continue
    const h = 1 + Math.floor(r() * 3)
    const lean = r() < 0.5 ? 1 : -1
    for (let s = 0; s < h; s++) {
      for (const k of [0, 1]) nth(blades, k).push([x + (s === h - 1 ? lean * k : 0), rows - 1 - s, s % 2 ? '#4fa64a' : '#3d8f3c'])
    }
  }
  a.add(`<g class="fa" style="animation-duration:2.2s">${a.tiles(nth(blades, 0), 8)}</g><g class="fb" style="animation-duration:2.2s">${a.tiles(nth(blades, 1), 8)}</g>`)

  const flowers: Tile[] = []
  for (let i = 0; i < Math.max(2, Math.round(cols / 30)); i++) {
    const fx0 = Math.floor(r() * cols * 0.6)
    const stem = 2 + Math.floor(r() * 3)
    const fy = rows - 1 - stem
    for (let s = 0; s < stem; s++) flowers.push([fx0, rows - 1 - s, '#3b8a34'])
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) flowers.push([fx0 + dx, fy - 1 + dy, '#ffcf2e'])
    flowers.push([fx0, fy - 1, '#7a4a1f'])
  }
  a.add(a.tiles(flowers, 9))

  const sx = Math.round(cols * 0.8)
  const arm = clamp(Math.round(rows * 0.06), 2, 4)
  const signTop = rows - 1 - clamp(Math.round(rows * 0.32), 5, 26)
  const sign: Tile[] = []
  for (let y = signTop; y < rows; y++) sign.push([sx, y, '#e9e9ef'])
  for (let k = -arm; k <= arm; k++) {
    const color = (k + arm) % 2 ? '#1e1e1e' : '#f2c230'
    sign.push([sx + k, signTop + arm + k, color], [sx + k, signTop + arm - k, color])
  }
  a.add(a.tiles(sign, 10))
  const lampY = signTop + arm * 2 + 2
  const lamp = (dx: number, cls: string) =>
    `<g class="${cls}" style="animation-duration:.9s">${a.glow(sx + dx + 0.5, lampY + 0.5, 3, '#ff3030', 0.55)}${a.tiles([[sx + dx, lampY, '#ff3b30']], 11)}</g>`
  a.add(a.tiles([[sx - 1, lampY, '#3a1010'], [sx + 1, lampY, '#3a1010']], 12) + lamp(-1, 'fa') + lamp(1, 'fb'))
}

function matsuri(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.glyphSet = KANA
  const hz = Math.round(rows * 0.8)
  const f = hz / rows
  a.bg([[0, '#120a2b'], [0.55, '#2d1650'], [f, '#6b2a52'], [f + 0.002, '#1a1222'], [1, '#0e0a14']])
  a.add(`<g fill="#e8dcff">${scatter(a, r, Math.round((cols * hz) / 90), 0, 0, cols, hz * 0.6, '·.')}</g>`)

  a.keyframes('@keyframes fw{0%{transform:scale(.05);opacity:0}4%{opacity:1}45%{transform:scale(1);opacity:.95}70%{opacity:.45}100%{transform:scale(1.08);opacity:0}}')
  const colors = ['#ff6b8b', '#ffd166', '#6bf0ff', '#b28cff', '#7dff9b']
  const R = clamp(Math.round(rows * 0.12), 3, 9)
  for (let i = 0; i < Math.max(3, Math.round(cols / 24)); i++) {
    const cx = Math.floor(cols * (0.1 + r() * 0.8))
    const cy = Math.floor(rows * (0.1 + r() * 0.32))
    const color = nth(colors, Math.floor(r() * colors.length))
    const sparks: Tile[] = []
    const spokes = 12
    for (let k = 0; k < spokes; k++) {
      const ang = (k / spokes) * Math.PI * 2 + r() * 0.2
      for (let d = 2; d <= R; d++) sparks.push([cx + Math.round(Math.cos(ang) * d), cy + Math.round(Math.sin(ang) * d), color, d > R - 2 ? 0.6 : 1])
    }
    a.add(
      `<g style="transform-origin:${(cx + 0.5) * c}px ${(cy + 0.5) * c}px;opacity:0;animation:fw ${fx(3.2 + r() * 1.6)}s ease-out ${fx(-r() * 5)}s infinite">` +
        a.glow(cx + 0.5, cy + 0.5, R * 1.6, color, 0.35) +
        a.tiles(sparks, 40 + i) +
        '</g>',
    )
  }

  const tw = clamp(Math.round(cols * 0.34), 9, 44)
  const th = clamp(Math.round(rows * 0.44), 6, 34)
  const cx = Math.round(cols * 0.5)
  const pw = Math.max(1, Math.round(tw * 0.06))
  const torii: Tile[] = []
  const topY = hz - th
  const halfTop = Math.floor(tw / 2)
  for (let x = cx - halfTop; x <= cx + halfTop; x++) {
    const lift = Math.abs(x - cx) >= halfTop - 1 ? 1 : 0
    torii.push([x, topY - lift, '#2a1a1a'])
    for (let k = 1; k <= pw; k++) torii.push([x, topY + k - lift, '#d8392b'])
  }
  const nukiY = topY + pw + 2 + Math.round(th * 0.18)
  const legX = Math.round(tw * 0.32)
  for (let x = cx - legX - 2; x <= cx + legX + 2; x++) torii.push([x, nukiY, '#c8322a'])
  for (let y = topY + pw + 1; y < nukiY; y++) torii.push([cx, y, '#c8322a'])
  for (const side of [-1, 1]) {
    for (let y = topY + pw + 1; y <= hz; y++) {
      for (let k = 0; k < pw; k++) torii.push([cx + side * legX + (side < 0 ? -k : k), y, '#d8392b'])
    }
  }
  a.add(a.glow(cx + 0.5, hz - th * 0.5, tw * 0.7, '#ff7a3a', 0.18))
  a.add(a.tiles(torii, 50))

  const stalls: Tile[] = []
  let warm = ''
  const sw = clamp(Math.round(cols * 0.08), 4, 10)
  for (let x = 1; x + sw < cols; x += sw + 3) {
    if (Math.abs(x + sw / 2 - cx) < legX + sw) continue
    for (let dx = 0; dx < sw; dx++) {
      stalls.push([x + dx, hz + 1, dx % 2 ? '#fff1e0' : '#e84a4a'])
      stalls.push([x + dx, hz + 2, '#ffb35a', 0.85])
      for (let y = hz + 3; y < Math.min(rows, hz + 6); y++) stalls.push([x + dx, y, '#2a1a22'])
    }
    warm += a.glow(x + sw / 2, hz + 2.5, sw * 0.8, '#ffb35a', 0.3, 'pu')
  }
  a.add(warm + a.tiles(stalls, 55))

  a.def('lan', a.sprite(LANTERN, LANTERN_PAL, 60))
  for (const [y0, sag, phase] of [[Math.round(rows * 0.16), 3, 0], [Math.round(rows * 0.3), 2.5, 4]] as const) {
    a.add(`<g fill="#3a2a2a">${wire(a, -1, y0, cols + 1, y0, sag)}</g>`)
    for (let x = 2 + phase; x < cols - 2; x += clamp(Math.round(cols / 12), 4, 11)) {
      const t = (x + 1) / (cols + 2)
      const y = Math.round(y0 + Math.sin(Math.PI * t) * sag) + 1
      a.add(
        `<g style="--b:${c}px;animation:sx ${fx(3.5 + r() * 2)}s steps(1) ${fx(-r() * 4)}s infinite">` +
          a.glow(x + 0.5, y + 2.5, 3.6, '#ff8a3a', 0.4, 'pu') +
          `<use href="#lan" x="${(x - 1) * c}" y="${y * c}"/></g>`,
      )
    }
  }
}

function meteor(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.bg([[0, '#040818'], [0.5, '#121a46'], [0.85, '#3a2a66'], [1, '#5a3a6e']])
  a.add(`<g fill="#e3e9ff">${scatter(a, r, Math.round((cols * rows) / 45), 0, 0, cols, rows * 0.8, '··.+*')}</g>`)
  let band = ''
  for (let i = 0; i < Math.round((cols * rows) / 40); i++) {
    const t = r()
    const off = (r() + r() + r() - 1.5) * rows * 0.08
    band += a.glyph(Math.floor(t * cols), Math.floor(rows * 0.7 - t * rows * 0.55 + off), r() < 0.7 ? '.' : '·')
  }
  a.add(`<g fill="#cdd6ff" opacity=".45">${band}</g>`)

  a.keyframes('@keyframes mt{0%{transform:translate(0,0);opacity:0}2%{opacity:1}12%,100%{transform:translate(var(--x),var(--y));opacity:0}}')
  for (let i = 0; i < 7; i++) {
    const hx = Math.floor(cols * (0.35 + r() * 0.7))
    const hy = Math.floor(r() * rows * 0.35)
    let trail = a.tiles([[hx, hy, '#eef4ff']], 70 + i)
    for (let k = 1; k < 9; k++) trail += `<g opacity="${fx(1 - k / 9)}">${a.glyph(hx + k, hy - Math.round(k * 0.45), '-')}</g>`
    a.add(
      `<g fill="#cfe0ff" style="--x:${fx(-cols * 0.45 * c)}px;--y:${fx(rows * 0.2 * c)}px;opacity:0;animation:mt ${fx(6 + r() * 8)}s linear ${fx(-r() * 12)}s infinite">${trail}</g>`,
    )
  }

  const city: Tile[] = []
  const lit: Tile[][] = [[], [], []]
  for (let x = 0; x < cols; ) {
    const w = 3 + Math.floor(r() * 7)
    const h = Math.round(rows * (0.06 + r() * 0.22))
    for (let y = rows - h; y < rows; y++) {
      for (let dx = 0; dx < w && x + dx < cols; dx++) {
        city.push([x + dx, y, '#0b0f2a'])
        if (y > rows - h && dx > 0 && dx < w - 1 && r() < 0.18) nth(lit, Math.floor(r() * 3)).push([x + dx, y, r() < 0.8 ? '#ffd27a' : '#9fd8ff'])
      }
    }
    x += w + (r() < 0.3 ? 1 : 0)
  }
  a.add(a.tiles(city, 0, false))
  a.keyframes('@keyframes wl{50%{opacity:.35}}')
  lit.forEach((list, k) => a.add(`<g style="animation:wl ${7 + k * 3}s ease-in-out ${-k * 2}s infinite">${a.tiles(list, 80 + k)}</g>`))

  const tx = Math.round(cols * 0.7)
  const tTop = rows - clamp(Math.round(rows * 0.45), 5, 34)
  a.add(a.tiles(line(tx, tTop, tx, rows - 1).map(([x, y]): Tile => [x, y, '#141a3a']), 0, false))
  a.add(`<g class="fa" style="animation-duration:1.6s">${a.glow(tx + 0.5, tTop + 0.5, 2.5, '#ff3b3b', 0.6)}${a.tiles([[tx, tTop, '#ff4a4a']], 90)}</g>`)
}

function neon(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  const { H } = a
  a.glyphSet = KANA
  const street = Math.round(rows * 0.8)
  a.bg([[0, '#07040f'], [0.6, '#140a26'], [street / rows, '#1c0f30'], [street / rows + 0.002, '#0b0814'], [1, '#05030a']])

  const far: Tile[] = []
  for (let x = 0; x < cols; ) {
    const w = 4 + Math.floor(r() * 6)
    const h = Math.round(rows * (0.25 + r() * 0.35))
    for (let y = street - h; y < street; y++) for (let dx = 0; dx < w; dx++) far.push([x + dx, y, '#1a1230'])
    x += w + 1
  }
  a.add(a.tiles(far, 0, false))

  const near: Tile[] = []
  const blocks = [[0, Math.round(cols * 0.22)], [Math.round(cols * 0.78), cols]] as const
  for (const [x0, x1] of blocks) {
    const h = Math.round(rows * 0.7)
    for (let y = street - h; y < street; y++) for (let x = x0; x < x1; x++) near.push([x, y, '#0e0a1a'])
  }
  a.add(a.tiles(near, 0, false))

  const colors = ['#ff3fa4', '#3ff7ff', '#ffd23f', '#9b5cff', '#ff6b3f']
  a.keyframes('@keyframes nf{0%,100%{opacity:1}3%{opacity:.25}5%{opacity:1}41%{opacity:1}42%{opacity:.35}44%{opacity:1}}')
  const signs: Array<[number, number, number, number, string]> = []
  for (let i = 0; i < 6; i++) {
    const left = i % 2 === 0
    const [x0, x1] = nth(blocks, left ? 0 : 1)
    const w = r() < 0.3 ? 2 : 1
    const h = clamp(Math.round(rows * (0.08 + r() * 0.08)), 3, 12)
    const sx = left ? x1 - 2 - Math.floor(r() * Math.max(1, (x1 - x0) * 0.6)) : x0 + 1 + Math.floor(r() * Math.max(1, (x1 - x0) * 0.6))
    const sy = Math.round(street - rows * (0.2 + r() * 0.4))
    signs.push([sx, sy, w, h, nth(colors, i % colors.length)])
  }
  signs.push([Math.round(cols * 0.4), Math.round(street - rows * 0.18), clamp(Math.round(cols * 0.12), 4, 16), 1, '#3ff7ff'])
  signs.forEach(([sx, sy, w, h, color], i) => {
    const list: Tile[] = []
    for (let y = sy; y < sy + h; y++) for (let dx = 0; dx < w; dx++) list.push([sx + dx, y, color])
    const reflect: Tile[] = []
    for (let k = 0; k < Math.min(rows - street - 1, 6); k++) for (let dx = 0; dx < w; dx++) if ((k + dx) % 2 === 0) reflect.push([sx + dx, street + 1 + k, color, Math.max(0.05, Math.round((0.28 - k * 0.04) * 100) / 100)])
    a.add(
      `<g style="animation:nf ${fx(4 + r() * 5)}s ${fx(-r() * 6)}s infinite">` +
        a.glow(sx + w / 2, sy + h / 2, Math.max(w, h) * 0.9 + 2, color, 0.32) +
        a.tiles(list, 100 + i) +
        a.tiles(reflect, 0, false) +
        '</g>',
    )
  })

  a.def('rain', `<g fill="#9fd8ff" opacity=".35">${scatter(a, r, Math.round((cols * rows) / 16), 0, 0, cols, rows, '||:')}</g>`)
  a.add(`<g style="--d:${H}px;animation:dy 1.7s linear infinite"><use href="#rain" y="${-H}"/><use href="#rain"/></g>`)
  if (a.o.glyphs) a.add(`<g fill="#bfe8ff" opacity=".5">${scatter(a, r, Math.round(cols / 3), 0, street + 1, cols, rows - street - 1, 'o.')}</g>`)
}

function sky(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.bg([[0, '#3aa0ff'], [0.6, '#8fd3ff'], [1, '#e8f8ff']])
  a.add(a.glow(cols * 0.15, rows * 0.12, Math.max(cols, rows) * 0.3, '#fff6d8', 0.5, 'pu'))

  const island = (w: number, depth: number, seed: number, house: boolean, fall: boolean) => {
    const list: Tile[] = []
    for (let x = 1; x < w - 1; x++) list.push([x, 0, '#5bd16a'])
    for (let x = 0; x < w; x++) list.push([x, 1, '#3fae55'])
    for (let k = 0; k < depth; k++) {
      const hw = (w / 2) * Math.pow(1 - (k + 1) / (depth + 1), 0.8) + (r() - 0.5) * 1.2
      for (let x = Math.round(w / 2 - hw); x <= Math.round(w / 2 + hw); x++) {
        list.push([x, 2 + k, k < depth * 0.35 ? '#9a6a43' : r() < 0.15 ? '#8c8c96' : k < depth * 0.7 ? '#7a4f30' : '#5e3a22'])
      }
    }
    const trees = Math.max(1, Math.round(w / 9))
    for (let i = 0; i < trees; i++) {
      const tx = 1 + Math.floor(r() * Math.max(1, w - 6))
      TREE.forEach((row, y) => [...row].forEach((k, x) => {
        const color = (TREE_PAL as Record<string, string>)[k]
        if (color) list.push([tx + x, y - TREE.length, color])
      }))
    }
    if (house) {
      const hx = Math.round(w * 0.55)
      HOUSE.forEach((row, y) => [...row].forEach((k, x) => {
        const color = (HOUSE_PAL as Record<string, string>)[k]
        if (color) list.push([hx + x, y - HOUSE.length, color])
      }))
    }
    let water = ''
    if (fall) {
      const wx = Math.round(w * 0.78)
      const frame = (k: number) => {
        const drops: Tile[] = []
        for (let y = 2; y < rows + 4; y++) for (let dx = 0; dx < 2; dx++) drops.push([wx + dx, y, (y + dx + k) % 2 ? '#bfe9ff' : '#e8f8ff', y > rows * 0.6 ? 0.6 : 0.95])
        return a.tiles(drops, 200 + seed)
      }
      water = `<g class="fa" style="animation-duration:.5s">${frame(0)}</g><g class="fb" style="animation-duration:.5s">${frame(1)}</g>`
    }

    return water + a.tiles(list, seed)
  }

  const specs = [
    { w: clamp(Math.round(cols * 0.3), 8, 40), d: clamp(Math.round(rows * 0.2), 3, 15), x: 0.48, y: 0.32, house: true, fall: true },
    { w: clamp(Math.round(cols * 0.16), 6, 22), d: clamp(Math.round(rows * 0.12), 2, 9), x: 0.1, y: 0.5, house: false, fall: false },
    { w: clamp(Math.round(cols * 0.1), 5, 14), d: clamp(Math.round(rows * 0.08), 2, 6), x: 0.8, y: 0.18, house: false, fall: false },
  ]
  specs.forEach((s, i) => {
    a.def(`is${i}`, island(s.w, s.d, 150 + i * 10, s.house, s.fall))
    a.add(
      `<g style="--b:${-c}px;animation:bob ${fx(4 + r() * 3)}s steps(1) ${fx(-r() * 4)}s infinite"><use href="#is${i}" x="${Math.round(cols * s.x) * c}" y="${Math.round(rows * s.y) * c}"/></g>`,
    )
  })

  for (let i = 0; i < Math.max(4, Math.round(cols / 16)); i++) {
    const w = clamp(Math.round(cols * (0.15 + r() * 0.15)), 6, 40)
    const h = clamp(Math.round(rows * 0.1), 3, 8)
    a.def(`sea${i}`, a.sprite(genCloud(r, w, h), CLOUD_PAL, 300 + i))
    const span = cols + w + 8
    const dur = span / (0.25 + r() * 0.5)
    a.add(
      `<g style="${a.move('dx', span * c, dur, span, -r() * dur)}"><use href="#sea${i}" x="${-(w + 4) * c}" y="${Math.round(rows * (0.72 + r() * 0.2)) * c}"/></g>`,
    )
  }

  if (a.o.glyphs) {
    for (let i = 0; i < 5; i++) {
      const span = cols + 10
      const dur = span / 2.2
      const y = Math.round(rows * 0.12 + (i % 2) * 1 + i)
      const flap = `style="animation-duration:${fx(0.4 + r() * 0.2)}s"`
      a.add(
        `<g fill="#24496e" style="${a.move('dx', span * c, dur, span, -dur * 0.3 - i * 0.6)}">` +
          a.glyph(-5 - i * 2, y, 'v', 'fa').replace('<text', `<text ${flap}`) +
          a.glyph(-5 - i * 2, y, '^', 'fb').replace('<text', `<text ${flap}`) +
          '</g>',
      )
    }
  }
}

function sigil(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  const { H } = a
  a.bg([[0, '#07061a'], [0.6, '#120a30'], [1, '#05040f']])
  a.add(`<g fill="#b9b2ff">${scatter(a, r, Math.round((cols * rows) / 70), 0, 0, cols, rows, '·.')}</g>`)

  const cx = Math.round(cols / 2)
  const cy = Math.round(rows / 2)
  const R = clamp(Math.round(rows * 0.36), 6, 30)
  const origin = `transform-origin:${(cx + 0.5) * c}px ${(cy + 0.5) * c}px`
  a.add(a.glow(cx + 0.5, cy + 0.5, R * 1.5, '#7a5cff', 0.4, 'pu'))

  const outer = ring(cx, cy, R).map(([x, y]): Tile => [x, y, '#5ff3ff', 0.85])
    .concat(ring(cx, cy, R - 2).map(([x, y]): Tile => [x, y, '#3aa8c8', 0.7]))
  let runes = ''
  const n = Math.max(12, Math.round(R * 3.4))
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2
    runes += a.glyph(cx + Math.cos(ang) * (R - 1), cy + Math.sin(ang) * (R - 1), nth([...GLYPHS], Math.floor(r() * GLYPHS.length)))
  }
  a.add(`<g style="${origin};--r:360deg;animation:rot 60s linear infinite">${a.tiles(outer, 400)}<g fill="#bff8ff">${runes}</g></g>`)

  const mid = Math.round(R * 0.68)
  const midTiles = ring(cx, cy, mid).map(([x, y]): Tile => [x, y, '#a77bff', 0.85])
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2
    for (const [x, y] of disk(cx + Math.round(Math.cos(ang) * mid), cy + Math.round(Math.sin(ang) * mid), 1, () => '#d9c7ff')) midTiles.push([x, y, '#d9c7ff'])
  }
  a.add(`<g style="${origin};--r:-360deg;animation:rot 40s linear infinite">${a.tiles(midTiles, 410)}</g>`)

  const inner = Math.round(R * 0.5)
  const star: Tile[] = []
  for (const rot of [0, Math.PI / 4]) {
    const pts = [0, 1, 2, 3].map(k => [cx + Math.round(Math.cos(rot + (k * Math.PI) / 2) * inner), cy + Math.round(Math.sin(rot + (k * Math.PI) / 2) * inner)] as const)
    for (let k = 0; k < 4; k++) {
      const p = nth(pts, k)
      const q = nth(pts, (k + 1) % 4)
      for (const [x, y] of line(p[0], p[1], q[0], q[1])) star.push([x, y, '#ffe38a', 0.9])
    }
  }
  a.add(`<g style="${origin};--r:360deg;animation:rot 90s linear infinite">${a.tiles(star, 420)}</g>`)
  a.add(a.tiles(disk(cx, cy, 1, () => '#ffffff'), 430))

  a.def('sp', `<g fill="#8ff0ff" opacity=".6">${scatter(a, r, Math.round((cols * rows) / 90), cx - R, 0, R * 2, rows, '·*+')}</g>`)
  a.add(`<g style="--d:${-H}px;animation:dy 14s linear infinite"><use href="#sp"/><use href="#sp" y="${H}"/></g>`)
}

function wisp(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  a.bg([[0, '#05040c'], [0.6, '#120a1c'], [1, '#1f0f22']])
  a.add(`<g fill="#d8c8ff">${scatter(a, r, Math.round((cols * rows) / 120), 0, 0, cols, rows * 0.5, '·.')}</g>`)

  const bamboo: Tile[] = []
  for (const [x0, x1] of [[0, Math.round(cols * 0.18)], [Math.round(cols * 0.84), cols]] as const) {
    for (let x = x0; x < x1; x += 2 + Math.floor(r() * 3)) {
      const top = Math.floor(r() * rows * 0.25)
      for (let y = top; y < rows; y++) bamboo.push([x, y, (y - top) % 6 === 5 ? '#0a1810' : '#11261a'])
      for (let k = 0; k < 3; k++) {
        const ly = top + 2 + Math.floor(r() * (rows - top - 4))
        const dir = r() < 0.5 ? -1 : 1
        for (let s = 1; s <= 3; s++) bamboo.push([x + dir * s, ly - Math.floor(s / 2), '#132e1e'])
      }
    }
  }
  a.add(a.tiles(bamboo, 0, false))

  for (let k = 0; k < 3; k++) {
    let mist = ''
    const y0 = rows * (0.7 + k * 0.1)
    for (let x = 0; x < cols; x += 2) {
      if (r() < 0.4) continue
      const y = Math.round(y0 + Math.sin((x / cols) * Math.PI * 6) * 1.2)
      mist += a.glyph(x, y, '~') + a.glyph(x - cols, y, '~')
    }
    const span = cols
    a.add(`<g fill="#b7a8e0" opacity="${fx(0.18 + k * 0.06)}" style="${a.move('dx', span * c, 40 + k * 15, 0, -r() * 40)}">${mist}</g>`)
  }

  FLAME_PALS.forEach((pal, i) => {
    a.def(`fl${i}a`, a.sprite(nth(FLAME, 0), pal, 500 + i))
    a.def(`fl${i}b`, a.sprite(nth(FLAME, 1), pal, 500 + i))
  })
  const n = Math.max(5, Math.round(cols / 14))
  for (let i = 0; i < n; i++) {
    const pi = i % FLAME_PALS.length
    const x = Math.floor(cols * (0.15 + r() * 0.7))
    const y = Math.floor(rows * (0.2 + r() * 0.55))
    const pt = () => `translate(${fx((r() - 0.5) * 10 * c)}px,${fx((r() - 0.5) * 6 * c)}px)`
    a.keyframes(`@keyframes wf${i}{25%{transform:${pt()}}50%{transform:${pt()}}75%{transform:${pt()}}}`)
    const color = nth(FLAME_PALS, pi).Y
    const flick = `style="animation-duration:${fx(0.35 + r() * 0.25)}s"`
    a.add(
      `<g style="animation:wf${i} ${fx(16 + r() * 12)}s ease-in-out ${fx(-r() * 20)}s infinite">` +
        a.glow(x + 2.5, y + 4, 6, color, 0.38, 'pu') +
        `<use class="fa" ${flick} href="#fl${pi}a" x="${x * c}" y="${y * c}"/>` +
        `<use class="fb" ${flick} href="#fl${pi}b" x="${x * c}" y="${y * c}"/></g>`,
    )
  }
}

function blade(a: Art, r: Rand) {
  const { cols, rows } = a.o
  const c = a.c
  const { H } = a
  a.bg([[0, '#12030a'], [0.55, '#3a0812'], [1, '#14060c']])

  const R = clamp(Math.round(rows * 0.2), 4, 16)
  const mx = Math.round(cols * 0.62)
  const my = Math.round(rows * 0.34)
  a.add(a.glow(mx + 0.5, my + 0.5, R * 3.2, '#ff2a40', 0.45, 'pu'))
  a.add(a.tiles(disk(mx, my, R, (d, dx, dy) => (hash2(dx + 3, dy + 7) % 9 === 0 ? '#9e1a2c' : d > R - 1 ? '#b3203a' : '#d8304a')), 600))

  const roofs: Tile[] = []
  let x = 0
  while (x < cols) {
    const w = 8 + Math.floor(r() * 10)
    const base = rows - 1 - Math.round(rows * (0.06 + r() * 0.12))
    const peak = Math.max(2, Math.round(w * 0.3))
    for (let dx = 0; dx < w; dx++) {
      const t = Math.abs(dx - w / 2) / (w / 2)
      const top = base - Math.round(peak * (1 - t * t))
      for (let y = top; y < rows; y++) roofs.push([x + dx, y, y === top ? '#1c0a10' : '#0b0508'])
    }
    x += w
  }
  a.add(a.tiles(roofs, 0, false))

  a.keyframes('@keyframes sl{0%,100%{opacity:0}1%{opacity:1}7%{opacity:0}}')
  for (let i = 0; i < 4; i++) {
    const x0 = Math.floor(r() * cols * 0.4)
    const y0 = Math.floor(r() * rows * 0.6)
    const x1 = x0 + Math.round(cols * (0.4 + r() * 0.4))
    const y1 = y0 + Math.round((r() - 0.3) * rows * 0.5)
    const pts = line(x0, y0, x1, y1)
    const tiles = pts.map(([px, py], k): Tile => [px, py, k > pts.length * 0.15 && k < pts.length * 0.85 ? '#ffffff' : '#ffc6d0', 0.95])
    a.add(`<g style="opacity:0;animation:sl ${fx(4 + r() * 5)}s ${fx(-r() * 8)}s infinite">${a.tiles(tiles, 610 + i)}</g>`)
  }

  a.def('em', `<g fill="#ff8a4a" opacity=".7">${scatter(a, r, Math.round((cols * rows) / 60), 0, 0, cols, rows, '·*.')}</g>`)
  a.add(`<g style="--d:${-H}px;animation:dy 22s linear infinite"><use href="#em"/><use href="#em" y="${H}"/></g>`)
}

const BUILDERS: Record<SceneId, (a: Art, r: Rand) => void> = {
  cloud, lagoon, koi, jelly, boats, fireflies, moon, sakura, train, matsuri, meteor, neon, sky, sigil, wisp, blade,
}
const SEEDS: Record<SceneId, number> = {
  cloud: 11, lagoon: 23, koi: 37, jelly: 41, boats: 53, fireflies: 67, moon: 79, sakura: 83,
  train: 97, matsuri: 101, meteor: 113, neon: 127, sky: 131, sigil: 139, wisp: 149, blade: 157,
}

export function isSceneId(value: string): value is SceneId {
  return value in BUILDERS
}

export function sceneSvg(id: SceneId, o: SceneOptions): string {
  const art = new Art(o)
  BUILDERS[id](art, rng(SEEDS[id] * 7919 + o.cols))

  return art.render()
}
