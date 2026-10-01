# Recording

**Record** is the first tab, and it is one screen in four modes rather than
a screen with sheets over it: **Ready** before a take, **Listening** while
you set a level, **Recording** during a take, and **Review** after it. Each
mode lays out the same area for its own job. Why each piece is where it is
is in [`../design.md`](../design.md).

## Ready

The microphone is closed. At the top are the take's three choices, as
buttons. Side by side, how it will sound: **Quality** (the preset's name,
with its bitrate on the caption) opens the Quality sheet, and **EQ** (Flat,
a preset's name, or Custom) opens the [equalizer](equalizer.md) — the EQ
new takes start with, which you can **Monitor** on headphones before you
record. Under them, the whole width, **Save to** (the folder a new take is
filed in) opens the folder picker. Save to starts on the folder the library
is showing, so pressing Record while you are in Interviews files the take
there.

Under them, **Check your level** offers Listening. What you have recorded
is on the **Recordings** screen, not here. The big red button, **Tap to record**, sits centred in the room
that is left. Press it and the browser asks for the microphone once.

## Listening

**Listen** opens the microphone and keeps nothing. It is the mode for
setting a level, placing a microphone or checking a room. The screen shows
the visualizer, the big meter, and three readings over the last four
seconds:

- **Room** — the noise floor, the quiet end of the level: is the café too
  loud, is the fridge in the take?
- **Peak** — the loudest moment.
- **Headroom** — how far that peak is from clipping.

Under them a **verdict** says it in words, on the meter's own zones:
nothing heard, too quiet (peaks under −18 dB), a good level (−18 to −6),
loud (−6 to −3), very hot (over −3), or clipping.

Listening runs on the same capture path as a take, voice processing
included, so what the meter says is what a take will get. It is a take that
is never kept: it is cancelled on **Stop** or when you leave the screen,
and it quietly starts over every five minutes, so it never holds more than
that in memory and writes nothing, ever. Pressing record from Listening
starts the take with the level already set.

## Recording

The timer is the headline, in tenths, with a pulsing dot; the line under it
repeats the quality and the folder, read-only. The visualizer takes the
height the other rows leave, with **the whole take so far** as a thin strip
along its foot. Under the meter, four figures say what the take is so far:

- **Peak** — the loudest moment, red past −3 dB.
- **Clips** — how many times it has clipped, red once there are any.
- **Size** — how large the take is.
- **Room for** — how much longer this device can record at this quality,
  from the browser's own estimate of its free space. It is read on the
  device and sent nowhere.

**Pause** holds the take and **Resume** carries on; the timer holds its
figure meanwhile. **Stop** is the big button, where the record button was.
The trash glyph discards the take, and asks first.

While a take is recording, and until it is saved or discarded, the bottom
bar is hidden and the swipe and the tabs are off: the screen you are
recording on is the only one on offer. The top bar stays, so Settings is
still in reach.

## The visualizer

One card, three views of the same sound, switched in the card's corner (and
under **Settings → Record screen → Visualizer**):

- **Waveform** (the default) — the sound's shape scrolling by, about six
  seconds across a phone, on the meter's decibel scale and in its colours,
  with the −18 and −6 dB lines across it. A clipped moment is a full-height
  red bar.
- **Spectrum** — how loud each frequency is now, bass on the left.
- **Spectrogram** — frequency over time, brighter where louder, so a hum, a
  hiss or a voice's harmonics show as lines.

## The meter

The level is in dBFS — decibels below the loudest sound the microphone can
carry — with a peak that holds for a moment and falls. It moves on every
frame the screen draws, in step with the waveform above it: the microphone
hands its samples over in batches of about 43 ms, and each batch is played
out across the frames until the next (`src/app/pacing.ts`), so the bar and
the wave run a batch behind the sound — too little to see — instead of the
bar stepping twenty-odd times a second. The whole take's strip along the
visualizer's foot is redrawn on every frame too, each moment as wide as the
time it holds, so it narrows smoothly as the take grows.

When a run of samples hits the top, the take has **clipped**: the loudest
parts were flattened, and no export can put them back. The app says so four
ways at once, so nobody misses it — the meter's red zone lights, the clip
lamp latches red for a moment and a half with its glyph (a wave with its tops
cut flat), the status region announces "Too loud" to a screen reader, and
once a take has clipped a warning under the meter stays and says what to do
about it: "Too loud — move away from the sound source". Every clip is
counted, and the count and the loudest peak are kept with the recording, so
a take that clipped says so in the player afterwards.

## Review

A take that has stopped is in memory, not saved. Review asks for what it
needs, inline:

- **Title** — focused and selected, so typing replaces the numbered "New
  recording" and Enter saves.
- **Listen back** — play the take before keeping it, through the EQ it will
  be saved with, with its shape above as the playhead's track; tap or drag
  to seek.
- **One line of facts** — length, peak, and clipping (with the count, in the
  danger colour).
- **Save to** — the folder picker again, preset to what Ready showed.

**Save** is the widest button; the trash glyph beside it discards, and asks
first. Nothing is written until Save — a discarded take was never anywhere.

## Quality

The **Quality** button on Ready opens the sheet that decides how the next
take is kept, with roughly what a minute costs:

| Preset       | What it is                                           | Per minute |
| ------------ | ---------------------------------------------------- | ---------- |
| **Memo**     | The device's own encoder at 64 kbit/s                | ≈480 kB    |
| **Standard** | The device's own encoder at 128 kbit/s (the default) | ≈960 kB    |
| **High**     | The device's own encoder at 256 kbit/s               | ≈1.9 MB    |
| **Lossless** | Every sample the microphone heard, as FLAC           | ≈3.5 MB    |

The first three are a _compact_ take: the device's own encoder, in the
container it offers (Opus in a WebM on most browsers, AAC in an MP4 on
Safari). **Lossless** is encoded to FLAC on the device; its size is an
estimate, since FLAC's depends on the sound. **Bitrate, kbit/s** fine-tunes
a compact take (64 to 320); a bitrate no preset offers shows as **Custom**.

Either way an export can produce WAV, FLAC or MP3 (see
[`export.md`](export.md)); what the sheet decides is what the app keeps. The
choice is remembered on this device, not per space or folder.

**Voice processing**, in the same sheet, asks the device to cancel echo,
suppress noise and level the volume, the way a call does. It is off by
default, because it also changes what was recorded: on records what the
microphone hears less the room.

## On its side

Turn the phone sideways and the Record screen stands in two columns across
the whole width: the choices, the visualizer and the meter on the left, and
the record button, the timer, the take's figures and Save on the right. The
button and the timer are never below the fold. See `docs/design.md`, "On
its side".

## On a desk

Wide enough, the Record screen keeps its column and the two destinations go
to the top bar. The microphone is asked for through the browser or the
desktop app's own prompt; see [`desktop-app.md`](desktop-app.md).
