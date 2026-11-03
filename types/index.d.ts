export type Choice =
  | 'off'
  | 'cloud' | 'lagoon' | 'koi' | 'jelly' | 'boats' | 'fireflies' | 'moon' | 'sakura'
  | 'train' | 'matsuri' | 'meteor' | 'neon' | 'sky' | 'sigil' | 'wisp' | 'blade'

export type Intensity = 'soft' | 'normal' | 'vivid'

declare module 'claude-code' {
  interface PluginState {
    'ascii-wallpapers': {
      scene: Choice
      intensity: Intensity
      isPickerOpen: boolean
    }
  }
}
