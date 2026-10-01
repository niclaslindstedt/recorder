# Architecture

Recorder is a **frontend-only, local-first PWA**: there is no server, no
account and no telemetry. The app is a Vite + Preact bundle over
[`@niclaslindstedt/oss-framework`](https://github.com/niclaslindstedt/oss-framework),
the shared surface behind the sibling `time`, `contacts` and `baby` apps.

```
src/
├── main.tsx                 mounts <App/>, the theme engine and the fonts
├── App.tsx                  the shell: spaces, the store, the sync engine, the screens
├── styles.css               Tailwind + the app's own layout rules
├── output.ts                the central log module — no bare console.* elsewhere
└── app/
    ├── types.ts             the model: Recording, Folder, AppData; the trash rules
    ├── folders.ts           the tree read and edited, as pure functions
    ├── takes.ts             a take finished: what the microphone handed back → a record + bytes
    ├── quality.ts           the four ways a take is kept (Memo, Standard, High, Lossless) and a minute's cost
    ├── levels.ts            Listening's readings: the room, the peak, the headroom, a verdict
    ├── target.ts            the target level: where a take's peaks should land, by source, and a peak's tone against it
    ├── pacing.ts            the capture's frames paced to the display, so the meter moves every frame
    ├── playhead.ts          the player's playhead as a smooth clock over the element's coarse time
    ├── export.ts            WAV / FLAC / MP3 out, through the framework's encoders; the size estimate
    ├── format.ts            durations, timers, day headings, container names
    ├── merge.ts             per-record, last-edit-wins document merge
    ├── migrations.ts        parse / normalise / serialize — the only module that trusts bytes
    ├── useDocStore.ts       one document per space, in IndexedDB, over a DocBackend seam
    ├── blobStore.ts         the recordings' bytes in IndexedDB, as a framework ByteFileStore
    ├── useNamespaces.ts     the spaces, over the framework's namespaces module
    ├── useSyncEngine.ts     the backends, the push/pull, and the file sweep
    ├── cloudHost.ts         the capability a host (iCloud) may offer
    ├── selfHosted.ts        the reader's own storage server as a backend
    ├── useAppSettings.ts    per-device settings, shape + clamping
    ├── look.ts              the looks: the framework's palettes under the app's own names, by day and by night
    ├── useListen.ts         Listening: a capture that is never kept, recycled every five minutes
    ├── RecordScreen.tsx     Record, in four modes: Ready, Listening, Recording, Review
    ├── RecordParts.tsx      the pieces those modes are drawn from; the free-space estimate
    ├── Visualizer.tsx       the waveform, spectrum or spectrogram card
    ├── BigMeter.tsx         the framework's meter at the Record screen's size, with the target on it
    ├── QualitySheet.tsx     how the next take is kept, voice processing, and the target level (TargetLevel.tsx)
    ├── LibraryScreen.tsx    the scope, the search glyph, the list under day headings
    ├── FolderPicker.tsx     the one folder picker: the library's scope, Move, a take's destination
    ├── SearchSheet.tsx      search across the space's titles, notes and folder names
    ├── RecordingRow.tsx     a recording as a row, wherever one is listed
    ├── PlayerModal.tsx      the title, the folder chip, the shape, the transport, the note, the facts
    ├── ExportModal.tsx      the export sheet, and what the file will be
    ├── SettingsScreen.tsx   settings; SidePanel.tsx is the same on a desk
    ├── LookPicker.tsx       the looks as cards, each drawn in its own colours
    ├── TopBar.tsx           the wordmark; sync, space and settings glyphs; the desk's two tabs
    ├── BottomNav.tsx        Record and Recordings, on the phone
    ├── dev/                 the demo library and the in-memory stores that serve it
    └── i18n/en.ts           every user-facing string
```

Dependency direction: screens → stores → framework. Nothing imports from the
framework's internals, only its published subpaths.

## The screens

Two destinations, **Record** and **Recordings**: the bottom bar on a phone
(a swipe pages between them), tabs on the top bar on a desk. The top bar
carries the wordmark and, on the right, the sync glyph (only with a backend
connected), the space glyph (the active space's own symbol in its own
colour, which opens the spaces sheet) and the cog, which opens Settings —
a side panel on a desk. There is no folders page: folders are managed from
the library's scope, in `FolderPicker.tsx`.

Record is one screen in four modes — Ready, Listening, Recording, Review —
rather than a screen with sheets over it. While a take is recording or
waiting in Review, the bottom bar is hidden and the swipe and the desk's
tabs are off, because leaving would end the take. What each screen shows,
and why each element is where it is, is [`design.md`](design.md).

## The framework's share

Everything that does not know what it is for is the framework's, and this app
is its first consumer of the `audio` module:

- **Capture** — `getUserMedia`, the analyser, the worklet tap, and the two
  ways of keeping what comes in: the browser's `MediaRecorder` (a _compact_
  take) or the samples themselves (a _lossless_ one). `useRecorder` is the
  hook the Record screen drives — for a take, and for Listening, which is a
  take that is only ever cancelled (`useListen.ts`).
