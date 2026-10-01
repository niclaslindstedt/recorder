# Equalizer

An EQ shapes how a recording sounds — less rumble under a voice, more
clarity in its words, more weight in a guitar — without touching the
recording itself. It is kept **beside** each recording, heard in the player
and baked into an export, and **Flat** always brings the recording back as
it was.

## The sheet

One sheet, opened in two places:

- **Record screen → EQ** sets the EQ new takes start with. A take is saved
  with it, and Review plays the take through it. The button shows the EQ's
  curve, small, beside its name — and "Low cut" when that is on.
- **Player → the EQ button** (left of the transport, lit and showing the
  curve when the recording has an EQ) sets one recording's. The change is
  kept when the sheet closes.

In it, top to bottom:

| Part                | What it does                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The curve**       | What the EQ does from 20 Hz to 20 kHz, each band marked on it. While something plays — or the microphone is monitored — the sound itself is drawn behind it, after the EQ, so a cut can be seen taking a hum out. |
| **Compare**         | Hear it without the EQ while it is on, to judge the difference. Nothing is changed.                                                                                                                               |
| **Starting points** | Flat, Podcast, Warm, Bright, Lo-fi: a setting of the five knobs. Turning a knob afterwards makes it Custom. Picking one leaves the low cut as it was.                                                             |
| **Five knobs**      | Drag up to boost and down to cut, ±12 dB in half-dB steps; double-tap for 0. Arrow keys work, Page Up / Down move three.                                                                                          |
| **Low cut**         | Takes out what is under 80 Hz — traffic, handling noise, the air conditioning. A switch of its own: no starting point turns it on or off, and the name says it beside the starting point ("Podcast · Low cut").   |

| Knob     | Where   | What it does to a voice or an instrument         |
| -------- | ------- | ------------------------------------------------ |
| Bass     | 100 Hz  | Weight and boom (a shelf: everything under it)   |
| Warmth   | 300 Hz  | Body — or, too much, mud                         |
| Mids     | 1 kHz   | Honk and punch                                   |
| Presence | 3.5 kHz | How clearly words come through                   |
| Air      | 10 kHz  | Sparkle and breath (a shelf: everything over it) |

## Monitoring

On the Record screen the sheet can **Monitor**: the microphone, through the
EQ, into your headphones, so you can set it by ear before pressing Record.
Put headphones on first — on speakers it will feed back.

It doesn't trust that you did. While it runs it listens to what it is
sending out, twenty times a second, for the sound of feedback: one tone
standing far above everything else, holding its pitch, loud, for about a
third of a second. A voice or a sung note has harmonics and wavers, so it
passes; a loop rings at one pure pitch. The moment it hears one it cuts the
sound and stops, and says why: "Stopped: it was hearing itself through the
speaker." Start it again with headphones on. It also fades in over a moment
rather than starting at full level, so a loop has to build where the guard
can hear it, and it stops when the app goes to the background. A long,
steady whistle right at the microphone can look like feedback too; then it
stops just the same, and can be started again.

It opens the
microphone only when you press Monitor and closes it when you press Stop or
close the sheet; it keeps nothing (there is no recorder on that path). It
asks for the same voice processing the Quality sheet says a take will have,
so it sounds like the take. If Listening was on, it hands the microphone
over. How quickly you hear yourself depends on the device; a wireless
headset adds its own delay.

## What is kept, and where

The EQ is a small set of numbers on the recording (`eq` in the document),
synced with it like its title and note — the last edit wins. The recording's
bytes are never changed. An export decodes the recording, runs it through
the same filters the player uses and encodes the result, so what you hear is
what you send; **Share the original file** hands over the take as the device
kept it, without the EQ. The export sheet says when an EQ will be applied.

The filters are the browser's own while listening and the same arithmetic
in the export (the Web Audio spec's biquads), worked out on the device.
Nothing is sent anywhere to be processed.
