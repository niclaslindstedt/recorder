# Agent guidance for recorder

This file is the canonical source of truth for AI coding agents working in this
repo. `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `GEMINI.md`, and
`.github/copilot-instructions.md` are symlinks to this file.

Fleet guidelines: APP_GUIDELINES 1.2.0

## What this app is, and the one rule that follows from it

A voice recording is a person's own voice, and often somebody else's. The
whole design premise is that a recording never leaves the device unless its
owner explicitly connects their own cloud account or their own storage server.

**So: never add a network call that isn't the user's own backend.** No
analytics, no error reporting service, no font CDN, no speech-to-text service,
no "anonymous" telemetry, no third-party script — not behind a flag, not in dev
only. If a change would send a byte of a recording, or a byte _about_ one,
anywhere the user did not choose, it is the wrong change however useful the
feature is. This is the constraint the README and the privacy copy promise; it
outranks convenience. Transcription, if it ever comes, runs on the device.

## Build and test commands

```sh
make install       # npm install (needs GitHub Packages auth — see below)
make build         # production build (vite build)
make demo          # dev server on the in-memory demo library (VITE_SEED=demo)
make test          # full test suite (vitest)
make lint          # eslint + tsc --noEmit
make fmt           # prettier --write
make fmt-check     # verify formatting (CI)
make icons         # regenerate the PWA icons, favicon, og image and the shells' icons
make shots         # screenshots of the demo on contact sheets — ARGS="--screen player --device phone"
make shots-warm    # the first run's slow parts (deps, browser, demo build) ahead of time

make native-install    # install the native wrapper's own dependencies
make native-bundle     # build the web app into native/assets/webroot.zip
make native-typecheck  # tsc over native/
make native-prebuild   # regenerate native/ios + native/android from the config
```

The desktop shell in `tauri/` is a Rust project with its own toolchain; `make
test` and `make lint` stop at its edge:

```sh
make tauri                # bundle the site into the shell and run the desktop app
make tauri-test           # its decision layer (cargo test -p recorder-shell — no GUI libs)
make tauri-lint           # clippy at zero warnings, both crates
make tauri-fmt            # rustfmt in place (tauri-fmt-check verifies)
make tauri-package        # this machine's installers
make tauri-package-debug  # …debug profile: minutes faster, much bigger
```

It is a **thin** wrapper: a window, the built site served from a private
`recorder://` scheme, and one capability a page cannot have — the loopback
listener that lets Dropbox sign in (`tauri/shell/src/oauth.rs`,
`tauri/src-tauri/src/loopback.rs`). **The page is never told it is inside it**
— no injected global, no Tauri command. `tauri/shell/` holds every decision and
needs no GUI toolkit; `tauri/src-tauri/` holds every effect. One seam reaches
back into this tree, `VITE_SHELL_BUILD`, set by the shell's site build — and by
the phone wrapper's, which is the same shape of thing — which switches off the
service-worker half of `appPwa` and — through `__SHELL_BUILD__` — the in-app
update prompt. A desktop or phone build updates by being replaced, and both
bundle scripts refuse a webroot holding `sw.js`. The desktop build, and the
phone wrapper's store edition (`VITE_EDITION=store`), are builds that are not
the website: they carry no link back to the source (by owner decision) — no
Open Graph tags naming the web edition, no `CNAME` and no `og.png`
(`websiteOnly` in `vite.config.ts`) — and both bundle scripts refuse a webroot
that still contains `niclaslindstedt`. The package's name and identifier come
from `APP_DISPLAY_NAME` and `APP_BUNDLE_ID` at packaging time
(`tauri/scripts/package.mjs`), like the phone app's. See
[`tauri/README.md`](tauri/README.md).

The `@niclaslindstedt/oss-framework` dependency comes from the **GitHub
Packages** npm registry (see `.npmrc`). GitHub Packages requires auth even for
public packages, so local installs need a `read:packages` token in `~/.npmrc`
(`//npm.pkg.github.com/:_authToken=<token>`); CI authenticates with the
workflow's `GITHUB_TOKEN`.

### Dependency install in web sessions

Claude Code on the web runs `.claude/hooks/session-start.sh` on `SessionStart`
(wired up in `.claude/settings.json`), so **dependencies install automatically
in the background** — an agent shouldn't run `make install` by hand first. The
hook resolves a GitHub Packages token from the environment
(`NODE_AUTH_TOKEN` / `GITHUB_PAT` / `GH_TOKEN` / `GITHUB_TOKEN`, first wins),
writes it to `~/.npmrc`, and runs `npm install` — the committed project
`.npmrc` stays token-free. It runs in **async** mode, so `node_modules` may
still be populating for a moment after the session opens; if a `make` target
fails on a missing dependency, wait and retry. The hook is a no-op outside the
web environment (`CLAUDE_CODE_REMOTE`), so it never touches a local developer's
npm config.

## Commit and PR conventions

- All commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- PRs are squash-merged; the **PR title** becomes the single commit on `main`,
  so it must follow conventional-commit format.
- Breaking changes use `<type>!:` or a `BREAKING CHANGE:` footer.

### Watching a PR after you open it

Don't babysit a PR with polling. **Do not** schedule `send_later`, cron jobs,
`ScheduleWakeup`, or timed self-check-ins to re-check CI or merge state — those
just burn turns. Open the PR, confirm the checks you can see are green, then
stop. CI failures and review comments are delivered to the session as webhook
events, so you'll be woken when there's actually something to act on.

