# Recorder

> A local-first voice recorder PWA — record with a meter that shows clipping, keep recordings in folders and spaces, play them back, and export them as WAV, FLAC or MP3. Your recordings stay yours.

[![ci](https://github.com/niclaslindstedt/recorder/actions/workflows/ci.yml/badge.svg)](https://github.com/niclaslindstedt/recorder/actions/workflows/ci.yml)
[![pages](https://github.com/niclaslindstedt/recorder/actions/workflows/pages.yml/badge.svg)](https://github.com/niclaslindstedt/recorder/actions/workflows/pages.yml)
[![license](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](LICENSE)

## What

**Recorder** is a voice recorder that runs entirely in your browser. Press
the button and it records; while it does, a level meter in dBFS shows how
loud you are, a spectrum shows where the sound is, and when the input is too
loud for the microphone the meter goes red and a **CLIP** lamp latches, so
you know before you play it back that the loud parts were flattened. Stop,
give the take a name and a folder, and it lands in **Recordings**, where a
tap plays it with its shape drawn under the playhead and the facts about the
take beneath — how long, what format, the loudest peak, whether it clipped.

A take is kept the way you choose: **compact**, in the device's own encoder
at a bitrate you set (a minute is under a megabyte), or **lossless**, every
sample as FLAC. Either exports as **WAV** (16, 24 or 32-bit float), **FLAC**
(three compression levels) or **MP3** (64 to 320 kbit/s), resampled if you
like and folded to mono by default — all of it encoded on the device, nothing
uploaded to be converted.

**Folders** keep related recordings together, in a tree you arrange by hand,
and **spaces** are separate libraries — Personal and Work, or one per
client — each with its own folders and its own file on a backend. Deleting a
recording moves it to **Recently deleted** for thirty days first.

Nothing leaves the device unless you connect a backend of your own: **Dropbox**,
your own [storage server](https://github.com/niclaslindstedt/storage), or —
in the phone app — **iCloud Drive**. Then the app keeps a copy there — an
index per space and the recordings' files beside it — and syncs it between
your devices, recording by recording, last edit wins. The copy on Dropbox or
iCloud can be sealed with a passphrase; the copy on your own server always
is, with keys that never leave your devices.

The same app ships to the **App Store** and **Google Play** through a thin
native wrapper in [`native/`](native/README.md) — the whole web build packed
inside the download and served from the device, so it runs with no network at
all — and as a desktop download for Windows, macOS and Linux from
[`tauri/`](tauri/README.md).

It is built on [`@niclaslindstedt/oss-framework`](https://github.com/niclaslindstedt/oss-framework),
whose `audio` module is the microphone capture, the meter and its clip
detector, the spectrum, the encoders and the player; what lives here is what
a recording is and where it goes.

## Why

The recorder that comes with a phone keeps its recordings where the phone's
maker keeps them, in a format it chooses, and organises them as a list. This
one keeps them where _you_ choose — on the device, in your own Dropbox or
iCloud, or on a server you run — in a format you can read back in any
program, with folders and spaces to file them in, and it tells you while you
are recording that the take is clipping rather than after. No account, no
telemetry, and no network call that is not the backend you connected.

## Prerequisites

- Node.js ≥ 22 (CI pins 24 — see `.nvmrc`), npm ≥ 10
- A GitHub personal access token with `read:packages` in `~/.npmrc` — the
  `@niclaslindstedt/oss-framework` dependency resolves from GitHub Packages

## Install

```sh
npm config set //npm.pkg.github.com/:_authToken <your-token>
git clone https://github.com/niclaslindstedt/recorder.git
cd recorder
npm install
```

Or just open the hosted app at
[recorder.niclaslindstedt.se](https://recorder.niclaslindstedt.se/) and
install it from your browser's "Add to Home Screen" / install prompt — it is a
PWA and works fully offline.

## Quick start

```sh
npm run dev
```

Open the printed URL. The app opens on **Record**: press the button, allow
the microphone, say something, and press **Stop**. Name the take and save it;
it is now in **Recordings**, where a tap plays it and its menu exports it.

To open it on a demo instead — a fortnight of invented recordings, held in
memory and never written to the browser — run `make demo` (`VITE_SEED=demo`).

To try the production build the way it deploys:

```sh
npm run build && npm run preview
```

The native wrapper is a separate project with its own dependencies — a root
`npm install` does not touch it:

```sh
make native-install      # install the wrapper's dependencies
make native-bundle       # build the web app into native/assets/webroot.zip
make native-typecheck
```

See [`native/README.md`](native/README.md) for running it on a device, and
[`native/RELEASING.md`](native/RELEASING.md) for a store build. The desktop
shell is `make tauri` (a Rust toolchain; see [`tauri/README.md`](tauri/README.md)).

## Usage

Three places to be. On a phone they are the bottom bar — swipe left or right
to move between them; on a desk (a window 1024px or wider) they are tabs on
the top bar and Settings slides in over the right-hand edge. In a dialog,
`Enter` saves and `Escape` cancels.

| Tab            | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Record**     | The timer, the level meter with its peak and its clip lamp, the spectrum, the take's shape so far, and the button. Press to start, **Pause** to hold, **Stop** to finish; the sheet that follows takes a title and a folder, and **Save** files it — nothing is written before that, and **Discard** throws it away. The line under the button says how the take is being kept (compact at a bitrate, or lossless) and where to change it.                                              |
| **Recordings** | The list, newest first, with the day, the length and the shape of each. Chips narrow it to a folder, to Favorites or to Recently deleted, and the search matches titles and notes. Tap a row to play it — seek on its shape, skip by the length you set, change the speed, write a note, read the facts about the take. Swipe to delete; hold (or right-click) for favorite, move, export, share the original file. Recently deleted keeps a recording thirty days and can put it back. |
| **Folders**    | The tree: folders inside folders, each with its count, arranged by hand. Deleting a folder moves what is inside it up a level and deletes nothing recorded.                                                                                                                                                                                                                                                                                                                             |

…and two buttons on the top bar, for the things you visit and leave:

| Button | What it does                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **⚙**  | Settings: theme, how a take is kept and at what bitrate, voice processing, the spectrum, the skip length, the export defaults, the spaces, storage (Dropbox, your own storage server, and iCloud in the phone app) with its encryption and the file sweep, download or restore the index, delete the space's data on this device, developer tools, and the build. |
| **◉**  | The space switcher, top left: which library is open, and the way to another. Spaces are made under Settings.                                                                                                                                                                                                                                                      |

## Configuration

The app needs no configuration to run. One build-time variable switches
Dropbox on; it is a public OAuth client identifier (the flow is PKCE, so there
is no secret to protect), and leaving it unset simply hides that provider:

| Variable                  | Effect                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `VITE_DROPBOX_APP_KEY`    | Enables the Dropbox backend.                                                                                |
| `VITE_DROPBOX_APP_FOLDER` | Folder name the spaces are filed under in Dropbox (default `recorder`).                                     |
| `VITE_BASE`               | Deploy base path (default `/`).                                                                             |
| `VITE_EDITION`            | `store` for the App Store build, which carries no link back to the website. Default: the free web edition.  |
| `APP_DISPLAY_NAME`        | An app build's name, shown in the app: the listing's. The website always says `Recorder`.                   |
| `VITE_SEED`               | `demo` boots onto the in-memory demo library (`make demo`, the store screenshots). Never set for a release. |

iCloud takes no variable at all: it is offered by the native wrapper's host,
so it appears in the phone app and nowhere else. Your own server takes a
pairing code, not a variable.

See [`docs/configuration.md`](docs/configuration.md) for the details.

## Examples

File a recording and read the library back — the domain is pure, so it runs
anywhere, no DOM required:

```ts
import { exportPlan } from "./src/app/export.ts";
import { addFolder, countIn, saveRecording } from "./src/app/folders.ts";
import { emptyDoc, type Recording } from "./src/app/types.ts";

const now = new Date().toISOString();
const ctx = { id: () => crypto.randomUUID(), now: () => now };

const made = addFolder(emptyDoc(), "Interviews", null, ctx);
const folderId = made.folder.id;
let data = made.data;

const take: Recording = {
  id: "r1",
  title: "Tuesday, with Ada",
  folderId,
  createdAt: now,
  updatedAt: now,
  durationMs: 754_000,
  sampleRate: 48000,
  channels: 2,
  kind: "compact",
  mimeType: "audio/webm;codecs=opus",
  fileName: "r1.webm",
  size: 1_240_000,
  peaks: [],
  favorite: false,
  notes: "",
  clipCount: 0,
  maxPeakDb: -7.2,
};
data = saveRecording(data, take);

countIn(data, folderId); // → 1
exportPlan(take, { format: "mp3", rate: 0, mono: true });
// → { channels: 1, sampleRate: 48000 }
```

Every edit is a function from a document to a new one, with ids and the
timestamp passed in through `ctx` — nothing here reads the clock. See
[`docs/architecture.md`](docs/architecture.md).

## Troubleshooting

| Symptom                                     | Fix                                                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm install` fails with `401 Unauthorized` | The framework comes from GitHub Packages — see Prerequisites.                                                                      |
| "The microphone is off for this app"        | Allow it in the browser's settings for this site, or in the phone's Settings for the app, and press Record again.                  |
| The **CLIP** lamp keeps latching            | The sound is louder than the microphone can take: move it further away or speak more softly. The count is kept with the recording. |
| A recording says "Not on this device yet"   | Its file is still on its way from the backend. **Settings → Storage → Sync recordings now** fetches it.                            |
| Storage shows "Reconnect needed"            | The provider's session lapsed. Tap the sync glyph → Reconnect.                                                                     |

More in [`docs/troubleshooting.md`](docs/troubleshooting.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [Recording](docs/features/record.md) — the meter, the clip lamp, and the two ways a take is kept
- [Export](docs/features/export.md)
- [Spaces](docs/features/spaces.md) and [Folders](docs/features/folders.md)
- [Cloud sync](docs/features/cloud-sync.md) and [Encryption](docs/features/encryption.md)
- [The app on a phone](docs/features/native-app.md) — the native wrapper and iCloud
- [The desktop app](docs/features/desktop-app.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Sync](docs/sync.md)
- [Troubleshooting](docs/troubleshooting.md)
- [`AGENTS.md`](AGENTS.md) — conventions for humans and coding agents

## Contributing

Bugs and feature requests go to
[Issues](https://github.com/niclaslindstedt/recorder/issues); open-ended
questions to [Discussions](https://github.com/niclaslindstedt/recorder/discussions).
See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow, and
[`SECURITY.md`](SECURITY.md) for private vulnerability reporting.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) © Niclas Lindstedt.
