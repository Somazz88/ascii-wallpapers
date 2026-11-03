# ASCII Wallpapers

Live wallpapers painted in character tiles, drawn **behind the conversation** in the Claude desktop app's Code tab. Type `/wallpaper`, pick a scene, and your chat sits on top of drifting clouds, swimming koi or a summer festival at night.

![All sixteen wallpapers](assets/preview.gif)

Every scene is one self-contained animated SVG: tiles are pattern-filled runs, letters are `<text>`, motion is CSS keyframes. No script runs, so the wallpaper keeps moving without any work from the session.

## Requirements

- The Claude desktop app, **Code** tab (a local session). Other surfaces don't draw backdrops.
- A recent Claude Code: the wallpaper uses the plugin backdrop API (`$.ui.backdrop`), which older builds don't have. Built and tested against Claude Code 2.1.317. On an older build `/wallpaper` says so instead of drawing; run `claude update` and restart the app.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install ascii-wallpapers --marketplace Somazz88/ascii-wallpapers
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```
claude plugin install ascii-wallpapers --marketplace Somazz88/ascii-wallpapers
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `Somazz88/ascii-wallpapers`, then **Add plugin**.

## Use

Open the Claude desktop app, go to the **Code** tab and start a local session, then:

| Command | What it does |
| --- | --- |
| `/wallpaper` | Opens the picker above the prompt. Click a card, or press the key on it while the picker is open. **完成** closes it. |
| `/wallpaper sky`, `/wallpaper 樱花`, `/wallpaper neon` | Switches straight to a scene (id, English or Chinese name, or a prefix). |
| `/wallpaper off` | Takes the wallpaper down. |
| `/wallpaper soft` · `normal` · `vivid` | How strongly the app's panels frost over the wallpaper. |

In the desktop app, `/theme` opens the app's own Appearance settings, so use `/wallpaper` there. In a terminal session `/theme` works too, and `/theme colors` still opens the built-in colour picker.

Your choice is remembered across sessions. Wallpapers draw in the desktop app's Code tab only: the terminal, the mobile app and claude.ai chats don't draw backdrops.

## Scenes

**Calm**

| | | | |
| :-: | :-: | :-: | :-: |
| ![Cloud Drift](assets/scenes/cloud.gif) | ![Neon Lagoon](assets/scenes/lagoon.gif) | ![Koi Pond](assets/scenes/koi.gif) | ![Jellyfish](assets/scenes/jelly.gif) |
| `cloud` 云海漂流 | `lagoon` 霓虹泻湖 | `koi` 锦鲤池 | `jelly` 水母 |
| ![Paper Boats](assets/scenes/boats.gif) | ![Fireflies](assets/scenes/fireflies.gif) | ![Moonlit](assets/scenes/moon.gif) | ![Sakura](assets/scenes/sakura.gif) |
| `boats` 纸船 | `fireflies` 萤火虫 | `moon` 月夜 | `sakura` 樱花 |

**Anime mood**

| | | | |
| :-: | :-: | :-: | :-: |
| ![Summer Train](assets/scenes/train.gif) | ![Matsuri Night](assets/scenes/matsuri.gif) | ![Meteor Shower](assets/scenes/meteor.gif) | ![Neon Rain](assets/scenes/neon.gif) |
| `train` 夏日电车 | `matsuri` 夏日祭 | `meteor` 流星雨 | `neon` 霓虹雨夜 |
| ![Sky Islands](assets/scenes/sky.gif) | ![Magic Circle](assets/scenes/sigil.gif) | ![Spirit Flames](assets/scenes/wisp.gif) | ![Blood Moon](assets/scenes/blade.gif) |
| `sky` 天空之岛 | `sigil` 魔法阵 | `wisp` 妖火 | `blade` 刀光血月 |

All scenes are original artwork.

## How it works

The mod uses the hooks API of Claude Code plugins:

- `$.ui.backdrop({ id, glass })` sets the session's backdrop; a `ui.render` hook on `Backdrop` answers with an `<Svg isInteractive>` of the scene, so its CSS animation runs in a sandboxed frame.
- A `ui.render` hook on `AbovePrompt` draws the picker: a live thumbnail `Svg` and a `Button` per scene.
- `/wallpaper` is the mod's own command. In a terminal session the built-in `/theme` is hooked too: anything after it is about wallpapers, except `colors`, which is handed on to the original.
- A `session.attach` hook sets the backdrop again when the desktop app joins a session that started before it.

Adding a scene means writing one function in [`hooks/scenes.ts`](hooks/scenes.ts) that draws into the `Art` builder (`tiles`, `sprite`, `glow`, `glyph`, `move`), then listing it in `SCENES`.

## Develop

```
claude plugin validate .
claude plugin test .
```

## License

[MIT](LICENSE)
