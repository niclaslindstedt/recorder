# Sync

Off by default. The app keeps every space on the device, in IndexedDB, and
that is where it stays until you connect a backend under **Settings →
Storage**. Then the app keeps a copy there and syncs it between the devices
that share the backend.

## The shape of it

A space on a backend is two things: an index and a folder.

```
recorder-<space>.json      the document — every folder and every record
recorder-<space>/          the recordings' files, one per record, named `<id>.<ext>`
```

The index is pushed a moment after every edit (debounced 1.2 s on the store's
edit counter) and pulled when the space opens, when a backend is connected,
and whenever the backend's watch reports a change. A pull merges the other side's copy into this one record by record,
the later edit winning — see [`architecture.md`](architecture.md) for the
merge — and then writes the merged document back if it differs.

After every push and pull the **sweep** runs: it compares the files this
device has against the files the backend has, sends the ones the backend
lacks, fetches the ones this device lacks, and — once the document has been
pushed, so the other side has already heard about the deletion — removes the
ones no record names any more. The list of files the sweep keeps in step is
`wantedFiles`: every live recording's, and every recording still in the trash.
The sweep is the framework's `reconcileFiles` over two byte stores; what
differs per backend is only which store stands on the far side.

**Settings → Storage** shows the sweep — how many files are moving, and what
the last one sent, fetched and removed — and has a button to run it by hand. A
recording whose file has not arrived yet says so in the list ("Not on this
device yet") and in the player, and plays the moment it has.

## Dropbox

Appears when the build carries `VITE_DROPBOX_APP_KEY`. Connecting opens
Dropbox's own sign-in (PKCE, so the app holds no secret) and files the spaces
under `Apps/<app folder>/` in your account. Dropbox notices a change made on
another device through its long-poll, so a second phone picks the index up
within seconds; the files follow in the sweep.

## iCloud Drive, and the host that offers it

In the phone app and nowhere else: a browser cannot reach a device's iCloud.
The wrapper installs a **host** on `window` — `window.__recorderCloudHost`,
announced with the `recorder:cloud-host` event — offering seven methods:
`status`, the framework's four file-store methods for the index, and
`readBytes` / `writeBytes` for the recordings' files, which cross the bridge
as base64. `src/app/cloudHost.ts` validates the host before trusting it and
turns it into an ordinary framework adapter and byte store, so everything
downstream is the code path Dropbox takes.

The question it asks is about capability, not identity — never "am I inside
the wrapper?", only "did something offer a store?". A failure crosses the
bridge as data (`{ ok: false, kind }`), and the three kinds go to three
places: `auth` means the device is signed out of iCloud (Reconnect),
`offline` keeps the local copy in play, and anything else stops the sync. The
files land in the container's `Documents` folder, which iCloud publishes to
the Files app under the app's name, so you can open and copy them yourself.

## Your own server

The fourth backend is a [storage server](https://github.com/niclaslindstedt/storage)
you run yourself. It is end to end encrypted: the app pairs with a code the
server's admin console makes (pasted on the website, scanned with the camera
in the phone app, or opened as an app link from the QR code), makes the
account's keys on the first device — with a recovery key you are asked to
store — and thereafter every byte it sends is ciphertext the server cannot
read, index and files alike. A second device is approved from the first, or
recovered with the recovery key. The keys stay in the framework's key vault
on the device; nothing about them is ever in localStorage, a log or a backup.

The namespace's adapter is an ordinary framework `StorageAdapter`, so the
engine treats the server like Dropbox, and its `watch` pulls another
device's push in as it happens. Because the server seals everything itself,
the passphrase encryption below is not offered for it — there is nothing
left to seal.

## Encryption

For Dropbox and iCloud, **Settings → Storage → Encrypt the copy** seals the
copy with a passphrase: the index through the framework's encryption
wrapper, and every file through the same key (`sealBytes` / `openBytes`, a
small header, PBKDF2 and AES-GCM). The passphrase is remembered on the device
per backend; a device that meets a sealed copy asks for it, and a passphrase
changed elsewhere asks again. There is no way back without it — a forgotten
passphrase leaves the copy unreadable, and the recordings on the device are
not affected.

## Spaces

Each space is its own index and its own folder, so a backend can hold several
— Personal and Work, or one per client. The list of spaces is per device;
**Settings → Storage → Spaces on the backend** lists the `recorder-*.json`
files the backend holds so a space made on another device can be opened
here. See [`features/spaces.md`](features/spaces.md).

## What is sent

To a backend you connected: the index and the files of the spaces you open
on this device, and nothing else. Not the settings, not the list of spaces,
not the log. To anywhere else: nothing, ever — the app makes no network call
that is not the connected backend's, and the MP3 encoder is a package
bundled with the build rather than something fetched.

## Demo data

The developer "Demo data" switch swaps in an in-memory library and suspends
the sync engine wholesale while it is on. Nothing on the device or on a
backend is touched; a reload restores your own recordings.
