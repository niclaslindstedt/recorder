---
name: screenshot
description: "Use while developing anything a person sees — a screen, a sheet, a bar, a theme, a setting's effect, a layout at another width. Shoots the real app on its demo data in headless Chromium and lays the frames out on contact sheets: phone, iPad, desktop, light and dark, the settings that change a screen, every screen or one. Write code, shoot, look, iterate. Also the way to answer 'what does this look like on an iPad' without a device."
---

# Screenshot

Look at the change, not at the code that should have made it. This skill
shoots the real app — the demo build, in a real Chromium, at real viewports —
and puts the frames where you can read them: one PNG per screen, and contact
sheets that hold a whole matrix on one image. A run of thirty frames takes
about ten seconds; one frame takes one.

The loop is: **write code → `make shots` → look at the sheet → fix what is
wrong → shoot again.** Every UI change ends with a look, on both themes and
on more than one width, before the PR.

## Commands

```sh
make shots-warm                                   # once per session: deps, browser, demo build
make shots                                        # the default set: 3 devices × 2 themes × 5 screens → 3 sheets
make shots ARGS="--screen player --device phone --theme dark"     # one frame
make shots ARGS="--device all --screen library --group screen"   # one screen at every width, one sheet
make shots ARGS="--screen all --device phone"                    # every screen, one device
make shots ARGS="--variant all --screen record,settings"         # every settings preset
make shots ARGS="--settings '{\"showSpectrum\":false}' --screen record"   # an ad-hoc setting
make shots ARGS="--url http://localhost:5173/ --screen folders"  # a running `make demo`, no build
make shots ARGS="--list"                                         # every device, theme, variant, screen
```

`node .agents/skills/screenshot/shoot.mjs --help` prints every option.
Output lands in `.agents/skills/screenshot/out/latest/` (gitignored; a run
replaces the last one): `sheet-<group>.png` per sheet and
`<device>/<theme>[+variant]/<screen>.png` per frame, plus `manifest.json`.
`--out <dir>` keeps a run elsewhere; `--out <file>.png` names a single frame.
The command prints where everything went and exits non-zero if a frame
failed, with the failing step and a `<screen>.failed.png` of what was on
screen.

**Read the frames with the Read tool** — a sheet first, to compare; then a
single frame (`--scale 2` for a closer look at a line or a glyph) when
something needs judging up close.

## What varies

| Axis      | Values                                                                                                                                                                                                                      | Default                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `device`  | `phone` 440×956 · `phone-small` 375×667 · `phone-landscape` 956×440 · `tablet-mini` 744×1133 · `tablet` 1032×1376 · `tablet-landscape` 1376×1032 · `desktop` 1440×900 · `desktop-small` 1280×720 · `desktop-wide` 1920×1080 | `phone,tablet,desktop`                   |
| `theme`   | `light` · `dark` · `system-light` · `system-dark` (theme "Device", the device leaning either way)                                                                                                                           | `light,dark`                             |
| `variant` | `default` · `lossless` · `spectrum` · `spectrogram` · `voice-processing` · `export-wav` · `export-flac` · `dev` — the settings presets in `lib/variations.mjs`                                                              | `default`                                |
| `screen`  | `record` · `listening` · `quality` · `recording` · `review` · `library` · `library-favorites` · `library-trash` · `library-search` · `player` · `export` · `folders` · `settings` · `settings-storage` · `spaces`           | `record,library,player,folders,settings` |

Sets: `--device phones|tablets|desktops|all`, `--theme all`, `--variant all`,
`--screen library-flow|record-flow|all`. The shell a width gets is
`src/app/shape.ts`'s: under 1024 px the phone (bottom bar), a short landscape
window the stand, 1024 and past it the desk (tabs on the top bar, Settings as
a side panel) — so the 13″ iPad upright is a desk, and the iPad mini a phone.

