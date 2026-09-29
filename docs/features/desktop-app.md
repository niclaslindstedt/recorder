# The desktop app

Recorder runs in any browser, and it installs to a home screen or a dock as a
Progressive Web App. There is a third way to have it: a proper desktop
download for **Windows, macOS and Linux**, attached to every release on the
[releases page](https://github.com/niclaslindstedt/recorder/releases).

## Which file

Pick the one for your machine — the app inside all three is the same app.

- **Windows** — the `.exe` installer.
- **macOS** — the `.dmg`. The release notes say whether it is notarized by
  Apple; if it is, it opens like any other app. If it is signed but not
  notarized, the first launch is refused: open **System Settings → Privacy &
  Security**, scroll to the message about the app and choose **Open Anyway**.
  macOS remembers after that.
- **Linux** — the `.AppImage` runs on anything without installing; the `.deb`
  is for Debian and Ubuntu.

## What is different from the browser

Almost nothing, deliberately. The desktop app is the website with a window
around it: the same meter, the same library, the same export. Three things
are worth knowing.

**It needs no network at all.** The whole app is inside the download rather
than fetched and cached.

**It updates by being replaced.** There is no "a new version is ready" prompt,
because there is no deploy for it to notice — a new version is a new download.

**The microphone is the system's to grant.** The first recording asks
through the platform's own prompt — on macOS with the app's own sentence
about what it is for, listed afterwards under **System Settings → Privacy &
Security → Microphone**. Refuse it there and the meter stays dark until it is
allowed again.

## Where your recordings live

In the app, on your machine, the same way they do in a browser tab — and in a
different place from the browser's. The desktop app has storage of its own,
so the recordings you keep in Chrome are not the ones the desktop app opens.
Connect the same backend in both (**Settings → Storage**) and they share one
library.

Uninstalling the app removes that storage with it, so connect a backend or
export anything you want to keep first.
