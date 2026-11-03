import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'ascii-wallpapers',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const BACKDROP = {
  plugin: 'ascii-wallpapers',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { id: 'koi', plugin: 'ascii-wallpapers', glass: { blur: 16, opacity: 0.58 } },
} as const

test('/theme koi sets the koi pond behind the chat and draws it on desktop', async ($, on) => {
  const set: unknown[] = []
  const stored = new Map<string, unknown>()
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', (_, e) => ({ value: stored.get(e.key) }))
  on('store.set', (_, e) => {
    stored.set(e.key, e.value)

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.backdrop', (_, e) => {
    set.push(e.backdrop)

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: 'built-in' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ ...RUN, command: 'theme', args: 'koi' })

  expect(set.at(-1)).toEqual({ id: 'koi', glass: { blur: 16, opacity: 0.58 } })
  expect(stored.get('scene')).toBe('koi')

  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  await ui.unmount()

  await $.command.run({ ...RUN, command: 'theme', args: 'off' })
  expect(set.at(-1)).toBe(undefined)
})

test('/theme alone opens the picker; a card press switches', async ($, on) => {
  const set: unknown[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.backdrop', (_, e) => {
    set.push(e.backdrop)

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: 'built-in' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const run = await $.command.run({ ...RUN, command: 'theme', args: '' })
  expect(run?.text).toBeUndefined()

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.findAll({ type: 'Svg' })).length).toBe(17)
  await ui.press({ key: 'moon' })
  expect(set.at(-1)).toEqual({ id: 'moon', glass: { blur: 16, opacity: 0.58 } })
  expect((await ui.find({ key: 'moon' }))?.text).toContain('✓')
  await ui.unmount()

  for (const surface of ['terminal', 'mobile'] as const) {
    const other = await $.ui.mount({ ...BAND, surface })
    expect((await other.findAll({ type: 'Button' })).length).toBeGreaterThan(17)
    await other.unmount()
  }
})

test('/theme colors still reaches the built-in colour picker', async ($, on) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: 'built-in' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const run = await $.command.run({ ...RUN, command: 'theme', args: 'colors' })
  expect(run?.text).toBe('built-in')
})
