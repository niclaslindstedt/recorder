# The app on a phone

The same app ships to the **App Store** and **Google Play** through a thin
native wrapper (`native/`): the whole web build packed inside the download and
served from the device, so it runs with no network at all. Everything you see
is the web app, unchanged.

Two things are different, and they are the reason the wrapper exists:

- **It needs no network, ever.** The app is inside the download rather than
  fetched and cached, so a first launch on a phone that has never been online
  is like a hundredth.
- **iCloud Drive** is a backend, beside Dropbox, offered
  by the wrapper to the page as a capability. The recordings land in the
  app's own container under **Files → iCloud Drive → the app's name**, where
  you can open and copy them.

Two more are phone conveniences: the **share sheet** takes an export or
the original file, and the **Microphone** sheet on the Record screen lists the
phone's own microphones and outputs, so a take can be recorded on the phone
while you listen on Bluetooth headphones (see
[Microphone and output](record.md#microphone-and-output)). On Android 12
and later, opening that sheet asks once for the **Nearby devices**
permission, which is what lets the app see a Bluetooth headset you have
already paired; it never scans for new ones.

The microphone is asked for the first time you press Record, with the app's
own sentence about what it is for, and never at launch. Refusing it leaves
the meter dark and the app saying why; allow it under the phone's Settings
for the app.

The phone app updates through the store, like any other; there is no "a new
version is ready" prompt inside it. See [`../sync.md`](../sync.md) for how
iCloud fits in, and `native/README.md` in the repository for how it is built.

## No storage server, for now

The phone app does not offer **your own storage server** for now — the
owner's decision, until it has been proven on the web: the picker has no such
option and nothing on the screen names it. The website and the desktop app
keep it. A phone that was paired with a server under an earlier build opens
on the copy on the phone, with every recording it held; the copy on the
server stays where it was.
