import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Choice, Intensity } from '../types'
import { SCENES, isSceneId, sceneSvg } from './scenes'
import type { SceneId } from './scenes'

const PLUGIN = 'ascii-wallpapers'

const scene = atom({ plugin: 'ascii-wallpapers', key: 'scene' } as const, 'off')
const intensity = atom({ plugin: 'ascii-wallpapers', key: 'intensity' } as const, 'normal')
const isPickerOpen = atom({ plugin: 'ascii-wallpapers', key: 'isPickerOpen' } as const, false)

const LOOKS: Record<Intensity, { zh: string; scrim: number; opacity: number }> = {
  soft: { zh: '柔和', scrim: 0.3, opacity: 0.72 },
  normal: { zh: '标准', scrim: 0.15, opacity: 0.58 },
  vivid: { zh: '鲜艳', scrim: 0, opacity: 0.42 },
}
const LOOK_ORDER: readonly Intensity[] = ['soft', 'normal', 'vivid']
const CARDS: ReadonlyArray<{ id: Choice; zh: string; en: string }> = [{ id: 'off', zh: '关闭', en: 'Off' }, ...SCENES]

const HOTKEYS = [...'0123456789abcdefg']

const OFF_THUMB =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 120"><rect width="192" height="120" fill="#2a2a2e"/>' +
  '<text x="96" y="70" fill="#8a8a92" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="28" text-anchor="middle">—</text></svg>'

const drawn = new Map<string, string>()
function wallpaper(id: SceneId, look: Intensity): string {
  const key = `${id}:${look}`
  let svg = drawn.get(key)
  if (!svg) {
    svg = sceneSvg(id, { cols: 120, rows: 75, cell: 16, glyphs: true, scrim: LOOKS[look].scrim })
    drawn.set(key, svg)
  }

  return svg
}
function thumbnail(id: Choice): string {
  if (id === 'off') return OFF_THUMB
  const key = `${id}:thumb`
  let svg = drawn.get(key)
  if (!svg) {
    svg = sceneSvg(id, { cols: 24, rows: 15, cell: 8, glyphs: false, scrim: 0 })
    drawn.set(key, svg)
  }

  return svg
}

const nameOf = (id: Choice) => CARDS.find(card => card.id === id)?.zh ?? id

/** Reads `/theme <words>`: a wallpaper, an intensity, `off`, or nothing. */
function parse(args: unknown): { choice?: Choice; look?: Intensity } | null {
  const q = (typeof args === 'string' ? args : '').trim().toLowerCase().replace(/\s+/g, '')
  if (!q) return {}
  if (['off', 'none', 'clear', '关', '关闭', '0'].includes(q)) return { choice: 'off' }
  for (const look of LOOK_ORDER) {
    if (q === look || q === LOOKS[look].zh) return { look }
  }
  const hit = SCENES.find(s => {
    const en = s.en.toLowerCase().replace(/\s+/g, '')
    return q === s.id || q === en || q === s.zh || s.id.startsWith(q) || en.startsWith(q) || s.zh.startsWith(q)
  })

  return hit ? { choice: hit.id } : null
}

/** Puts the wallpaper behind the chat (or takes it down); a reason when nothing draws it. */
/** What to say when this Claude Code predates the backdrop API. */
async function tooOld($: EngineInterface): Promise<string> {
  let version = ''
  try {
    version = (await $.session.version()).version
  } catch {}

  return `这个 Claude Code${version ? `（${version}）` : ''}还没有背景壁纸功能。先更新 Claude Code 和 Claude app（PowerShell 里跑 claude update），重启后再试`
}

