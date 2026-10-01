# Recording

**Record** is the first tab, and it is one screen in four modes rather than
a screen with sheets over it: **Ready** before a take, **Listening** while
you set a level, **Recording** during a take, and **Review** after it. Each
mode lays out the same area for its own job. Why each piece is where it is
is in [`../design.md`](../design.md).

## Ready

The microphone is closed. At the top are the take's four choices, as
buttons. Side by side, how it will sound: **Quality** (the preset's name,
with its bitrate on the caption) opens the Quality sheet, and **EQ** (Flat,
a preset's name, or Custom) opens the [equalizer](equalizer.md) — the EQ
new takes start with, which you can **Monitor** on headphones before you
record (and while Listening or Recording, from the headphones glyph). Under them, the whole width, **Trigger** (Off, or On sound with
its level and hold on the caption) opens the [sound trigger](#sound-trigger)
sheet, and **Save to** (the folder a new take is filed in) opens the folder
picker. Save to starts on the folder the library
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

Under them a **verdict** says it in words, against the **target level**
(below): nothing heard, under the target, a good level, over the target,
almost too loud (over −3 dB, whatever the target), or clipping. With the
default Voice target that is peaks under −18 dB, −18 to −6, −6 to −3 and
over −3.

Listening runs on the same capture path as a take, voice processing
included, so what the meter says is what a take will get. It is a take that
is never kept: it is cancelled on **Stop** or when you leave the screen,
and it quietly starts over every five minutes, so it never holds more than
that in memory and writes nothing, ever. Pressing record from Listening
starts the take with the level already set.

The **headphones glyph** beside Stop monitors the microphone: you hear it
through the take's EQ in your headphones, so a level and a placement can be
judged by ear too. It asks whether your headphones are on the first time,
and carries on into the take if you press record. See
[Monitoring](equalizer.md#monitoring).

## Recording

The timer is the headline, in tenths, with a pulsing dot; the line under it
repeats the quality and the folder, read-only. The **headphones glyph** by
the timer monitors the take as it goes down, through its EQ, into your
headphones; the take is the same with it on or off, and Stop closes it. The
visualizer takes the
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
  seconds across a phone, on the meter's decibel scale, with the **target
  level** shaded across it and its two edges dashed and labelled. Each
  moment is coloured by where its peak landed: grey under the target, the
  accent inside it, amber over it, and red once it is past −3 dB or has
  clipped. The caption says the range ("aim for −18 to −6 dB"), and the
  whole-take strip along the foot wears the same colours, so how much of a
  take sat in range is seen at once.
- **Spectrum** — how loud each frequency is now, bass on the left.
- **Spectrogram** — frequency over time, brighter where louder, so a hum, a
  hiss or a voice's harmonics show as lines.

## The target level

There is no one right level for every recording. What is universal is the
ceiling — a clip cannot be undone, so nothing over −3 dB is ever a target —
but how far under it a take should sit depends on what is in front of the
microphone. So the target is chosen with the quality, on the **Quality
sheet**, as a range for the peaks:

| Target       | Peaks         | For                                                                                          |
| ------------ | ------------- | -------------------------------------------------------------------------------------------- |
| **Voice**    | −18 to −6 dB  | Speech, interviews, memos. The meter's own good zone; −18 dBFS is the studio alignment level |
| **Music**    | −12 to −6 dB  | Instruments and singing — a little hotter and steadier, the usual advice for tracking        |
| **Loud**     | −20 to −10 dB | Drums, a band, anything that jumps — more headroom for the hit nobody saw coming             |
| **Ambience** | −36 to −18 dB | A room, birdsong, a field recording — quiet by nature; turning it up only adds hiss          |
| **Custom**   | your own      | Two steppers, a decibel at a time, between −48 and −3 dB, at least 3 dB apart                |

A loudness target for a finished file (−16 LUFS for a podcast, −14 for a
streaming service) is a different number: it is what mastering does to a
take afterwards, not where the take should sit, so it is not offered here.

The target is read in three places, so they never disagree: the waveform's
band and colours, the meter (a band on its track, and the bar grey, green,
amber or red by where the held peak sits against it), and the Listening
verdict. While listening and recording it is also **said in words over the
meter** — "Target · Voice · −18 to −6 dB", beside a swatch of the band — so
"under the target" in the verdict has a number to go with it. What is too hot — over −3 dB — and what has clipped stay the
same whatever the target says, and the clip lamp and the warning under the
meter are untouched by it. Like the quality, the target is remembered on
this device.

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
Each preset also says how long this device has **room for** at that quality,
from the browser's own estimate of its free space — the same figure as "Room
for" while recording, rounded to the hour.

Either way an export can produce WAV, FLAC or MP3 (see
[`export.md`](export.md)); what the sheet decides is what the app keeps. The
choice is remembered on this device, not per space or folder.

**Voice processing**, in the same sheet, asks the device to cancel echo,
suppress noise and level the volume, the way a call does. It is off by
default, because it also changes what was recorded: on records what the
microphone hears less the room.

## Sound trigger

The **Trigger** button on Ready opens the sheet that decides whether a take
records everything or only while there is something to hear — what a
dictaphone calls voice-operated recording and a call app voice activity. With
**Record only when there is sound** on:

- **Trigger level** (−60 to −10 dB, a decibel at a time; −40 by default) is
  read on the meter's own scale: sound whose bar reaches it starts the
  recording. The strip under it shades what will be kept; while Listening it
  also marks the room's noise floor and shows the live meter, so the trigger
  is set above the room by watching the bar cross it.
- **Keep recording after the sound** (0.5 to 10 s; 2 s by default): how long
  the take runs on once the sound drops under the trigger, so a pause for
  breath is not a cut.
- **Keep from before the sound** (0 to 2 s; 0.5 s by default): the buffer
  the take reaches back into when the sound crosses, so the first syllable
  is in it rather than cut in half.
- **The quiet parts**: **Cut out** (the default) leaves a shorter file with
  only the sound in it; **Keep as silence** turns the quiet to silence and
  keeps the take its full length, so it still lines up with a video shot at
  the same time.

While a take runs, the trigger's level is a mark across the meter's track
("TRIGGER −40 dB" over it), and the line under the timer says **Hearing
sound** (the dot pulsing) or **Waiting for sound** (the dot hollow), with
how much has been kept so far. The timer counts the whole take; **Size** is
what the file will hold. Each kept stretch is faded in and out over 10 ms so
the cuts do not click.

At Stop the take is gated from every sample the microphone heard — the same
rule the screen showed, read over 2048-sample windows — then reviewed as
usual. A **Lossless** take is FLAC as always; a **compact** take is encoded
on the device as **MP3** at the chosen bitrate, since the browser's own
encoder cannot be handed the edited sound. If nothing ever reached the
trigger, nothing is kept and the screen says so.

Until Stop the whole take is held in memory as samples, as a Lossless take
is (about 700 MB an hour for a mono microphone), and only what is kept is
saved. Nothing is written before Save, and nothing leaves the device.

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
