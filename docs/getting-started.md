# Getting started

Recorder is a voice recorder that runs in the browser, installs as a PWA, and
ships as the same app on the App Store and as a desktop download. Nothing
leaves your device unless you connect a backend of your own.

## Use the hosted app

Open [recorder.niclaslindstedt.se](https://recorder.niclaslindstedt.se/) and
install it from the browser's install prompt ("Add to Home Screen" on a phone).
It works fully offline once installed; the service worker keeps the app itself
cached and tells you when a newer build is ready.

## Run it locally

```sh
npm config set //npm.pkg.github.com/:_authToken <your-token>   # read:packages
git clone https://github.com/niclaslindstedt/recorder.git
cd recorder
npm install
npm run dev
```

The framework the app is built on comes from GitHub Packages, which needs a
token even for public packages — see [`configuration.md`](configuration.md).

`make demo` starts the dev server on a library of invented recordings held in
memory (`VITE_SEED=demo`), so the list, the player and the export have
something to work on without touching this browser's own recordings.

## Your first recording

1. Open **Record**. To set a level first, press **Listen** under **Check your
   level**: the microphone opens, nothing is kept, and a verdict under the
   meter says whether you are too quiet, good, or too loud.
2. Press the big button. The browser asks for the microphone once; the timer
   runs, the meter comes alive, and the waveform scrolls above it. If the
   loudest parts go red and the clip lamp latches (a wave with its top cut flat), the sound is louder
   than the microphone can take — back off and the lamp clears after a
   moment.
3. Press **Stop**. The screen asks for a title and shows where the take will
   be saved; play it back if you like, then **Save** files it, and the trash
   glyph throws the take away. Nothing is written until you save.
4. Open **Recordings**: the new one is at the top. Tap it to play, with its
   shape drawn under the playhead and the facts about the take beneath.
5. Its menu has **Export…**, which writes it out as WAV, FLAC or MP3 at the
   quality you pick.

See [`features/record.md`](features/record.md) for the Record screen's modes,
the meter and the Quality sheet, and [`features/export.md`](features/export.md) for the
export sheet.

## Where the data lives

In the browser, in IndexedDB: one index per space naming every recording and
folder, and the audio files beside it. Clearing the site's data removes them.
Under **Settings → Storage** you can connect your own Dropbox, your own
storage server, or — in the phone app — iCloud Drive, and the app keeps a copy
there and syncs it between devices: see [`sync.md`](sync.md). The copy on
Dropbox or iCloud can be sealed with a passphrase; the copy on your own server
always is.
