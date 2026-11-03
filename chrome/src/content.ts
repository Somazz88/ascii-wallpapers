// ASCII Wallpapers for claude.ai: the same sixteen scenes as the Claude Code
// plugin, painted behind the chat. Type /theme (or /wallpaper) in the message
// box, press Alt+T, or click the toolbar button.

import { SCENES, isSceneId, sceneSvg } from '../../hooks/scenes'
import type { SceneId } from '../../hooks/scenes'

type Choice = SceneId | 'off'
type Intensity = 'soft' | 'normal' | 'vivid'
type Saved = { scene: Choice; intensity: Intensity }

declare const chrome: {
  storage?: { local?: { get(key: string): Promise<Record<string, unknown>>; set(v: Record<string, unknown>): Promise<void> } }
  runtime?: { onMessage?: { addListener(fn: (m: unknown) => void): void; removeListener(fn: (m: unknown) => void): void } }
} | undefined

type Api = { set(choice: Choice): void; open(): void; destroy(): void }
declare global {
  interface Window {
    __asciiWallpaper?: Api
  }
}

const STORE_KEY = 'asciiWallpaper.v2'
const LOOKS: Record<Intensity, { zh: string; veil: number }> = {
  soft: { zh: '柔和', veil: 0.6 },
  normal: { zh: '标准', veil: 0.42 },
  vivid: { zh: '鲜艳', veil: 0.22 },
}
const LOOK_ORDER: readonly Intensity[] = ['soft', 'normal', 'vivid']
const CARDS: ReadonlyArray<{ id: Choice; zh: string; en: string }> = [{ id: 'off', zh: '关闭', en: 'Off' }, ...SCENES]
const HOTKEYS = [...'0123456789abcdefg']
const FONT = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
const html = document.documentElement

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const svgUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
const nameOf = (id: Choice) => CARDS.find(card => card.id === id)?.zh ?? id

function parseColor(s: string | null | undefined): number[] | null {
  if (!s) return null
  s = s.trim()
  let m = s.match(/^rgba?\(([^)]+)\)/)
  if (m && m[1]) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat)
    return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p.length > 3 ? (p[3] ?? 1) : 1]
  }
  m = s.match(/^color\(srgb\s+([^)]+)\)/)
  if (m && m[1]) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map(parseFloat)
    return [(p[0] ?? 0) * 255, (p[1] ?? 0) * 255, (p[2] ?? 0) * 255, p.length > 3 ? (p[3] ?? 1) : 1]
  }
  m = s.match(/^#([0-9a-f]{6})$/i)
  if (m && m[1]) {
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }

  return null
}

/** Reads `/theme <words>`: a scene, an intensity, `off`, or nothing (open the picker). */
function parse(args: string): { choice?: Choice; look?: Intensity } | null {
  const q = args.trim().toLowerCase().replace(/\s+/g, '')
  if (!q) return {}
  if (['off', 'none', 'clear', '关', '关闭'].includes(q)) return { choice: 'off' }
  for (const look of LOOK_ORDER) if (q === look || q === LOOKS[look].zh) return { look }
  const hit = SCENES.find(s => {
    const en = s.en.toLowerCase().replace(/\s+/g, '')
    return q === s.id || q === en || q === s.zh || s.id.startsWith(q) || en.startsWith(q) || s.zh.startsWith(q)
  })

  return hit ? { choice: hit.id } : null
}

const COMMAND = /^\/(theme|wallpaper)(?:\s+(.*))?$/i

