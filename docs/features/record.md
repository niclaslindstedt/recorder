# Recording

**Record** is the first tab: a timer, a level meter, the spectrum under it,
and one button. Press it and the browser asks for the microphone once; the
meter comes alive, the timer counts in tenths, and the take's shape draws
itself as it goes.

## The meter

The level is in dBFS — decibels below the loudest sound the microphone can
carry — with a peak that holds for a moment and falls. Aim for peaks between
−12 and −6 dB: loud enough to be clear, with room left for the loud parts.

When a run of samples hits the top, the take has **clipped**: the loudest
parts were flattened, and no export can put them back. The app says so four
ways at once, so nobody misses it — the meter's red zone lights, the **CLIP**
word latches for a moment and a half, its hatched texture shows even without
colour, and the line under the meter says the input is clipping and what to
do about it (move the microphone further away, or speak more softly). Every
clip is counted, and the count and the loudest peak are kept with the
recording, so a take that clipped says so in the player afterwards.

The **spectrum** is the sound by frequency, low on the left, on bars that
follow it. It can be switched off under **Settings → Recording**; the meter
stays.

## Pause, stop, save

**Pause** holds the take where it is and **Resume** carries on; the timer
holds its figure meanwhile. **Stop** ends it and opens the naming sheet: a
title (numbered "New recording" unless you give it one), the folder to file it
in, and **Save** or **Discard**. Nothing is written until Save — a discarded
take was never anywhere.

## Two ways to keep a take

**Settings → Recording → Keep a take as** picks what the file is:

- **Compact** — the device's own encoder, in the container it offers (Opus in
  a WebM on most browsers, AAC in an MP4 on Safari), at the bitrate you set.
  A minute is under a megabyte. The default.
- **Lossless** — every sample the microphone heard, encoded to FLAC on the
  device. About four megabytes a minute, and nothing lost.

Either way an export can produce WAV, FLAC or MP3 (see
[`export.md`](export.md)); what the setting decides is what the app keeps.

**Voice processing** asks the device to cancel echo, suppress noise and level
the volume, the way a call does. It is off by default, because it also
changes what was recorded; on records what the microphone hears less the room.

## On a desk

Wide enough, the Record screen keeps its column and the other tabs go to the
top bar. The microphone is asked for through the browser or the desktop
app's own prompt; see [`desktop-app.md`](desktop-app.md).