A sheet is one per value of `--group` (default `device`), its columns
`--cols` (default `screen`), its rows whatever else varies; more than `--wrap`
columns (6) continue in a band below. `--cell` is a cell's shorter side (360
px), so a laptop frame is as tall on the sheet as a phone frame is wide.

## How a frame is made

- **The subject is the demo build**: `VITE_SEED=demo VITE_SHELL_BUILD=on`,
  built into the skill's `.build/` (never `dist/`) and rebuilt only when
  something under `src/`, `public/`, `index.html` or the Vite config moved —
  a stamp of names, sizes and mtimes, so a second run skips the build. `--build`
  forces one, `--no-build` uses what is there. `--edition store` builds as the
  phone app (the listing's name on the wordmark).
- **Every frame is a fresh browser context** on the Record screen, then the
  screen's `stage` in `lib/screens.mjs` does what a person does: taps a tab,
  taps a row, presses Record. The theme and the variant reach the app the way
  a choice does — the settings key in localStorage, seeded before the page
  loads. Nothing else is injected: no DOM surgery, no fake state.
- **The microphone is a fake device** (Chromium's `--use-fake-device-for-media-stream`,
  a loud tone), so `listening`, `recording` and `review` really hear something. The tone clips,
  which is why those frames show the clip lamp and the warning: a true frame
  of a hot signal, not a bug.
- **Motion is off** (`prefers-reduced-motion` plus zero-length transitions), so
  a frame never catches a slide half way. `--motion` keeps it.
- **The locale is pinned to `en-US`**: the sandbox's own is one Intl rejects
  (`en-US@posix`), which takes the list screen down with an "Invalid language
  tag" error. Any page error a frame logs is printed under the summary — read
  those lines; a blank region on a frame usually has one.

## Adding to it

- **A new screen** — a `stage` in `lib/screens.mjs`. Wait for the state a tap
  makes (a dialog, a radio, a row) rather than for time, so a miss fails
  loudly; use roles, and check them with an aria snapshot when a locator
  misses (`page.locator("main").ariaSnapshot()` in a scratch script). Rows in
  the list are named after their thumbnail, so match a title as a substring.
- **A new setting** — a preset in `lib/variations.mjs`, the same shape the
  app stores (`src/app/useAppSettings.ts`).
- **A new width** — a row in `lib/devices.mjs`. It is a CSS viewport; `mobile`
  turns on touch.
- A new set goes next to the catalogue it draws from.

## Rules

- Never commit `out/`, `.build/` or the skill's `node_modules/` — all three are
  gitignored here.
- Frame nothing the app cannot do itself. A frame that needs DOM surgery to
  look right is a screen that needs fixing, or a demo-data change
  (`src/app/dev/demoData.ts`).
- A UI change is not finished until it has been looked at on a phone and on
  the desk, in both themes. Put the sheet's path in the PR body when the
  change is visual.
- This is a development tool. The store's screenshots (Apple's rasters, the
  real status bar, captions) are the fleet's store harness, not this.

## A frame that stalls at boot

Now and then (about one frame in a hundred on a busy run) headless Chromium's
renderer stalls at first paint, waiting on a system-font lookup its font
service never answers — the page draws nothing and logs nothing. That is the
browser's, not the app's (the stack is `FontServiceThread::MatchFamilyName`),
so a frame whose page never reached the Record screen **and logged no page
error** gets one retry in a fresh context, and the summary says `retried …`.
A second stall, or any stall with a page error, fails as usual. Fewer
system-font lookups at first paint make it rarer: the app's figures use the
bundled JetBrains Mono (`font-figures`), never `font-mono`'s system stack.

## If it does not run

`make shots-warm` says what is missing. It looks for `playwright-core` in the
skill's `node_modules`, the checkout's, then the machine's global npm tree
(`npm root -g`), and takes the first whose Chromium is on disk
(`PLAYWRIGHT_BROWSERS_PATH` is honoured). With none, it installs the pinned
`playwright-core` into the skill and fetches the headless shell — both need
the network. Bumping `package.json`'s pin means fetching the matching browser
again; the fetch command is what warm prints.
