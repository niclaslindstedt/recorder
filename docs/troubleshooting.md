# Troubleshooting

## Install and build

| Symptom                                               | Fix                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm install` fails with `401 Unauthorized` or `E404` | `@niclaslindstedt/oss-framework` comes from GitHub Packages, which needs a token with `read:packages` in `~/.npmrc` even for public packages.                      |
| `make native-typecheck` cannot find `expo`            | `native/` has its own dependency tree: `make native-install` first.                                                                                                |
| The build says `Mp3Encoder is not exported`           | The MP3 encoder is an optional peer of the framework; `npm install` at the root installs it (`@breezystack/lamejs`). A build without it exports WAV and FLAC only. |

## Recording

| Symptom                                     | Fix                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The microphone is off for this app"        | The site (or the app, on a phone) was refused the microphone. Allow it in the browser's site settings, or in the phone's Settings for the app, and press Record again.                                                                                |
| The meter moves but the recording is silent | Another app holds the microphone exclusively, or the device picked a different input. Close the other app; on a desktop, check the system's input device.                                                                                             |
| The clip lamp keeps latching                | The sound is louder than the microphone can take. Move it further away, speak more softly, or turn voice processing on in the Record screen's **Quality** sheet to let the device level it.                                                           |
| Recordings are too quiet                    | Press **Listen** before a take and move until the verdict says **Good level** (peaks between −18 and −6 dB). Voice processing adds automatic gain; an export can be normalised in another program, but the app itself never alters what was recorded. |
| A lossless take is huge                     | About four megabytes a minute is what "every sample" costs. A Standard take is under a megabyte a minute; choose it in the Record screen's **Quality** sheet.                                                                                         |

## The library and sync

| Symptom                                    | Fix                                                                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A recording says "Not on this device yet"  | The index arrived before the file. The sweep fetches it; **Settings → Storage → Sync recordings now** runs it by hand.                                                             |
| A deleted recording came back              | Deletions are tombstones kept for 30 days in Recently deleted, then 90 more silently; a device that had not synced in longer than that can bring the record back. Delete it again. |
| Storage shows "Reconnect needed"           | The provider's session lapsed. Tap the sync glyph → Reconnect.                                                                                                                     |
| "That passphrase does not open the copy"   | The copy on the backend was sealed under another passphrase, perhaps changed on another device. There is no recovery without it; the recordings on this device are untouched.      |
| A space made on another device is not here | The list of spaces is per device. **Settings → Storage → Look for spaces** lists the ones the backend holds; open one to sync it here.                                             |

## Recovery

Everything the app keeps is in the browser's storage for its origin (see
[`configuration.md`](configuration.md)). **Settings → Your data → Download
the index** writes a JSON file of the open space's records without the audio;
**Restore an index** merges one back. The audio itself is on the connected
backend, or in the export you made — an export as WAV or FLAC is a copy that
loses nothing.