## Architecture summary

This is a **frontend-only, local-first PWA** — there is no server. It is built
on [`oss-framework`](https://github.com/niclaslindstedt/oss-framework), the
same shared surface behind the sibling `time`, `contacts` and `baby` apps.

The framework owns the UI kit and the generic mechanics — and, since its
`audio` module, everything about sound that does not know what it is for: the
microphone capture, the level meter's ballistics and the clip lamp, the
spectrum's log-axis bars, the WAV, FLAC and MP3 encoders, decoding through the
browser, the player over an `HTMLAudioElement`, and the three components that
draw them (`LevelMeter`, `SpectrumBars`, `Waveform`). It also owns the modals,
form primitives, the theme engine, the bottom bar and the tab-paging swipe, the
storage adapters (Dropbox, a self-hosted storage server's encrypted namespaces)
and the byte file stores beside them, the reconcile sweep that keeps files in
step with a document, sealed bytes under a passphrase, the namespaces module,
the i18n runtime, logging, the toast store, and the PWA update state machine.
What stays here is the vocabulary — what a recording is, where it is filed,
what a take turns into, and what an export offers.

### The renderer is Preact

`preact` is the only renderer dependency — **never add `react` or `react-dom`
back.** `@preact/preset-vite` compiles JSX against `preact/jsx-runtime` and
aliases `react` / `react-dom` (and their `/jsx-runtime` + `/client` subpaths)
onto `preact/compat`; `tsconfig.json` `paths` and `package.json` `overrides`
mirror that for `tsc` and npm, so the framework — which is built against React
— resolves to Preact too. App code keeps importing hooks and types from
`"react"`, which is the supported compat path; only `src/main.tsx` uses
Preact's own `render`. Two differences bite in new code: use `e.currentTarget`
rather than `e.target` in event handlers, and spell string-valued attributes
like SVG's `focusable` as `"false"` rather than a JSX boolean.

### The app owns the domain ("store stays in the app")

- `src/app/types.ts` — the model. A `Recording` (title, the folder it is in,
  when it was taken, how long, the container its bytes are in and the file
  they are stored as, the waveform thumbnail, favorite, a note, and the facts
  about the take — how many frames clipped, the loudest peak) and a `Folder`
  (name, parent, order). A deletion is a **tombstone**: `deletedAt` set, the
  record kept, because the recording's file has to be removed everywhere the
  record reaches and an absence cannot say so. "Recently deleted" is the
  tombstones younger than `TRASH_DAYS`; `purgeAfter` drops the ones old enough
  that no device is expected to still hold the file. `wantedFiles` is the one
  list of files the document names — what the sync keeps in step and what the
  blob store keeps. Pure and clock-free: `now` is a parameter.
- `src/app/folders.ts` — the tree, read (`childrenByParent`, `folderTree`,
  `subtreeIds`, `canNest`, `recordingsIn`, `countIn`, `folderPath`) and the
  edits as pure functions from a document to a new one: add, rename, move,
  reorder and delete a folder (what is inside moves up a level — a folder is a
  label, nothing is recorded over), and on a recording patch, trash, restore
  and purge. Ids and the `updatedAt` stamp come in through a `ctx` argument so
  nothing here touches chance or the clock.
- `src/app/takes.ts` — a take, finished: what the microphone handed back
  (`CaptureResult`) turned into the record and the bytes. A _compact_ take is
  the browser's own container, kept as it came; a _lossless_ take is the
  samples, encoded to FLAC here. `defaultTitle` numbers "New recording" past
  the titles taken.
- `src/app/export.ts` — the way out: `exportFileName`, `exportPlan` (the
  channel count and the rate the file ends up with, MP3's nine rates
  included), `estimateExportBytes` (what the export sheet says the file will
  weigh), `encodeExport` (decode → mono → resample → WAV / FLAC / MP3; the
  MP3 encoder is fetched on first use through the framework's `audio/mp3`
  entry) and `exportRecording`, which hands the file to the framework's
  `saveFile` — a download on the web, the share sheet in the phone app.
  `shareOriginal` shares the take as it is.
- `src/app/format.ts` — durations (`m:ss`, `h:mm:ss`), the recording timer's
  tenths, the list's day headings ("Today / Yesterday / Friday / Feb 1", and
  `groupByDay` for the runs under them), "Room for" in rough words
  (`formatSpan`), and the facts line's container, rate and size. Pure; the
  locale is a parameter.
- `src/app/merge.ts` — the per-record, last-edit-wins document merge that
  both sync and backup restore run through. A tombstone is an edit like any
  other, so a deletion wins over an older copy and a later edit wins over a
  deletion.
- `src/app/migrations.ts` — parse / normalise / serialize; the only module
  that trusts stored bytes. `isFileName` pins the shape a record's file name
  may have: an id and an extension, nothing that could climb out of a folder.
- `src/app/useNamespaces.ts` — the **spaces**: separate libraries, each with
  its own document, its own files and its own file on a backend, over the
  framework's namespaces module. The list is per device (localStorage); a
  space made elsewhere is found again by the file a backend lists
  (`useSyncEngine`'s `listSpaces`) and adopted under its slug.
- `src/app/useDocStore.ts` — the document store: one document per space,
  in IndexedDB (`recorder:documents`), over a `DocBackend` seam that a test or
  the demo takes over. The read is asynchronous, so the store starts unloaded
  and never writes until the read has landed. Its edits are the app's whole
  write vocabulary.
- `src/app/blobStore.ts` — where the recordings' bytes live on this device:
  IndexedDB (`recorder:files`), one row per file, keyed by space and name. It
  speaks the framework's `ByteFileStore`, so the sync's reconcile treats it as
  the local side of a pair; `readBlob` / `writeBlob` are the app's own way in.
- `src/app/cloudHost.ts` — the seam a **host** fills to offer the app a
  document store of its own, which today means iCloud. Seven methods: the
  framework's `FileStore` four, `status`, and `readBytes` / `writeBytes` for
  the recordings' files, which cross the bridge as base64. The question it
  asks is about **capability, not identity** — never "am I native?", only
  "did something offer a store?". `createCloudHostAdapter` and
  `createCloudHostByteStore` turn a host into the framework's adapter and byte
  store, mapping a host's three failure kinds onto the errors the engine
  routes on (`auth` → Reconnect, `offline` → keep the local copy, anything
  else → stop). Validates every host before trusting it.
- `src/app/selfHosted.ts` / `useSelfHosted.ts` — the reader's **own storage
  server** as a backend, through the framework's self-hosted client: pairing
  codes (pasted, scanned in the phone app with the framework's
  `scanStorageCode`, or the `#oss=` app link a QR opens on the website, wiped
  from the address bar once read), the device's name, and which namespace
  holds the spaces. The keys stay in the framework's key vault — never add
  them to localStorage, logs or a backup — and the server only ever gets
  ciphertext. The sheets are `SelfHostedConnectModal.tsx` and
  `SelfHostedSettings.tsx`.
- `src/app/useSyncEngine.ts` — the sync engine over the framework's storage
  adapters (debounced push, conflict / auth / throttle handling), one file per
  space (`recorder-<slug>.json`) and a folder beside it (`recorder-<slug>/`)
  holding the recordings' files. After every push and pull the **sweep**
  (`reconcileFiles`) sends the files this device has and the backend lacks,
  fetches the ones it lacks, and — once the document has been pushed —
  removes the ones no record names. Dropbox and iCloud go through the
  framework's optional encryption: a passphrase over the copy, the files
  sealed under it (`encryption.sealBytes`); the reader's server seals
  everything itself, so nothing is added there. Suspended wholesale while demo
  data has taken over storage. `listSpaces` reads the spaces a backend holds.
- `src/app/look.ts` — the looks: the framework's palettes under the app's
  own names, one list by day and one by night, and which preset the page
  wears for a mode and the device's own light or dark. `LookPicker.tsx`
  draws them as cards in their own colours.
- `src/app/pacing.ts` — the capture's frames paced to the display: the
  audio tap delivers a batch about every 43 ms, so each is played out
  across the display frames until the next, and the meter is moved by the
  framework's own `readFrame` / `stepMeter` on every frame (the lamp and
  the tallies passed through). `bucketShare` lays the take's running
  thumbnail out by time. `src/app/playhead.ts` does the same for the
  player's line: a smooth clock at the playback rate, kept on the audio
  element's coarse `currentTime`.
- `src/app/eq.ts` — the **equalizer**: a low cut and five bands (Bass,
  Warmth, Mids, Presence, Air) that split the sound at four crossovers and
  add back up to it, so a band can be turned off and two cut bands stay
  cut between them, the presets, `normalizeEq` (flat is
  `null`), the curve (`responseDb`) and `applyEq`, which runs samples
  through the same biquads the Web Audio spec gives `BiquadFilterNode` —
  what an export is encoded from. Pure. An EQ is a fact about a recording
  (`Recording.eq`), never written into its bytes. `eqChain.ts` is the same
  EQ as the browser's filters; `useEqPlayer.ts` is the player and Review's
  playback — the framework's `Player` shape over an element of its own,
  since the framework's `usePlayer` keeps its element and an element's
  sound can only be routed by its holder — taken through the chain only
  once an EQ is wanted, and only on a press; `useMonitor.ts` is the
  microphone through the EQ into headphones, opened on Monitor (the EQ
  sheet's, or the headphones glyph while Listening and Recording — one
  monitor, a stream of its own beside the capture) and keeping nothing,
  with `howl.ts` (pure, tested in `tests/howl_test.ts`) listening
  to what it sends out and stopping it the moment it hears feedback — one
  dominant, steady, loud tone; never loosen that guard into something a
  speaker loop gets past. `EqSheet.tsx` / `EqParts.tsx` are the sheet, its knobs and its
  curve. Both the player and the monitor are candidates for the
  framework's `audio` module once it can route an element's or a capture's
  sound.
- `src/app/useAppSettings.ts` — the per-device settings: the theme and its looks, the EQ new takes start with (`recordEq`), how a
  take is kept (compact at a bitrate, or lossless) and voice processing —
  both chosen on the Record screen's Quality sheet, not in Settings — the
  visualizer (`wave`, `spectrum` or `spectrogram`), the skip length, the
  export defaults, and the developer knobs. Shape plus clamping, in one
  place.
- `src/app/dev/` — the developer "Demo data" switch: a library of invented
  recordings (`demoData.ts`, pure, every date an offset from `now`, the audio
  short tones written as WAV by the framework's own encoder so every row
  plays), the in-memory document and blob stores that serve them, and the
  never-persisted flag. Behind `import()`.
- `src/app/RecordScreen.tsx`, `LibraryScreen.tsx`, `SettingsScreen.tsx` —
  the three screens. Record and Recordings are the two destinations; Settings
  is reached from the cog on the top bar, because it is a thing you do and
  leave rather than a place you are. Record is an instrument in four modes
  (`docs/design.md`, "Record"): **Ready** (the Quality and Save-to buttons,
  the "Check your level" card, the latest recordings, the big button),
  **Listening** (the microphone open and nothing kept: the visualizer, the
  big meter, Room / Peak / Headroom and a verdict in words), **Recording**
  (the timer, the visualizer with the whole take along its foot, the meter
  with its clip lamp, and the take's four figures — Peak, Clips, Size, Room
  for), and **Review** (inline: the title, a listen-back, the facts, Save
  to, the big Save and a Discard glyph that asks first — nothing is written
  until Save). While a take runs or waits for review, the bottom bar is
  hidden and the swipe and the tabs are off. Recordings is the scope button
  (where you are and how many; it opens the folder picker), the search
  glyph, and the list under day headings; a tap opens the player, a swipe
  deletes, a hold offers the rest.
- `src/app/RecordParts.tsx` — the pieces the Record screen's modes are
  drawn from (the choice buttons, the listen card, the ambient readout, the
  take's figures, the review) and `useFreeBytes`, the browser's own estimate
  of its free space behind "Room for" (`navigator.storage.estimate`, read on
  the device, sent nowhere). `Visualizer.tsx` is the card that fills the
  stage while listening and recording: a scrolling waveform on the meter's
  decibel scale, the framework's spectrum bars, or a spectrogram, switched
  in its corner.
- `src/app/useListen.ts` — Listening: a throwaway capture through the
  framework's `useRecorder`, on the same path a take uses, cancelled on Stop
  and on leaving, started over every five minutes (`LISTEN_RECYCLE_MS`) so
  it never holds more than that in memory. Nothing it hears is kept.
  `src/app/levels.ts` reads the last four seconds of meter readings as the
  room's noise floor, the peak, the headroom and a verdict against the
  target level (`target.ts`) — quiet under it, good in it, loud over it —
  with hot and clipping the framework's. Pure and clock-free.
- `src/app/quality.ts` — the four presets (Memo 64, Standard 128, High 256
  kbit/s, Lossless) over `recordingKind` / `recordingBitrate`, and what a
  minute of each costs; pure, so the Record screen's button and
  `QualitySheet.tsx`'s ticked row never disagree. The sheet also carries the
  bitrate fine-tune, voice processing and the target level.
- `src/app/target.ts` — the target level: where a take's peaks should land,
  as a range in dBFS, by what is being recorded (Voice, Music, Loud,
  Ambience, or a clamped Custom range), and `targetTone`, where a peak lands
  against it (under / in / over / hot — hot is the framework's `meterTone`,
  never the range's). **One range, read in four places**: the waveform's
  band and its bar colours, the big meter (`BigMeter.tsx`), Listening's
  verdict (`levels.ts`) and the Quality sheet's `TargetLevel.tsx` all draw
  from here, so the picture, the bar and the words never disagree. The
  default, Voice, is exactly the framework's good zone.
- `src/app/BigMeter.tsx` — the Record screen's meter: the framework's
  `LevelMeter`, with the target as a band on its track and the bar coloured
  by where the held peak sits against it (a `data-target` attribute set per
  frame, and `--target-from` / `--target-to`; the drawing is
  `.app-meter-big` in `styles.css`). The ballistics, the held peak, the
  lamp and the status region stay the framework's. The colour reaches the
  bar through the track's `origin-left` child — if the framework's markup
  moves, the bar falls back to the framework's own colours, so check it on
  a framework upgrade.
- `src/app/FolderPicker.tsx` — the one folder picker, in two modes.
  _Browse_ is the library's scope: All, Favorites, the tree with counts and
  each folder's ⋯ menu (rename, new folder inside, move, move up / down,
  delete), New folder, Recently deleted — everything a folders page would
  do. _Choose_ is Move and a take's destination: No folder, the tree, New
  folder — and a folder made there is chosen. `SearchSheet.tsx` is search
  as a sheet, across the whole space's titles, notes and folder names.
  `RecordingRow.tsx` is a recording as a row (thumbnail, title and star, a
  quiet line, the length right-aligned) wherever one is listed.
- `src/app/PlayerModal.tsx` — the title editable in place, the favourite
  star, the date with the folder as a chip that opens the picker to move it,
  the recording's shape with the playhead over it (the framework's
  `Waveform`, seekable), the transport with a speed button that steps, the
  note, the facts always shown, Export and a Delete glyph.
  `ExportModal.tsx` is the export sheet; it says what the file will be
  (roughly how large, the rate, the channels, the format) before it is
  made, starts on the settings' defaults and writes the choice back to them.
- `src/app/TopBar.tsx`, `BottomNav.tsx` — the shell's two bars. The top bar
  carries the wordmark on the left and, on the right, the sync glyph (only
  with a backend connected), the space glyph (the active space's own symbol
  and colour; it opens the spaces sheet) and the cog, and on the desk the
  two destinations as tabs; the bottom bar is the phone's.
- `src/app/SidePanel.tsx` — Settings on the desk, over the right-hand edge.
- `src/app/i18n/en.ts` — every user-facing string.
- `src/output.ts` — the central output module (semantic log helpers over the
  in-app log store); no bare `console.*` outside it and the log store.
- `pwa-plugin.ts` — emits the service worker + version/precache manifests the
  framework's `usePwaUpdate` consumes.

Dependency direction: screens → stores → framework. Nothing imports from the
framework's internals — only its published subpaths.

### Derive, don't store

Nothing about a library is persisted beyond the records and the files: not
the count in a folder, not which files are on this device, not whether a
recording is in the trash. `wantedFiles`, `trashedRecordings` and `countIn`
are recomputed on render from `types.ts` and `folders.ts`. The one derived
thing a record keeps is the waveform thumbnail, because it is made from the
samples while they are being heard, and decoding a recording to draw a
sixty-pixel shape in a list would be the wrong price. **Adding another derived
field to a record is almost always the wrong fix.**

### The bytes are the framework's; the record is the app's

What a level in dBFS means, when a run of samples is a clip, how a FLAC frame
is laid out and what `getUserMedia` is asked for are the framework's
(`@niclaslindstedt/oss-framework/audio`). Never re-implement any of it here —
a second meter that disagreed with the one in the sibling apps is the drift
the module exists to prevent. What the app decides is what a take _becomes_
(`takes.ts`), where it is filed, and what an export is called.

### A deletion is a tombstone

A recording's file lives on every backend the space syncs to, and a record
that simply vanished could not tell the other side to drop the file. So
`trashRecording` sets `deletedAt` and keeps the record; the sweep prunes the
file once it leaves the trash; and the tombstone itself goes only after
`TOMBSTONE_DAYS`, by which time every device is expected to have heard. A
change that removes a record outright is the one change that brings a deleted
recording back on the next sync.

## The native wrapper (`native/`)

`native/` is a **thin** Expo / React Native shell that ships this web app to
the App Store and Google Play. It is a **separate npm project** with its own
`package.json`, its own lockfile and its own `node_modules` — `npm ci` at the
root does not touch it, and neither does `make install`. Reach it with
`--prefix native` (or the `make native-*` targets).

**Thin is a constraint, not an aspiration.** The wrapper does seven things:

1. packs the built web app into `assets/webroot.zip` and serves it from a
   loopback HTTP server (`src/local-server.ts`) on the app's own port, 8331;
2. points a `WebView` at that origin and otherwise gets out of the way — the
   microphone is the page's own `getUserMedia`, which the WebView grants
   (`app.config.js` declares the usage description);
3. injects four scripts into the page — `src/injected.ts`, which reports the
   resolved theme colours so the native chrome follows them and unregisters
   the service worker, `src/icloudBridge.ts`, which offers the page a
   document store, `src/authSessionBridge.ts`, which offers it an
   authentication session for signing in to Dropbox, and
   `src/saveFileBridge.ts`'s descriptor, which tells the framework's
   `saveFile` the shell can take a file (and `src/scanQrBridge.ts`'s, which
   tells its `scanQrCode` the shell can scan a QR code);
4. answers those store requests against the app's own iCloud container
   (`src/icloud.ts` → `modules/icloud-store`) — text for the document, base64
   for the recordings' files;
5. opens a sign-in in an authentication session when the page asks
   (`src/authSession.ts` → `expo-web-browser`) and hands the redirect back;
6. hands an export to the share sheet when the page's `saveFile` sends one
   (`src/saveFile.ts` → `expo-sharing`). Every file `src/` hands the reader
   goes through `saveFile` — never `downloadBlob`, `downloadText` or a
   hand-clicked `download` link, which save nothing inside a WebView;
7. opens the camera to read one pairing code when the page's `scanQrCode`
   asks (`src/QrScanner.tsx` → `expo-camera`) — only then, never at launch,
   keeping no frame and logging no code.

### The two native-only features, and why there have to be two

**Being self-contained and iCloud are the only features the wrapper adds.**
Everything else a reader sees is the web app, unchanged. They are the reason
the wrapper is shippable at all: App Store guideline 4.2 (minimum
functionality) rejects a build that is only a viewer for a website, so this
app serves the recorder from inside the download (no network at all, ever)
and keeps the recordings in the reader's own iCloud container, which no
browser can reach.

- **Nothing in `src/` may learn that the wrapper exists.** No `window.__native`
  feature detection, no native-only branch, no build flag. A native-only
  feature the web app has to _offer_ is done as a **capability the host may
  offer** (`src/app/cloudHost.ts`), never as a check for this wrapper.
- **The wrapper may not reimplement the domain.** It moves bytes: a file in,
  a file out. What a recording is, where it is filed and how two devices'
  copies reconcile are `types.ts`, `folders.ts` and `merge.ts`'s.

### What breaks quietly

- **The iCloud bridge is three strings that must agree with `src/`**: the
  property the host installs itself on (`window.__recorderCloudHost`), the
  announcement event (`recorder:cloud-host`), and the provider's name
  (`icloud`) — plus the seven method names. None of them fails loudly on a
  mismatch: the backend simply never appears in the storage picker.
  `tests/native_icloud_test.ts` pins all of them against the app's own
  constants.
- **The auth-session bridge's names are the framework's**
  (`AUTH_SESSION_HOST_PROPERTY`, `AUTH_SESSION_HOST_EVENT`), spelled again in
  `native/src/authSessionBridge.ts`; `tests/native_auth_session_test.ts` pins
  them.
- **The URL scheme is the bundle id**, and the Dropbox sign-in returns on
  `<scheme>://oauth` — `se.agilator.recorder://oauth` in the store build,
  which the Dropbox app must list as a redirect URI (`native/RELEASING.md`).
  The scheme follows `APP_BUNDLE_ID` (`native/identifiers.js`) and is never
  committed.
- **Nothing the root `tsc` can reach may import `expo`.** The wire shapes
  live in `native/src/icloudWire.ts` and the script escaping in
  `native/src/scriptText.ts`, which import nothing at all; only
  `native/src/icloud.ts`, `authSession.ts`, `saveFile.ts` and `QrScanner.tsx`
  reach for native modules. `tests/native_icloud_test.ts` reads the import
  lines.
- **A failure crosses the bridge as DATA, never as a rejection.** `src/icloud.ts`
  answers `{ ok: false, kind }` and `cloudHost.ts` turns the kind back into
  the right framework error. `offline` is what keeps the local copy in play;
  collapsing it into `error` is how an unreachable container becomes an empty
  one and the user's recordings get pushed over.
- **A file iCloud has listed is not a file iCloud has downloaded.** The Swift
  side waits for the bytes and reports a timeout as a failure, never as an
  empty document.
- **The iCloud container id is pinned in three files that must agree**:
  `app.config.js`, `identifiers.js` and `modules/icloud-store/index.ts` (and
  the Swift twin). Changing it after release strands every synced copy.
- **The loopback port is fixed** (`src/local-server.ts`, 8331). A web origin
  is scheme + host + port and IndexedDB is keyed by origin, so a random port
  hands the WebView an empty store on every launch. The ladder falls back to
  another _deterministic_ port, and never to `0`.
- **`localhost`, never `127.0.0.1`.** App Transport Security blocks the
  literal address from `WKWebView`; the failure mode is a silent blank page.
- **There is no service worker, and any old one is unregistered.**
- **`native/ios` and `native/android` are prebuild output**, regenerated from
  `app.config.js` and gitignored. Make a fix in the config instead.
- **`native/tsconfig.json` must not `extend` Expo's base.** The base is
  inlined; re-check it against `node_modules/expo/tsconfig.base.json` when
  expo is upgraded.

Native builds run on **EAS** and are dispatch-only
(`.github/workflows/native.yml`) — every run costs build credits. CI's `native`
job only type-checks and runs `npx expo-doctor`. See `native/README.md` and
`native/RELEASING.md`.

## Where new code goes

| Change                                         | Goes in                                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new fact about a recording                   | `src/app/types.ts` (model) + the validation in `migrations.ts` (an additive optional field needs no step) — and ask what reads it                                                  |
| A change to what a take becomes                | `src/app/takes.ts`, with tests in `tests/export_test.ts`                                                                                                                           |
| A change to the tree, or an edit to a record   | `src/app/folders.ts` (pure, tested in `tests/folders_test.ts`) + the store method in `useDocStore.ts`                                                                              |
| A change to what is deleted, or when           | `src/app/types.ts` (`TRASH_DAYS`, `TOMBSTONE_DAYS`, `wantedFiles`, `purgeAfter`) — never a record removed outright, see "A deletion is a tombstone"                                |
| A new export format or quality                 | `src/app/export.ts` (tested) + `useAppSettings.ts` (the default) + `ExportModal.tsx` + `SettingsScreen.tsx` — the encoder itself is the framework's                                |
| The EQ: its bands, presets or arithmetic       | `src/app/eq.ts` (pure, tested in `tests/eq_test.ts`; the record side in `tests/eq_record_test.ts`) + `eqChain.ts` for the browser's half — the two must stay the same curve        |
| A preset for how a take is kept                | `src/app/quality.ts` (pure, tested in `tests/quality_test.ts`) + `QualitySheet.tsx` — the capture reads `recordingKind` / `recordingBitrate`, nothing else                         |
| Where a take's peaks should land               | `src/app/target.ts` (pure, tested in `tests/target_test.ts`) + `TargetLevel.tsx` — the ceiling stays under the framework's hot zone                                                |
| What Listening reads, or its verdict           | `src/app/levels.ts` (pure, tested in `tests/levels_test.ts`) — read against the target (`target.ts`); hot and clipping are the framework's `meterTone` and lamp, never the range's |
| How the meter shows the target                 | `src/app/BigMeter.tsx` + `.app-meter-big` in `styles.css` — the meter itself is the framework's `LevelMeter`, never a second one                                                   |
| A look, or its name                            | `src/app/look.ts` (the table and the resolution, tested in `tests/look_test.ts`) + its words in `i18n/en.ts` under `look` — the palette itself is the framework's                  |
| How a meter or a playhead keeps time on screen | `src/app/pacing.ts` / `src/app/playhead.ts` (pure, tested) — the ballistics stay the framework's `stepMeter`                                                                       |
| Anything done to a folder from the UI          | `src/app/FolderPicker.tsx` (browse mode's ⋯ menu, or New folder) over the edits in `folders.ts` — there is no folders page                                                         |
| Where an element goes, or a screen's layout    | `docs/design.md` first — the answer should be derivable from it, and if it isn't, it is added there before the code                                                                |
| A change to the meter, the spectrum, capture   | The framework's `audio` module, not here — this app draws what it is handed                                                                                                        |
| A new setting                                  | `src/app/useAppSettings.ts` (shape + clamping, tested) + a `Section` in `SettingsScreen.tsx`                                                                                       |
| A new screen                                   | `src/app/<Name>Screen.tsx` + a tab in `src/app/BottomNav.tsx`, or a button in `src/app/TopBar.tsx` if it is an action rather than a place                                          |
| Something only the desk does                   | Behind `useDesk()` in `App.tsx`, or a `lg:` class / `@media (min-width: 64rem)` rule — the phone shell stays as it is                                                              |
| A new storage backend                          | The framework, not here — this app only wires adapters up in `useSyncEngine.ts`                                                                                                    |
| A backend only some hosts can offer            | `src/app/cloudHost.ts` (the capability, tested in `tests/cloudHost_test.ts`) + a row in `useSyncEngine.ts`'s `PROVIDER_NAMES` and its `available` — never a check for the wrapper  |
| A change to what the sweep moves               | `src/app/types.ts` (`wantedFiles`) and `useSyncEngine.ts`'s `sweep` — the transfer itself is the framework's `reconcileFiles`                                                      |
| A change to what the demo shows                | `src/app/dev/demoData.ts` (offsets from `now`, never fixed dates), with tests in `tests/demo_test.ts`, which opens it on every day of a year and at hours around the clock         |
| A new developer-only affordance                | `src/app/dev/`, revealed behind `settings.devMode` in `SettingsScreen.tsx`                                                                                                         |
| Anything in the native wrapper                 | `native/...` — and read "The native wrapper" above first                                                                                                                           |
| Any user-facing string                         | `src/app/i18n/en.ts`, never inline in a component                                                                                                                                  |
| A shared UI primitive                          | The framework, if it is domain-free; `src/app/` only if it is recorder-specific                                                                                                    |

## Test conventions

Tests live in `tests/` with a `_test` suffix and run under Vitest in the `node`
environment — they cover the pure domain modules (`types`, `folders`, `merge`,
`migrations`, `takes`, `export`, `format`, `levels`, `quality`, `target`, `pacing`,
`playhead`, `look`, `eq`, `howl`,
`useAppSettings`'s parser, `shortcuts`, `cloudHost`, `selfHosted`,
`demoData`), which is where the app's
real logic is. `native_icloud_test.ts` pins the strings the wrapper and the app
have to agree on and guards the import discipline that lets it import from
`native/` at all; `native_auth_session_test.ts`, `native_save_file_test.ts` and
`native_scan_qr_test.ts` do the same for the other three bridges, against the
framework's own halves. No DOM, no testing-library, no mocked clock:
`tests/fixtures/shell.ts` stands in for a browser's download and the phone
app's WebView, and `tests/fixtures/helpers.ts` holds the shared fixtures (a
recording, a folder, a named-id `ctx`).

`make test` runs them all; run one file with `npx vitest run tests/folders_test.ts`.
`tests/demo_test.ts` walks the demo across a whole year, at hours from just
after midnight to just before the next. Use the Node `.nvmrc` pins (from nvm).

A change to the model or the tree without a test that pins the new behaviour
to real dates is not finished. UI changes should keep the boot smoke path
working: `npm run build && npm run preview`, press Record, stop, save, and
check that the recording plays from the list and exports. **A UI change is also
looked at**: `make shots` (the `screenshot` skill) shoots the demo build on a
phone, an iPad and a desk in both themes and lays the frames on contact
sheets — read the sheet, fix what is wrong, shoot again, before the PR.

## Source file size

Non-test source files stay under **1000 physical lines**; prefer splitting by
concern over relaxing the cap. A file may opt out with
`guidelines:allow-large-file: <reason>` in a comment in its first 20 lines, and
the reason must be real.

## Changelog and feature docs

`CHANGELOG.md`'s released sections are **generated** — never hand-edit them.
Every user-visible change adds a fragment under `.changes/unreleased/`:

```
.changes/unreleased/$(date +%s)-short-slug.md
---
type: Added        # Added | Changed | Fixed | Removed | Security | Deprecated
title: Short bold title
breaking: true     # optional — forces a major release
---

One sentence a user will read in the changelog.
```

A fragment for a substantial feature names its doc under `docs/features/`
with `doc: <slug>` in the front matter; the collator renders that as a
**Learn more** link.

## Documentation sync points

| If you change…                                   | Update…                                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| The `Recording` or `Folder` shape                | `docs/architecture.md`'s data shape, `docs/features/library.md`, and the validation in `migrations.ts`                                          |
| `takes.ts` or `RecordScreen.tsx`                 | `docs/features/record.md` and the README's Usage table                                                                                          |
| `export.ts`                                      | `docs/features/export.md` and the README's Usage table                                                                                          |
| The sync engine or the merge                     | `docs/sync.md`, `docs/features/cloud-sync.md`                                                                                                   |
| `cloudHost.ts` or the bridge                     | `docs/sync.md`, `docs/features/native-app.md`, `native/README.md`, and `tests/native_icloud_test.ts` — which pins the strings both halves share |
| Anything under `native/`                         | `docs/features/native-app.md`, `native/README.md`, `native/RELEASING.md`                                                                        |
| A `VITE_*` variable                              | `docs/configuration.md`, `src/vite-env.d.ts`, the README's Configuration table, and the workflows that pass it                                  |
| A screen's behaviour                             | The matching `docs/features/*.md` and the README's Usage table                                                                                  |
| A screen's layout, or where an element is placed | `docs/design.md` — the design reference, and the why behind every placement; its sketches and its "What was removed" table                      |
| The navigation (nav or top bar)                  | `docs/architecture.md`'s tree and the README's Usage tables                                                                                     |
| Module layout                                    | The "Where new code goes" table above and `docs/architecture.md`                                                                                |
| A make target or script                          | `CONTRIBUTING.md`, the README's Quick start, and this file's command list                                                                       |

## Parity and cross-cutting rules

- **Every string goes through `t()`.** English is the only catalog today; the
  runtime is in place so adding a language is one `loaders` entry.
- **Looks, not palettes.** A mode (light, dark, follow the device) and a
  look for each side, which are the framework's palettes under the app's
  own names for creative people — Studio, Vinyl, Neon, Paper, Dawn… —
  (`src/app/look.ts`, `docs/features/themes.md`). Never show a reader a
  palette's programmer name (GitHub, Dracula, Solarized), and never offer
  the framework's full appearance picker (fonts, radius, custom colours). A
  look changes how the app feels, never what a colour means: red is too
  loud in every one.
- **Two destinations, no sidebar, no drawer.** Record and Recordings on the
  bottom bar, in that order, a swipe moves between them; on the desk the same
  two are tabs on the top bar. They are the two places a person _is_: at the
  microphone, or among what it made. Folders are not a third place — a
  folder is a label on a recording, so it is filed, switched and managed from
  the library's scope picker and from the recording itself (see
  `docs/design.md`). Things you do and then leave belong on the top bar as
  glyphs, which is where the sync glyph, the space glyph and Settings are. A
  new _action_ is a top-bar button, not a tab. While a take is recording or
  waiting in Review, the bottom bar is hidden and the swipe and the tabs are
  off — the Record screen is the only place on offer until Save or Discard.
