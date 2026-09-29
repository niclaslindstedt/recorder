# Cloud sync

Off by default. Under **Settings → Storage**, choose a backend and the app
keeps a copy of the open space there — an index naming every recording and
folder, and the recordings' files in a folder beside it — and syncs it
between the devices that share the backend.

**Dropbox** opens Dropbox's own sign-in and files the spaces under
`Apps/recorder/` in your account. It appears only when the deploy was built
with its app key (see [`../configuration.md`](../configuration.md)).

**iCloud Drive** is offered in the phone app and nowhere else: a browser
cannot reach a device's iCloud. There is no window to grant anything in — the
container belongs to the iCloud account the phone is signed into — and the
files land under **Files → iCloud Drive → the app's name**, where you can open
and copy them. See [`native-app.md`](native-app.md).

**Your server** keeps the copy on a machine you run yourself — a
[storage server](https://github.com/niclaslindstedt/storage) at home or on a
host you choose. It is end to end encrypted: the server holds the files but
cannot read them. Connecting asks for a pairing code from the server's admin
console (paste it, scan its QR code with the phone app's camera, or open the
link the code carries), and the first device makes the account's keys and a
recovery key to store somewhere safe. A second device is approved from the
first.

Once connected, the sync glyph in the top bar says where things stand, and
the Storage section shows the files moving: what the last sweep sent, fetched
and removed, and a button to run it now. A recording whose file has not
arrived yet says so and plays when it has.

The copy on Dropbox or iCloud can be sealed with a passphrase — see
[`encryption.md`](encryption.md). The copy on your own server always is.

Sync is per-record and last-edit-wins, so two devices editing different
recordings never conflict, and a deletion made on one reaches the others as a
deletion rather than as a recording that comes back. See
[`../sync.md`](../sync.md) for the whole of it.