- **The meter** — the level in dBFS with a peak that holds and falls, and the
  clip detector: three consecutive samples at or above 0.985 of full scale
  is a clip, and the lamp latches for a moment and a half so a single
  transient is not missed. The app draws it with `LevelMeter`.
- **The spectrum** — the analyser's bins folded onto log-spaced bands with a
  little smoothing, drawn with `SpectrumBars`. The Record screen's other two
  views, the scrolling waveform and the spectrogram, are the app's own
  (`Visualizer.tsx`), drawn from the same frames on the meter's own scale,
  and coloured against the target level (`target.ts`) with red from the
  framework's hot zone.
- **The encoders** — WAV (16, 24 or 32-bit float), FLAC (fixed predictors and
  Rice coding, three levels), and MP3 through an optional entry
  (`audio/mp3`) that pulls the encoder package on first use. Decoding goes
  through the browser.
- **The player** — `usePlayer` over an `HTMLAudioElement`, and `Waveform`,
  the recording's shape with the playhead over it.
- **Storage** — the adapters (Dropbox, the self-hosted client), the byte file
  stores beside them, `reconcileFiles` (the sweep that keeps a folder of
  files in step with what a document names), and sealed bytes under a
  passphrase. Also the namespaces module the spaces are built on, the theme
  engine, the modals and form primitives, the toast store, the i18n runtime,
  logging, and the PWA update state machine.

What stays here is the vocabulary: what a recording is, where it is filed,
what a take turns into, what an export is called, and what the screens say.

## The native wrapper's share

`native/` is a thin Expo shell for the App Store and Google Play: the built
site packed inside the download and served from a loopback origin into a
`WebView`. It adds exactly two things a browser cannot do — being
self-contained, and iCloud — and offers the second as a **capability** on
`window` that `cloudHost.ts` looks for, never as a flag the web app checks.
`tauri/` is the same shape of thing for the desktop. See
[`features/native-app.md`](features/native-app.md) and
[`features/desktop-app.md`](features/desktop-app.md).

## The shape of the data

One document per space:

```ts
type AppData = {
  version: 1;
  folders: Record<string, Folder>;
  recordings: Record<string, Recording>;
};

type Folder = {
  id: string;
  name: string;
  parentId: string | null; // null is the top level
  order: number; // arranged by hand
  updatedAt: string;
  deletedAt?: string | null;
};

type Recording = {
  id: string;
  title: string;
  folderId: string | null;
  createdAt: string; // when the take started
  updatedAt: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  kind: "compact" | "lossless";
  mimeType: string; // the container the bytes are in
  fileName: string; // `<id>.<ext>` — the file the bytes are stored and synced as
  size: number;
  peaks: number[]; // the waveform thumbnail, 0..1
  favorite: boolean;
  notes: string;
  clipCount: number; // how many times the take clipped
  maxPeakDb: number; // the loudest peak, dBFS
  deletedAt?: string | null;
};
```

The bytes are not in the document. They live in the blob store on the device
and in a folder beside the document on a backend, under `fileName`, which
`migrations.ts` pins to an id and an extension so a name can never climb out
of that folder.

**A deletion is a tombstone.** Deleting a recording sets `deletedAt` and keeps
the record: the file lives on every backend the space syncs to, and a record
that simply vanished could not tell the other side to drop it. "Recently
deleted" is the tombstones younger than 30 days (`TRASH_DAYS`), and a
recording can be put back from there. After that the file is pruned wherever
the sweep runs, and the tombstone itself goes 90 days later
(`TOMBSTONE_DAYS`), by which time every device is expected to have heard.
Deleting a folder is not a deletion of anything recorded: what was inside
moves up a level.

**Derive, don't store.** The count in a folder, which files are on this
device, what is in the trash and what the sync should carry (`wantedFiles`)
are all recomputed from the document on render. The one derived thing a
record keeps is its waveform thumbnail, because it is made from the samples
while they are being heard and decoding a recording to draw a sixty-pixel
shape in a list would be the wrong price.

## The document pipeline

```
stored bytes ──parseDoc──▶ AppData ──edits (folders.ts)──▶ AppData ──serializeDoc──▶ bytes
                  ▲                                                        │
                  └──── mergeDocs (sync pull, backup restore) ◀────────────┘
```

`migrations.ts` is the only module that trusts stored bytes: it drops what it
cannot read, clamps the rest, and keeps a tombstone even when the record
around it is broken. `merge.ts` reconciles two copies record by record, the
later `updatedAt` winning — a tombstone is an edit like any other, so a
deletion wins over an older copy and a later edit wins over a deletion.
Every edit is a pure function from a document to a new one, with ids and the
timestamp handed in through a `ctx` argument, so nothing in the domain
touches chance or the clock.

## The service worker

`pwa-plugin.ts` emits `sw.js`, `version.json` and `precache-manifest.json` at
build time; the framework's `usePwaUpdate` polls the version file, and the
app shows "A new version is ready" with a Reload. A shell build
(`VITE_SHELL_BUILD=on`, the phone and desktop wrappers) emits no worker at
all: those builds update by being replaced, and a worker keeping an old
precache alive over a replaced bundle is how a store update changes nothing.
