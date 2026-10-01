# The app on a phone

The same app ships to the **App Store** and **Google Play** through a thin
native wrapper (`native/`): the whole web build packed inside the download and
served from the device, so it runs with no network at all. Everything you see
is the web app, unchanged.

Two things are different, and they are the reason the wrapper exists:

- **It needs no network, ever.** The app is inside the download rather than
  fetched and cached, so a first launch on a phone that has never been online
  is like a hundredth.
- **iCloud Drive** is a backend, beside Dropbox and your own server, offered
  by the wrapper to the page as a capability. The recordings land in the
  app's own container under **Files → iCloud Drive → the app's name**, where
  you can open and copy them.

Three more are phone conveniences: the **share sheet** takes an export or
the original file; the pairing sheet for your own server has a **Scan**
button that reads the code with the camera — only then, and keeping no
picture; and the **Microphone** sheet on the Record screen lists the
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
