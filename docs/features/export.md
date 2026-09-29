# Export

From a recording's menu, **Export…** opens the sheet. It starts on the
defaults under **Settings → Export defaults** and remembers what you pick.

| Format   | What it is                                                | Its settings                      |
| -------- | --------------------------------------------------------- | --------------------------------- |
| **WAV**  | Uncompressed. Every program opens it; the largest file.   | Bit depth: 16, 24 or 32-bit float |
| **FLAC** | Lossless, about half the size of WAV.                     | Compression: Fast, Normal or Best |
| **MP3**  | Small and plays everywhere; some of the sound is dropped. | Bitrate: 64 to 320 kbit/s         |

Two more apply to any format: the **sample rate** (as recorded, or 22.05,
44.1 or 48 kHz — MP3 lands on the nearest of the nine it knows), and
**Mono**, which folds both channels into one. Mono is on by default: a voice
memo is mono in all but name, and the file halves for it.

The file is named after the recording — `<title>.<ext>`, lowercase, no space
in it — and goes to a download on the website and to the share sheet in the
phone app. **Share the original file** hands over the take exactly as the
device kept it, with no re-encoding.

The encoders run on the device: WAV and FLAC are the framework's own, and the
MP3 encoder is a package bundled with the build and loaded the first time an
MP3 is asked for. Nothing is uploaded to be converted.

A compact take exported as WAV or FLAC is the decoded recording, not more
than it was; a lossless take exported as MP3 is the same recording made
small. Neither export changes the recording itself.