- **Nothing is written until Save.** A take lives in memory from Stop to
  Save; Discard throws it away and nothing was ever anywhere. Never write a
  take on Stop "to be safe". Listening keeps nothing at all: it is a capture
  that is only ever cancelled, never saved, started over every few minutes
  so it holds no more than that in memory — never add a way to keep what it
  heard. The microphone opens only on Listen, Record or a Monitor (the EQ
  sheet's, or the headphones glyph while Listening or Recording), never at
  launch; the monitor is microphone → filters → headphones, with no
  recorder on the path — never add one, and never route the monitor into
  the take.
- **One target, everywhere a level is judged.** The waveform's band and
  colours, the meter's band and colour and Listening's verdict all read the
  same range (`target.ts`); a new place that judges a level reads it too,
  never the framework's good zone on its own. Red stays the framework's
  (over −3 dB, or a clip): no target can make a hot reading look safe.
- **The clip lamp is never the only signal.** The meter's red zone, the
  latched clip lamp (on the Record screen a glyph — a wave with its tops cut
  flat, `ClipIcon` and `.app-meter-big` — rather than a word), the "Too
  loud" warning in words and the status region under the meter are four ways
  of saying one thing; a change that drops one of them drops it for somebody.
- **A space is a container, not a filter.** Spaces have their own documents
  and their own files on a backend; a folder is a label inside one. Moving a
  recording between spaces is not offered, on purpose — it would be a copy
  of the bytes and a tombstone, and the merge has no way to say "moved".
- **No dependency creep.** The framework, Preact, two fonts, workbox-window,
  and the MP3 encoder the framework's optional entry needs
  (`@breezystack/lamejs`, fetched only when an MP3 is exported). A new runtime
  dependency needs a reason that the framework can't serve. Fonts are
  `@fontsource` packages, bundled from this origin, never reached for over
  the network.

## Website staleness

The app _is_ the website — `pages.yml` builds it and deploys `dist/`. There is
no separate marketing site to drift out of date, but the `<head>` copy does:
when the app's description changes, update `index.html`'s title/description/OG
and the manifest copy in `pwa-plugin.ts` together.

The website is unlisted: it is a testing surface, and people install the app
from its store listing. Every page it emits carries a robots `noindex`, and it
ships no sitemap, structured data, `llms.txt`, SEO or Lighthouse workflow, and
no page-weight or chunk budget.

## Maintenance skills

Skills live under `.agents/skills/`; `.claude/skills` is a symlink into that
tree. Each has a `SKILL.md` with its discovery process, its source→output
mapping, and a `.last-updated` marker.

| Skill             | Runs when                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `maintenance`     | The registry and run order for every other skill — start here                             |
| `write-changeset` | Any user-visible change, before opening the PR                                            |
| `update-docs`     | `src/app/` changed in a way a `docs/` topic describes                                     |
| `update-readme`   | Commands, configuration, or the feature set changed                                       |
| `screenshot`      | While developing anything a person sees — shoots the app on contact sheets (`make shots`) |
