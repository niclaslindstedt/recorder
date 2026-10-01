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

| Part                | What it does                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The curve**       | What the EQ does from 20 Hz to 20 kHz, each band marked on it. While something plays — or the microphone is monitored — the sound itself is drawn behind it as bars, moved by the EQ as you turn it: what it adds in the accent colour, what it takes away as the hollow outline of the bar that was, so a cut can be seen taking a hum out. |
| **Compare**         | Hear it without the EQ while it is on, to judge the difference. Nothing is changed.                                                                                                                                                                                                                                                          |
| **Starting points** | Flat, Podcast, Warm, Bright, Lo-fi: a setting of the five knobs. Turning a knob afterwards makes it Custom. Picking one leaves the low cut as it was.                                                                                                                                                                                        |
| **Five knobs**      | Drag up to boost and down to cut: up to +12 dB, down to −24 dB in half-dB steps, and all the way down is **off** — that band is not heard at all. Double-tap for 0. Arrow keys work, Page Up / Down move three, Home turns a band off.                                                                                                       |
| **Low cut**         | Takes out what is under 80 Hz — traffic, handling noise, the air conditioning. A switch of its own: no starting point turns it on or off, and the name says it beside the starting point ("Podcast · Low cut").                                                                                                                              |

| Knob     | Centre  | Covers         | What it does to a voice or an instrument |
| -------- | ------- | -------------- | ---------------------------------------- |
| Bass     | 100 Hz  | under 173 Hz   | Weight and boom                          |
| Warmth   | 300 Hz  | 173–548 Hz     | Body — or, too much, mud                 |
| Mids     | 1 kHz   | 548 Hz–1.9 kHz | Honk and punch                           |
| Presence | 3.5 kHz | 1.9–5.9 kHz    | How clearly words come through           |
| Air      | 10 kHz  | over 5.9 kHz   | Sparkle and breath                       |

### How the bands work

The five knobs split the sound rather than bend it. Four crossovers, each
halfway between two bands on a log scale, cut it into five pieces that add
back up to the whole, and a knob is how loud its piece is. So turning every
knob the same way turns the whole sound that much; two neighbouring bands
turned down stay down all the way between them, with no bump where one
filter ends before the next begins; and a band turned off is gone. The
crossovers are steep (48 dB an octave, Linkwitz–Riley), which is what lets
a band turned off actually fall silent rather than just quieter.

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