function boot() {
  window.__asciiWallpaper?.destroy()

  // ------------------------------------------------------------ storage
  const hasChromeStore = () => {
    try {
      return typeof chrome !== 'undefined' && !!chrome?.storage?.local
    } catch {
      return false
    }
  }
  const store = {
    async get(): Promise<Partial<Saved> | null> {
      try {
        if (hasChromeStore()) return ((await chrome!.storage!.local!.get(STORE_KEY))[STORE_KEY] as Partial<Saved>) ?? null
      } catch {}
      try {
        return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Saved> | null
      } catch {
        return null
      }
    },
    async set(v: Saved) {
      try {
        if (hasChromeStore()) return void (await chrome!.storage!.local!.set({ [STORE_KEY]: v }))
      } catch {}
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(v))
      } catch {}
    },
  }

  // ------------------------------------------------------------ page see-through
  const style = document.createElement('style')
  style.id = 'aw-style'
  style.textContent = `
html.aw-on, html.aw-on body { background: transparent !important; }
html.aw-on [data-aw-clear] { background-color: transparent !important; }
html.aw-on [data-aw-clearimg] { background-image: none !important; }
html.aw-on [data-aw-frost] { background-color: color-mix(in srgb, var(--cds-surface-1, #191919) 45%, transparent) !important; backdrop-filter: blur(14px) saturate(1.15); }
html.aw-on aside.dframe-sidebar { background-color: color-mix(in srgb, var(--cds-surface-2, #1f1f1f) 72%, transparent) !important; backdrop-filter: blur(18px) saturate(1.2); }
html.aw-on .bg-surface-3 { background-color: color-mix(in srgb, var(--cds-surface-3, #2a2a2a) 86%, transparent) !important; backdrop-filter: blur(12px); }
#aw-layer { position: fixed; inset: 0; z-index: -1; pointer-events: none; display: none; }
#aw-layer img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#aw-layer div { position: absolute; inset: 0; }
`
  ;(document.head || html).appendChild(style)

  const layer = document.createElement('div')
  layer.id = 'aw-layer'
  layer.setAttribute('aria-hidden', 'true')
  const art = document.createElement('img')
  art.alt = ''
  art.decoding = 'async'
  const veil = document.createElement('div')
  layer.append(art, veil)
  html.appendChild(layer)

  let base = [25, 25, 25]
  const SKIP = '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-radix-popper-content-wrapper],#aw-picker-host,#aw-layer'
  const readBase = () => {
    const c = parseColor(getComputedStyle(html).getPropertyValue('--cds-surface-1'))
    if (c) return c.slice(0, 3)
    const b = parseColor(getComputedStyle(document.body).backgroundColor)

    return b && b[3]! > 0.5 ? b.slice(0, 3) : html.dataset.mode === 'light' ? [250, 249, 245] : [25, 25, 25]
  }
  const near = (c: number[]) => Math.abs(c[0]! - base[0]!) + Math.abs(c[1]! - base[1]!) + Math.abs(c[2]! - base[2]!) <= 6
  function check(el: Element) {
    if (el.id === 'aw-layer' || el.id === 'aw-picker-host') return
    if (el.hasAttribute('data-aw-clear') || el.hasAttribute('data-aw-frost')) return
    if (el.matches('aside.dframe-sidebar')) return
    const cs = getComputedStyle(el)
    const bg = parseColor(cs.backgroundColor)
    if (bg && bg[3]! > 0.3 && near(bg) && !el.closest(SKIP)) el.setAttribute(bg[3]! < 0.99 ? 'data-aw-frost' : 'data-aw-clear', '')
    const bi = cs.backgroundImage
    if (bi && bi !== 'none' && bi.includes('gradient') && bi.includes(`${Math.round(base[0]!)}, ${Math.round(base[1]!)}, ${Math.round(base[2]!)}`) && !el.closest(SKIP)) {
      el.setAttribute('data-aw-clearimg', '')
    }
  }
  const fullSweep = () => {
    if (!document.body) return
    check(document.body)
    document.body.querySelectorAll('*').forEach(check)
  }
  const unmarkAll = () =>
    document.querySelectorAll('[data-aw-clear],[data-aw-frost],[data-aw-clearimg]').forEach(el => {
      el.removeAttribute('data-aw-clear')
      el.removeAttribute('data-aw-frost')
      el.removeAttribute('data-aw-clearimg')
    })

  const pending = new Set<Element>()
  let sweepTimer = 0
  const mo = new MutationObserver(recs => {
    if (!html.classList.contains('aw-on')) return
    for (const rec of recs) rec.addedNodes.forEach(n => n.nodeType === 1 && pending.add(n as Element))
    if (pending.size && !sweepTimer) {
      sweepTimer = window.setTimeout(() => {
        sweepTimer = 0
        const list = [...pending]
        pending.clear()
        for (const n of list) {
          if (!n.isConnected) continue
          check(n)
          n.querySelectorAll('*').forEach(check)
        }
      }, 120)
    }
  })
  mo.observe(document.body || html, { childList: true, subtree: true })

  let baseKey = ''
  const resweep = () => {
    html.classList.remove('aw-on')
    unmarkAll()
    base = readBase()
    baseKey = base.map(Math.round).join(',')
    fullSweep()
    html.classList.add('aw-on')
    paintVeil()
  }
  const modeObs = new MutationObserver(() => {
    if (!html.classList.contains('aw-on')) return
    if (readBase().map(Math.round).join(',') !== baseKey) resweep()
  })
  modeObs.observe(html, { attributes: true, attributeFilter: ['data-mode', 'data-theme', 'class', 'style'] })
  const periodic = window.setInterval(() => {
    if (html.classList.contains('aw-on') && !document.hidden) fullSweep()
  }, 4000)

  // ------------------------------------------------------------ wallpaper
  let state: Saved = { scene: 'off', intensity: 'normal' }
  let previewKey: Choice | null = null
  const cache = new Map<string, string>()
  let drawnKey = ''

  const gridSize = () => ({
    cols: clamp(Math.round(window.innerWidth / 15), 40, 200),
    rows: clamp(Math.round(window.innerHeight / 15), 25, 140),
  })
  function wallpaper(id: SceneId): string {
    const { cols, rows } = gridSize()
    const key = `${id}:${cols}x${rows}`
    let url = cache.get(key)
    if (!url) {
      url = svgUrl(sceneSvg(id, { cols, rows, cell: 16, glyphs: true, scrim: 0 }))
      cache.set(key, url)
    }

    return url
  }
  function paintVeil() {
    veil.style.background = `rgba(${base.map(v => Math.round(v)).join(',')},${LOOKS[state.intensity].veil})`
  }
  function sync() {
    const k = previewKey ?? state.scene
    if (k === 'off' || !isSceneId(k)) {
      layer.style.display = 'none'
      art.removeAttribute('src')
      drawnKey = ''
      if (html.classList.contains('aw-on')) {
        html.classList.remove('aw-on')
        unmarkAll()
      }
      return
    }
    const { cols, rows } = gridSize()
    const key = `${k}:${cols}x${rows}`
    if (key !== drawnKey) {
      art.src = wallpaper(k)
      drawnKey = key
    }
    if (!html.classList.contains('aw-on')) resweep()
    paintVeil()
    layer.style.display = 'block'
  }
  let resizeTimer = 0
  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      sync()
      if (picker.open) place()
    }, 300)
  }
  window.addEventListener('resize', onResize)

  // ------------------------------------------------------------ picker
  const host = document.createElement('div')
  host.id = 'aw-picker-host'
  Object.assign(host.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '2147483000', display: 'none' })
  html.appendChild(host)
  const root = host.attachShadow({ mode: 'open' })
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (text != null) e.textContent = text
    return e
  }
  const pstyle = el('style')
  pstyle.textContent = `
:host { all: initial; }
.panel { position: fixed; box-sizing: border-box; padding: 12px 12px 10px; border-radius: 16px; background: rgba(22,22,26,.95); border: 1px solid rgba(255,255,255,.09); box-shadow: 0 18px 50px rgba(0,0,0,.45); color: #ececec; font: 13px/1.35 ${FONT}; backdrop-filter: blur(16px); }
.head { display: flex; align-items: center; gap: 8px; margin: 0 2px 10px; }
.cmd { font: 600 12px/1 ui-monospace, Menlo, Consolas, monospace; padding: 4px 7px; border-radius: 6px; background: rgba(255,255,255,.08); color: #fff; }
.ttl { font-weight: 600; }
.hint { margin-left: auto; color: rgba(255,255,255,.5); font-size: 12px; white-space: nowrap; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; max-height: 50vh; overflow-y: auto; padding: 2px; }
.tile { padding: 0; border: 0; background: none; color: inherit; cursor: pointer; text-align: center; font: inherit; }
.thumb { display: block; width: 100%; aspect-ratio: 8 / 5; border-radius: 9px; outline: 2px solid transparent; outline-offset: 1px; transition: outline-color .12s, transform .12s; background: #26262b; object-fit: cover; }
.tile:hover .thumb { transform: translateY(-1px); }
.tile.sel .thumb { outline-color: #fff; }
.name { display: block; margin-top: 5px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(255,255,255,.85); }
.key { color: rgba(255,255,255,.45); margin-right: 4px; font-family: ui-monospace, Menlo, Consolas, monospace; }
.tile.on .name::after { content: " ✓"; color: #7ee2a8; }
.foot { display: flex; align-items: center; gap: 6px; margin: 10px 2px 0; color: rgba(255,255,255,.55); font-size: 12px; }
.chip { border: 1px solid rgba(255,255,255,.12); background: transparent; color: rgba(255,255,255,.75); border-radius: 999px; padding: 3px 10px; font: inherit; cursor: pointer; }
.chip.act { background: rgba(255,255,255,.14); color: #fff; border-color: rgba(255,255,255,.25); }
.sp { flex: 1; }
.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: 8px 14px; border-radius: 999px; background: rgba(22,22,26,.92); color: #fff; font: 13px/1.2 ${FONT}; box-shadow: 0 8px 24px rgba(0,0,0,.35); opacity: 0; transition: opacity .2s; pointer-events: none; }
.toast.show { opacity: 1; }
@media (max-width: 560px) { .hint { display: none; } }
`
  root.appendChild(pstyle)
  const panel = el('div', 'panel')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'ASCII 壁纸')
  panel.style.display = 'none'
  const head = el('div', 'head')
  head.append(el('span', 'cmd', '/theme'), el('span', 'ttl', 'ASCII 壁纸'), el('span', 'hint', '方向键选择 · Enter 应用 · Esc 关闭'))
  const grid = el('div', 'grid')
  const foot = el('div', 'foot')
  foot.append(el('span', null as unknown as undefined, '强度'))
  const chips: Partial<Record<Intensity, HTMLButtonElement>> = {}
  for (const k of LOOK_ORDER) {
    const b = el('button', 'chip', LOOKS[k].zh)
    b.type = 'button'
    b.addEventListener('mousedown', e => e.preventDefault())
    b.addEventListener('click', () => setLook(k))
    chips[k] = b
    foot.append(b)
  }
  foot.append(el('span', 'sp'), el('span', undefined, 'Alt+T 也能打开'))
  panel.append(head, grid, foot)
  const toast = el('div', 'toast')
  root.append(panel, toast)

  const picker = { open: false, viaText: false, sel: 0, tiles: [] as HTMLButtonElement[], thumbs: [] as HTMLImageElement[] }
  CARDS.forEach((card, i) => {
    const b = el('button', 'tile')
    b.type = 'button'
    b.title = `${card.zh} · ${card.en}`
    const img = el('img', 'thumb')
    img.alt = ''
    const name = el('span', 'name')
    name.append(el('span', 'key', HOTKEYS[i] ?? ''), document.createTextNode(card.zh))
    b.append(img, name)
    b.addEventListener('mousedown', e => e.preventDefault())
    b.addEventListener('mouseenter', () => select(i, false))
    b.addEventListener('click', () => {
      select(i, false)
      applySel()
    })
    grid.append(b)
    picker.tiles.push(b)
    picker.thumbs.push(img)
  })
  const OFF_THUMB = svgUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 120"><rect width="192" height="120" fill="#2a2a2e"/><text x="96" y="70" fill="#8a8a92" font-family="monospace" font-size="28" text-anchor="middle">—</text></svg>',
  )
  let thumbsDrawn = false
  function drawThumbs() {
    if (thumbsDrawn) return
    thumbsDrawn = true
    CARDS.forEach((card, i) => {
      const img = picker.thumbs[i]
      if (!img) return
      img.src = card.id === 'off' ? OFF_THUMB : svgUrl(sceneSvg(card.id, { cols: 24, rows: 15, cell: 8, glyphs: false, scrim: 0 }))
    })
  }
  const refreshChips = () => LOOK_ORDER.forEach(k => chips[k]?.classList.toggle('act', state.intensity === k))
  const refreshTiles = () =>
    picker.tiles.forEach((b, i) => {
      b.classList.toggle('sel', i === picker.sel)
      b.classList.toggle('on', CARDS[i]?.id === state.scene)
    })

  const findComposer = () =>
    document.querySelector<HTMLElement>('.ProseMirror[contenteditable="true"]') ?? document.querySelector<HTMLElement>('[contenteditable="true"]')
  function place() {
    const w = Math.min(760, window.innerWidth - 24)
    panel.style.width = w + 'px'
    const ed = findComposer()
    const box = ed?.closest('fieldset') ?? ed?.parentElement?.parentElement ?? null
    const ph = panel.offsetHeight || 260
    if (box) {
      const r = box.getBoundingClientRect()
      const left = clamp(r.left + r.width / 2 - w / 2, 12, window.innerWidth - w - 12)
      let top = r.top - ph - 12
      if (top < 10) top = Math.min(r.bottom + 12, window.innerHeight - ph - 10)
      panel.style.left = left + 'px'
      panel.style.top = top + 'px'
    } else {
      panel.style.left = (window.innerWidth - w) / 2 + 'px'
      panel.style.top = Math.max(10, window.innerHeight - ph - 140) + 'px'
    }
  }
  function select(i: number, scroll = true) {
    picker.sel = (i + CARDS.length) % CARDS.length
    refreshTiles()
    previewKey = CARDS[picker.sel]?.id ?? null
    sync()
    if (scroll) picker.tiles[picker.sel]?.scrollIntoView({ block: 'nearest' })
  }
  function openPicker(viaText: boolean) {
    drawThumbs()
    picker.open = true
    picker.viaText = viaText
    picker.sel = Math.max(0, CARDS.findIndex(c => c.id === state.scene))
    host.style.display = 'block'
    panel.style.display = 'block'
    refreshChips()
    refreshTiles()
    place()
    requestAnimationFrame(place)
  }
  function closePicker(revert: boolean) {
    if (!picker.open) return
    picker.open = false
    panel.style.display = 'none'
    if (!toast.classList.contains('show')) host.style.display = 'none'
    if (revert) {
      previewKey = null
      sync()
    }
    if (picker.viaText) clearComposer()
    picker.viaText = false
  }
  function choose(choice: Choice) {
    state = { ...state, scene: choice }
    previewKey = null
    void store.set(state)
    sync()
    showToast(choice === 'off' ? '壁纸已关闭' : `壁纸：${nameOf(choice)}`)
  }
  function setLook(look: Intensity) {
    state = { ...state, intensity: look }
    void store.set(state)
    refreshChips()
    paintVeil()
  }
  function applySel() {
    const card = CARDS[picker.sel]
    if (card) choose(card.id)
    closePicker(false)
  }
  let toastTimer = 0
  function showToast(msg: string) {
    toast.textContent = msg
    host.style.display = 'block'
    toast.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('show')
      window.setTimeout(() => {
        if (!picker.open) host.style.display = 'none'
      }, 220)
    }, 1600)
  }
  function clearComposer() {
    try {
      const ed = findComposer()
      if (!ed || !COMMAND.test((ed.innerText || '').trim())) return
      ed.focus()
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(ed)
      sel?.removeAllRanges()
      sel?.addRange(range)
      document.execCommand('delete', false)
    } catch {}
  }

  // ------------------------------------------------------------ input
  const stop = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }
  const composerText = (target: EventTarget | null) => {
    const ed = target instanceof Element ? target.closest('[contenteditable="true"]') : null
    return ed ? ((ed as HTMLElement).innerText || '').trim() : null
  }
  function onKey(e: KeyboardEvent) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyT') {
      stop(e)
      if (picker.open) closePicker(true)
      else openPicker(false)
      return
    }
    if (e.isComposing) return
    // "/theme sky" + Enter: switch without sending a message.
    if (e.key === 'Enter' && !e.shiftKey) {
      const text = composerText(e.target)
      const m = text ? text.match(COMMAND) : null
      if (m) {
        const asked = parse(m[2] ?? '')
        if (asked && (asked.choice || asked.look)) {
          stop(e)
          if (asked.look) {
            setLook(asked.look)
            showToast(`壁纸强度：${LOOKS[asked.look].zh}`)
          }
          if (asked.choice) choose(asked.choice)
          picker.viaText = true
          if (picker.open) closePicker(false)
          else clearComposer()
          return
        }
      }
    }
    if (!picker.open) return
    const k = e.key
    if (k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey)) {
      stop(e)
      select(picker.sel + 1)
    } else if (k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) {
      stop(e)
      select(picker.sel - 1)
    } else if (k === 'ArrowDown' || k === 'ArrowUp') {
      stop(e)
      const perRow = Math.max(1, Math.round(grid.clientWidth / 92))
      select(picker.sel + (k === 'ArrowDown' ? perRow : -perRow))
    } else if (k === 'Enter') {
      stop(e)
      applySel()
    } else if (k === 'Escape') {
      stop(e)
      closePicker(true)
    } else if (!picker.viaText && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = HOTKEYS.indexOf(k.toLowerCase())
      if (i >= 0 && i < CARDS.length) {
        stop(e)
        select(i)
        applySel()
      }
    }
  }
  function onText(e: Event) {
    const text = composerText(e.target)
    if (text === null) return
    const m = text.match(COMMAND)
    if (m) {
      if (!picker.open) openPicker(true)
      const q = (m[2] ?? '').trim()
      if (q) {
        const asked = parse(q)
        const idx = asked?.choice ? CARDS.findIndex(c => c.id === asked.choice) : -1
        if (idx >= 0 && idx !== picker.sel) select(idx)
      }
    } else if (picker.open && picker.viaText) {
      picker.viaText = false
      closePicker(true)
    }
  }
  function onDown(e: MouseEvent) {
    if (picker.open && !e.composedPath().includes(host)) closePicker(true)
  }
  window.addEventListener('keydown', onKey, true)
  document.addEventListener('input', onText, true)
  document.addEventListener('keyup', onText, true)
  document.addEventListener('mousedown', onDown, true)

  let msgListener: ((m: unknown) => void) | null = null
  try {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
      msgListener = m => {
        if ((m as { type?: string } | null)?.type !== 'aw-open') return
        if (picker.open) closePicker(true)
        else openPicker(false)
      }
      chrome.runtime.onMessage.addListener(msgListener)
    }
  } catch {}

  // ------------------------------------------------------------ start
  void store.get().then(saved => {
    if (saved?.scene && (saved.scene === 'off' || isSceneId(saved.scene))) state.scene = saved.scene
    if (saved?.intensity && saved.intensity in LOOKS) state.intensity = saved.intensity
    sync()
  })

  window.__asciiWallpaper = {
    set(choice: Choice) {
      choose(choice)
    },
    open() {
      openPicker(false)
    },
    destroy() {
      clearInterval(periodic)
      mo.disconnect()
      modeObs.disconnect()
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('input', onText, true)
      document.removeEventListener('keyup', onText, true)
      document.removeEventListener('mousedown', onDown, true)
      try {
        if (msgListener) chrome?.runtime?.onMessage?.removeListener(msgListener)
      } catch {}
      html.classList.remove('aw-on')
      unmarkAll()
      layer.remove()
      style.remove()
      host.remove()
      delete window.__asciiWallpaper
    },
  }
}

boot()