async function show($: EngineInterface, choice: Choice, look: Intensity): Promise<string | null> {
  try {
    if (choice === 'off') {
      await $.ui.backdrop(undefined)

      return null
    }
    const result = await $.ui.backdrop({ id: choice, glass: { blur: 16, opacity: LOOKS[look].opacity } })

    return result.isDrawn ? null : result.reason
  } catch (error) {
    // An engine without the backdrop API: "$.ui.backdrop is not a function",
    // or nothing beneath answers the call.
    if (/not a function|no implementation for ui\.backdrop/.test(errorText(error))) return tooOld($)

    return `backdrop: ${errorText(error)}`
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A toast that never fails the command. */
function say($: EngineInterface, text: string) {
  try {
    void Promise.resolve($.ui.toast(text)).catch(() => {})
  } catch {}
}

/** Saving is best effort: the wallpaper still changes when the store is unavailable. */
async function keep($: EngineInterface, key: string, value: unknown) {
  try {
    await $.store.set(key, value)
  } catch {}
}

async function choose($: EngineInterface, choice: Choice): Promise<string | null> {
  await update($, scene, () => choice)
  await keep($, 'scene', choice)
  const why = await show($, choice, await read($, intensity))
  if (choice === 'off') say($, '壁纸已关闭')
  else if (why) say($, `已选「${nameOf(choice)}」，但没画出来：${why}`)
  else say($, `壁纸：${nameOf(choice)}`)

  return why
}

async function setLook($: EngineInterface, look: Intensity) {
  await update($, intensity, () => look)
  await keep($, 'intensity', look)
  const current = await read($, scene)
  if (current !== 'off') await show($, current, look)
}

const USAGE = [
  '用法：/wallpaper 打开壁纸选择器，或直接 /wallpaper <名字>（终端里 /theme 也行）',
  `壁纸：${SCENES.map(s => `${s.id}（${s.zh}）`).join('、')}、off（关闭）`,
  '强度：soft（柔和）、normal（标准）、vivid（鲜艳）',
  '终端里原本的颜色主题设置：/theme colors',
].join('\n')

/** One run of /theme or /wallpaper. */
async function runWallpaper($: EngineInterface, args: unknown): Promise<{ text?: string }> {
  const asked = parse(args)
  if (asked === null) return { text: USAGE }
  if (asked.look) {
    await setLook($, asked.look)
    say($, `壁纸强度：${LOOKS[asked.look].zh}`)

    return {}
  }
  if (asked.choice) {
    const why = await choose($, asked.choice)

    return why && asked.choice !== 'off' ? { text: `已选「${nameOf(asked.choice)}」，但没画出来：${why}` } : {}
  }
  await update($, isPickerOpen, () => true)

  return {}
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'wallpaper',
      description: 'ASCII 动态壁纸：打开选择器，或 /wallpaper sky 直接换',
      argumentHint: '[koi|moon|sakura|matsuri|neon|sigil|blade|... |off|soft|vivid]',
    })
    const saved = await $.store.get('scene')
    const savedLook = await $.store.get('intensity')
    const look: Intensity = typeof savedLook === 'string' && savedLook in LOOKS ? (savedLook as Intensity) : 'normal'
    const choice: Choice = typeof saved === 'string' && isSceneId(saved) ? saved : 'off'
    await update($, intensity, () => look)
    await update($, scene, () => choice)
    if (choice !== 'off') await show($, choice, look)

    return next(e)
  })

  // The desktop app attaches after the session starts: set the wallpaper again for it.
  on('session.attach', async ($, e, next) => {
    const done = await next(e)
    const choice = await read($, scene)
    if (choice !== 'off') await show($, choice, await read($, intensity))

    return done
  }).catch(($, e, next) => (next.called ? { clientId: '' } : next(e)))

  on('command.run', { command: 'wallpaper' }, ($, e) => runWallpaper($, e.args)).catch(($, e, next) => ({
    text: `壁纸没换成（${next.error?.kind ?? 'error'}: ${next.error?.message ?? '没有更多信息'}），截图发给作者看看`,
  }))

  // The built-in /theme keeps its colour picker under `/theme colors`;
  // everything else typed after /theme is about wallpapers.
  on('command.run', { command: 'theme' }, async ($, e, next) => {
    const words = (typeof e.args === 'string' ? e.args : '').trim().toLowerCase()
    if (words === 'colors' || words === 'colours' || words === '颜色') return next({ ...e, args: '' })

    return runWallpaper($, e.args)
  }).catch(($, e, next) => (next.called ? {} : next(e)))

  // Sending a message puts the picker away.
  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPickerOpen)) await update($, isPickerOpen, () => false)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== PLUGIN || !isSceneId(e.props.id)) return next(e)
    const ui = $.ui.resolve(e)
    if (!('Svg' in ui)) return next(e)
    const { Svg } = ui
    const look = await read($, intensity)

    return <Svg source={wallpaper(e.props.id, look)} alt={`ASCII 壁纸：${nameOf(e.props.id)}`} isInteractive />
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isPickerOpen))) return next(e)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const Svg = 'Svg' in ui ? ui.Svg : null
    const current = await read($, scene)
    const look = await read($, intensity)

    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text bold>/wallpaper</Text>
          <Text dimColor>ASCII 壁纸 · 点一张就换，面板开着时按卡片上的键也行</Text>
          <Box flexGrow={1} />
          <Button key="done" label="完成" variant="primary" onPress={() => update($, isPickerOpen, () => false)} />
        </Box>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {CARDS.map((card, i) => (
            <Box key={`card-${card.id}`} flexDirection="column" alignItems="center" gap={1}>
              {Svg ? <Svg source={thumbnail(card.id)} alt={`${card.zh} ${card.en}`} width={96} height={60} /> : null}
              <Button
                key={card.id}
                label={`${HOTKEYS[i] ?? ''} ${card.zh}${card.id === current ? ' ✓' : ''}`.trim()}
                hotkey={HOTKEYS[i]}
                variant={card.id === current ? 'primary' : 'secondary'}
                onPress={() => choose($, card.id)}
              />
            </Box>
          ))}
        </Box>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text dimColor>强度</Text>
          {LOOK_ORDER.map(k => (
            <Button
              key={`look-${k}`}
              label={LOOKS[k].zh}
              variant={k === look ? 'primary' : 'secondary'}
              onPress={() => setLook($, k)}
            />
          ))}
        </Box>
      </Box>
    )
  })
}
