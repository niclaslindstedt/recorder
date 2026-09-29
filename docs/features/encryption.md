# Encryption

For Dropbox and iCloud, **Settings → Storage → Encrypt the copy** seals the
copy with a passphrase before it leaves the device: the index, and every
recording's file. Nobody — not the provider, not us — can open it without the
passphrase.

The passphrase is remembered on this device for that backend. Another device
that meets the sealed copy asks for it once; a passphrase changed on one
device asks again on the others. **Change passphrase** re-seals the copy under
the new one.

There is no way back without it: a forgotten passphrase leaves the copy on
the backend unreadable. The recordings on the device are not affected —
they are never sealed there — so the way out is to disconnect, delete the
sealed copy on the provider's side, and connect again.

Your own storage server takes no passphrase here because it seals everything
itself, with keys that never leave your devices; see
[`cloud-sync.md`](cloud-sync.md).
