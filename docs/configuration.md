# Configuration

The app runs with no configuration. Everything below is optional: build-time
variables that switch a backend on or mark which build this is, and the
per-device settings the app keeps for itself.

## Build-time variables

Read through `import.meta.env` at build time (`src/vite-env.d.ts` declares
them). None is a secret: the Dropbox key is a PKCE public-client identifier.

| Variable                  | Default    | Effect                                                                                                                                                                                                             |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_DROPBOX_APP_KEY`    | unset      | Enables the Dropbox backend. Unset hides it from **Settings → Storage**.                                                                                                                                           |
| `VITE_DROPBOX_APP_FOLDER` | `recorder` | The app folder under `Apps/` in the user's Dropbox that the spaces are filed in.                                                                                                                                   |
| `VITE_BASE`               | `/`        | The deploy base path. The Pages workflow sets it per slot.                                                                                                                                                         |
| `VITE_EDITION`            | unset      | `store` marks the build sold in the App Store: it carries no Open Graph tags, `CNAME` or `og.png` (`websiteOnly` in `vite.config.ts`). Anything else is the free web edition.                                      |
| `VITE_SHELL_BUILD`        | unset      | `on` is set by the two wrapper bundle scripts: no service worker is emitted and the in-app update prompt is off, because a phone or desktop build updates by being replaced.                                       |
| `VITE_SEED`               | unset      | `demo` boots onto the in-memory demo library (`make demo`, the store screenshots). Never set for a release.                                                                                                        |
| `APP_DISPLAY_NAME`        | `Recorder` | An app build's name, inlined as `__APP_NAME__` and shown wherever the app names itself. The website always says `Recorder`. Set from a secret at packaging time; the listing's name never lives in the repository. |

iCloud takes no variable: it is offered by the phone app's host, so it appears
there and nowhere else. The self-hosted backend takes none either — a pairing
code from the user's own server is the whole configuration.

## The native wrapper's variables

`native/` reads its own (`native/identifiers.js`, `native/src/config.ts`):

| Variable                   | Effect                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `APP_DISPLAY_NAME`         | The listing's name. Required for a production build.                                                                            |
| `APP_BUNDLE_ID`            | The bundle identifier, and with it the URL scheme (`<id>://oauth` is the Dropbox redirect). `dev.local.recorder` in a checkout. |
| `EAS_PROJECT_ID`           | The EAS project the build runs under.                                                                                           |
| `EXPO_PUBLIC_RECORDER_URL` | Debug only: points the WebView at a deployed slot instead of the bundled build. A store build must not set it.                  |

The desktop shell takes `APP_DISPLAY_NAME` and `APP_BUNDLE_ID` at packaging
time (`tauri/scripts/package.mjs`), and `RECORDER_APP_URL` as its debug
override.

## Runtime settings

Per device, persisted in `localStorage` and clamped on read
(`src/app/useAppSettings.ts`). How a take is kept and voice processing are
set in the Record screen's **Quality** sheet; the rest under **Settings**:

| Setting                      | Values                                 | Default     |
| ---------------------------- | -------------------------------------- | ----------- |
| Theme                        | Light, Dark, Device                    | Device      |
| Quality: how a take is kept  | Compact, Lossless                      | Compact     |
| Bitrate (compact)            | 64 · 96 · 128 · 192 · 256 · 320 kbit/s | 128         |
| Voice processing             | on / off                               | off         |
| Visualizer                   | Waveform, Spectrum, Spectrogram        | Waveform    |
| Skip buttons move            | 5 · 10 · 15 · 30 s                     | 15          |
| Export format                | WAV, FLAC, MP3                         | MP3         |
| Export WAV depth             | 16 · 24 · 32-bit float                 | 16          |
| Export FLAC compression      | Fast (0), Normal (5), Best (8)         | Normal      |
| Export MP3 bitrate           | 64 · 96 · 128 · 192 · 256 · 320 kbit/s | 128         |
| Export sample rate           | As recorded, 22.05, 44.1, 48 kHz       | As recorded |
| Export mono                  | on / off                               | on          |
| Developer mode, capture logs | on / off                               | off         |

The export sheet starts on the export defaults and writes the choice it was
used with back to them.

## Storage keys

Everything the app keeps on a device, by key. Clearing the site's data removes
all of it.

| Key                                  | Where        | Holds                                                                                       |
| ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------- |
| `recorder:documents`                 | IndexedDB    | One document per space: the folders and the records                                         |
| `recorder:files`                     | IndexedDB    | The recordings' bytes, one row per file, keyed by space and file name                       |
| `recorder:settings`                  | localStorage | The settings above                                                                          |
| `recorder:namespaces`                | localStorage | The spaces this device knows                                                                |
| `recorder:namespace:active`          | localStorage | Which space is open                                                                         |
| `recorder:sync:backend`              | localStorage | Which backend is connected                                                                  |
| `recorder:sync:dropbox`              | localStorage | The Dropbox session (a refresh token; revoked by Disconnect)                                |
| `recorder:sync:encryption:<backend>` | localStorage | The framework's record of the copy's passphrase, remembered on this device                  |
| `recorder:sync:selfhosted`           | localStorage | Which namespace on the user's own server holds the spaces (the keys are in the vault below) |
| `recorder:sync:selfhosted`           | localStorage | Which namespace on the user's own server holds the spaces; the keys are in the vault below  |
| the framework's key vault            | IndexedDB    | The self-hosted backend's keys — never in localStorage, a log or a backup                   |

The demo library lives in memory only and touches none of these.
