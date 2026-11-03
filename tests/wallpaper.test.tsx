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

test('a run whose args are missing opens the picker instead of failing', async ($, on) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => {
    throw new Error('store offline')
  })
  on('ui.toast', () => {
    throw new Error('no toasts here')
  })
  on('ui.backdrop', () => {
    throw new Error('no backdrop layer')
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: 'built-in' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const bare = await $.command.run({ ...RUN, command: 'wallpaper', args: undefined as unknown as string })
  expect(bare?.text).toBeUndefined()

  const sky = await $.command.run({ ...RUN, command: 'wallpaper', args: 'sky' })
  // The reason reaches the person instead of a bare "try again".
  expect(sky?.text).toContain('没画出来：')
})

test('an engine without the backdrop API gets a clear "update Claude Code" answer', async ($, on) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.version', () => ({ value: { version: '2.1.200' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: 'built-in' }))
  // Nothing here answers ui.backdrop: the call fails as on an engine without it.

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sky = await $.command.run({ ...RUN, command: 'wallpaper', args: 'sky' })
  expect(sky?.text).toContain('2.1.200')
  expect(sky?.text).toContain('claude update')
})
