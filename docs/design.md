# Design

What the recorder looks like, and why. This is the reasoning behind the
layout, not a style guide: the tokens, the radius scale and the type are the
framework's and `src/styles.css`'s. When a change to the UI raises a question
about where something goes, the answer should be derivable from this page. If
it isn't, the page is missing something. Add it here first.

## Who it is for

Five kinds of people press the red button, and they want the same thing
from different ends:

| Who             | What they record                              | What they need from the app                                                                                      |
| --------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Musicians**   | Song sketches, rehearsals, a riff at 2 a.m.   | Lossless when it matters, a level set _before_ the take, an honest clip warning, WAV/FLAC out for the DAW        |
| **Journalists** | Interviews, press conferences, field notes    | Confidence it is recording, recordings filed by story, nothing leaving the phone, quick export for transcription |
| **Bloggers**    | Voice-overs, podcast segments, reads          | A clean level, a take they can check straight away, MP3 or WAV out                                               |
| **Hobbyists**   | Birdsong, a room, a synth, a kid's first song | The meter, the waveform and the spectrogram as something to look at, not just a gauge                            |
| **Memo-takers** | Grocery lists, ideas, reminders               | One tap to start, one tap to keep, find it again later                                                           |

Every one of them has three moments with the app: **before** a take (is the
level right, is the quality right, where will it go), **during** a take (is
it recording, is it clipping, how long), and **after** (what did I get, where
is it, how do I get it out). The app's job is to show the right thing at each
moment and nothing from the other two.

## The principles

**1. One intent per screen, stated at the top.** A screen says what it is for
in its first line: the Record screen by its mode ("Listening", "Recording"),
the library by its scope ("Ideas · 3"). If an element's purpose can't be put
in a sentence that begins "this is here so that…", it goes.

**2. Modes, not modals, on the Record screen.** Recording is a state the
screen is _in_, not a thing that pops up over it. The screen has four modes
(Ready, Listening, Recording, Review) and each one lays out the same area for
a different job. Space that has nothing to do in one mode is given to
something that does. An empty card waiting for the Record button is a waste
of the most valuable screen in the app.

**3. The thing you came to do is the biggest thing on screen.** The record
button while you are about to record; Stop while recording; **Save** after.
The destructive way out (Discard, Delete) is never the larger button and is
never a word: it is a trash glyph, set apart, and it asks before it throws
away a take.

**4. Organization happens where the recordings are.** A folder is a label on
a recording, so filing, switching and managing folders happen from the list
and from the recording itself, never on a separate page. The one control for
"which folder" is the same picker everywhere (the library's scope, Move, the
take's destination), and every instance of it ends in **New folder**, so
nobody has to leave what they are doing to make one.

**5. Set-and-forget things are glyphs.** Spaces, sync status and Settings are
chosen once and rarely looked at again. They are icons on the top bar's right
edge, not labelled controls competing with the content.

**6. Quality is a choice you make at the microphone.** The format a take is
kept in varies between takes: an interview at 128 kbit/s, a song idea
lossless. So it is a visible, button-shaped control on the Record screen that
opens its own sheet, not a setting three levels down. The same goes for the
export: the sheet says what the file will be and roughly how large before you
press Export.

**7. Numbers a user acts on are shown; numbers they don't are not.** The
peak in dB, the room's noise floor, the headroom and the clip count change
what a musician or a journalist does next, so they are shown plainly. An item
count, a repeated date on every row or an explanatory paragraph under every
control do not, so they are gone or folded into a heading.

**8. Privacy is a behaviour, not a banner.** The microphone opens only when
someone presses Listen, Record or a Monitor (the EQ sheet's, or the
headphones glyph while Listening or Recording), and closes when they stop.
Nothing listens
at launch. Nothing is written until Save.

## The shell

```
┌───────────────────────────────────────────┐
│ ◉ Recorder                    ☁  ▣  ⚙    │  top bar: wordmark · sync · space · settings
├───────────────────────────────────────────┤
│                                           │
│               (the screen)                │
│                                           │
├───────────────────────────────────────────┤
│        🎙 Record        ☰ Recordings       │  bottom bar (phone) — two destinations
└───────────────────────────────────────────┘
```

- **Two destinations: Record and Recordings.** They are the two places a
  person _is_: at the microphone, or among what it made. Folders used to be a
  third tab, but it was a place with nothing to do except manage a list of
  names, and it is now the library's scope picker (see below). On the desk
  the two sit as tabs in the top bar; on the phone on the bottom bar, where
  the thumb is. A swipe still pages between them.
- **The wordmark stays on the left.** It is the one fixed point that says
  whose app this is. It is not a button.
- **Glyphs on the right, in order of how often they change:** sync (only
  when a backend is connected, so it is absent for most people), the
  **space** glyph, and the cog. The space glyph is the active space's own
  symbol in its own colour, so the button _is_ the answer to "which space
  am I in?" without a label taking room. Pressing it opens the spaces sheet
  (switch, create, rename). It used to be a labelled chip in the left corner
  that took the width of the wordmark for a decision made once.
- **While recording, the bottom bar goes away** and the swipe between
  screens is off. Leaving the Record screen mid-take used to end the take;
  now the screen you are recording on is the only one on offer until you
  stop. The top bar stays, so Settings is still in reach.

## Record

The Record screen is an instrument, and no part of it is left empty in any
mode. Its four modes share one layout: a **status line** at the top (what
mode, and in Recording the timer), a **stage** that takes every pixel of
height the other rows leave (what is interesting in this mode), and the
**action row** at the bottom in the thumb's reach (the one button, and at
most one neighbour either side).

On a tall window (`tall:` in `styles.css`, 52rem and up: a large phone
upright, a laptop) the instruments grow into the room. On a small phone they
keep compact sizes, so the button is never scrolled out of reach.

### On its side

A phone laid on its side (`useStand`: landscape, under the desk's width,
under 44rem tall: 956×440 and the like) is wide enough for two columns and
far too short to stack one. Stacked, the record button fell below the fold
and the timer scrolled off the top. So on its side every mode stands in two
columns across the whole width, not the reading column:

```
┌──────────────────────────────────────────────────────────────┐
│  THE STAGE (the instrument)                │  THE RAIL        │
│  Ready:     choices · listen card          │  (●) Tap to rec  │
│  Listening: status · visualizer · meter    │  readings · (●)  │
│  Recording: visualizer · meter · warning   │  timer · figures │
│                                            │  ‖  (■)  🗑      │
│  Review:    title · shape · listen back    │  Save to · Save  │
└──────────────────────────────────────────────────────────────┘
```

- **The stage** is on the left because it is the thing looked at. It takes
  the width that is left, so the visualizer is wide, which suits a
  scrolling picture.
- **The rail** (16rem) is on the right, where a right thumb holds a phone
  on its side. The big button, the timer and the figures sit there, centred
  in the height.
- The figures go two by two, the big buttons drop from 96 to 80 px, and
  the listen card is slimmer. The bottom bar stays: this is still a phone.

### Ready: the microphone is closed

```
┌───────────────────────────────────────────┐
│  ┌─────────────────┐ ┌──────────────────┐ │
│  │ ◈ QUALITY·128k› │ │ ╭╮ EQ·Low cut  › │ │  how the take sounds
│  │   Standard      │ │ ╯  Podcast       │ │
│  └─────────────────┘ └──────────────────┘ │
│  ┌─────────────────────────────────────┐  │
│  │ ⌇ TRIGGER·−40dB·2s  On sound · cut› │  │  when it records, the whole width
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │ 🗀 SAVE TO  Ideas › Songs         › │  │  where it goes, the whole width
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │ ≈  Check your level     [🎧 Listen] │  │  the invitation to listen
│  │    Hear the room … Nothing is kept. │  │
│  └─────────────────────────────────────┘  │
│                                           │
│                                           │
│                 (  ●  )                   │  the one button, centred in the room left
│              Tap to record                │
└───────────────────────────────────────────┘
```

- **Quality** (top left) is a real button: bordered, a glyph, a caption that
  carries the bitrate ("QUALITY · 128 kbit/s"), the preset's name large under
  it, and a chevron that says it opens something. It opens the **Quality
  sheet** (below). It sits at the top because it is decided before a take
  and never during one. The bitrate is on the caption's line so the name is
  never cut short in a half-width button.
- **EQ** (top right) is the same shape: the EQ a new take starts with —
  Flat, a preset's name or Custom, with "Low cut" on the caption's line
  when that switch is on. Where the other buttons have a glyph it has **the
  EQ's own curve**, drawn small, so the button shows what a take will sound
  like and not only what the EQ is called. It sits beside Quality because
  the two together are how the take will sound. It opens **the EQ sheet**
  (below).
- **Trigger** (under them, the whole width, because "On sound · quiet cut
  out" and its level and hold on the caption's line do not fit half of it)
  is the same shape again: whether a take records everything or only while
  there is sound. It sits under how the take sounds and over where it goes,
  because it is _when_ — decided before the take, like the other three. It
  opens **the Trigger sheet** (below). A switch inside the Quality sheet was
  the other place, and was not taken: a take that waits for sound behaves
  differently all the way to Stop, so Ready says so on its face.
- **Destination** (under them, the whole width, because a folder's path is
  long and a half-width button cut it short) is the same shape: the folder
  a new take will be saved to. It opens the folder picker. It starts on the folder the
  library is showing, so "I'm in Interviews, I press Record" files the take
  into Interviews without a question. Saying it _before_ the take is what
  lets the Review mode ask nothing it doesn't have to.
- **Check your level** invites you into the Listening mode. It is a card
  with one sentence and one button, because the one thing a first-timer
  needs to know is that Listen records nothing.
- **No recordings.** What was recorded is the Recordings screen's, one
  swipe or one tab away. A list here gave the screen two subjects and
  pushed the button down on a small phone; the room it took is the
  button's now.
- **The record button** is the largest control on the screen: red, 96 px,
  **centred in whatever room is left**, with "Tap to record" under it. That
  keeps it in the lower half, where a thumb reaches, without a dead band
  between the list and a button pinned to the edge.

### Listening: ambient mode

The microphone is open and nothing is kept. This is the mode for setting a
level, placing a microphone, checking a room, or just watching sound.

```
┌───────────────────────────────────────────┐
│  ● Listening — nothing is kept (🎧) ( ■ ) │  status: what mode, monitor, and a stop glyph to leave it
│  ┌─────────────────────────────────────┐  │
│  │ Waveform · the last few seconds ≋▥▦ │  │  the visualizer, and its switcher
│  │ −6  - - - - - - - - - - - - - - -   │  │
│  │ −18 - - - - - - ▂▅█▅▂ - - ▃▇▃ - -   │  │  it takes every pixel left
│  │ ─────────────────▅███▅─────▇█▇──    │  │
│  │     - - - - - - ▂▅█▅▂ - - ▃▇▃ - -   │  │
│  └─────────────────────────────────────┘  │
│  ████████████████░░░░░░░░░  −14.2  [/‾\] │  the big meter
│  −60   −40  −30  −20  −12  −6 −3  0       │
│   ROOM        PEAK        HEADROOM        │  three readings a person acts on
│  −52 dB     −9.4 dB      9.4 dB           │
│  ✓ Good level                             │  the verdict, in words
│  ◈ Standard ›          🗀 Ideas ›         │  the choices (tall windows only)
│                 (  ●  )                   │
└───────────────────────────────────────────┘
```

- **The visualizer** gets the stage (see _The visualizers_ below): the
  card grows to fill whatever height is left.
- **The headphones glyph** in the status line is the monitor: the
  microphone through the take's EQ into headphones, so a level is set by
  ear as well as by eye. It is a toggle, lit while it runs, beside the stop
  glyph because both are about the open microphone rather than the take.
  The first press asks whether headphones are on (a sheet with Monitor
  inside it, so the sound starts within the press); the EQ sheet's own
  Monitor, which says so beside its button, counts as the answer. It
  carries on into a take started from here, and closes when Listening does.
- **The big meter** is the framework's level meter at the Record screen's
  size: a bar 24 px tall, the reading beside it in the text colour, and a
  larger clip lamp that shows a **glyph instead of the word CLIP**: a wave
  with its tops cut flat against a ceiling, which is what clipping does to
  the sound. The same glyph marks the "Too loud — move away from the sound
  source" warning, so the lamp and the words are visibly the same thing.
  Over it, the **target in words** — a swatch drawn like the band,
  "TARGET", and the target's name and range ("Voice · −18 to −6 dB") — so
  "under the target" in the verdict points at something on screen, in
  every visualizer and not only the waveform's caption.
  The **target level** is on it too: a band across the track with its two
  edges drawn over the bar, and the bar coloured by where the held peak
  sits against it — grey under, the accent in it, amber over, red when hot
  or clipping — the same colours the waveform wears. The scale under the
  bar ends where the track ends, so its marks name the levels above them
  and the band reads true. The size, the lamp's face, the band and the
  colour are the app's (`.app-meter-big`, `BigMeter.tsx`); the ballistics,
  the held peak, the take's max mark, the latched lamp and the status
  region are the framework's, so the four clip signals stay four.
- **Room** is the noise floor: the quiet end of the last four seconds' level.
  It tells a journalist whether the café is too loud and a musician whether
  the fridge is in the take. **Peak** is the loudest moment of the last four
  seconds. **Headroom** is how far that peak is from clipping. All three are
  in dB because that is the unit the meter is drawn in.
- **The verdict** turns those numbers into a sentence, against the target
  level: nothing heard, under the target, good, over the target, almost too
  loud (over −3, the framework's hot zone, whatever the target), or
  clipping. With the default Voice target that is peaks under −18, −18 to
  −6, −6 to −3 and over −3 — the meter's own zones. It is coloured, but it
  is also words, because the clip warning is never colour alone.
- **The choices** shrink to one line, and only on a tall window. They are
  still changeable, but they are no longer what the screen is about, and on
  a small phone the button's reach matters more.
- **Record from here** starts a take without a gap. Listening stops, and the
  take begins with the level already right.
- Listening runs on the same capture path as a take, so what the meter says
  is what the take will get, voice processing included. It is a take that is
  never kept. It is cancelled on Stop, on leaving the screen, and every few
  minutes it quietly starts over, so an evening of listening holds no more
  than a few minutes of audio in memory, and never writes any of it.
- **Mixing (later).** This is where input gain and, eventually, per-input
  mixing belong: faders between the meter and the readings while Listening,
  so a level is set by ear and eye before a take. Not in this change.

### Recording

```
┌───────────────────────────────────────────┐
│               ● 0:42.3                    │  the timer is the headline (60 px)
│    Standard · 128 kbit/s · to Ideas (🎧)  │  what this take is, read-only; the monitor
│  ┌─────────────────────────────────────┐  │
│  │ Waveform · the last few seconds ≋▥▦ │  │  the visualizer — fills the room
│  │        ▂▅█▅▂    ▃▇▃   ▂▃▅▃▂        │  │
│  │ ───────▅███▅────▇█▇───▅███▅───     │  │
│  │        ▂▅█▅▂    ▃▇▃   ▂▃▅▃▂        │  │
│  │ ▁▂▃▅▃▂▁▂▅▇▅▃▂▁▂▃▂▁  ← the whole take │  │  the take's overview strip
│  └─────────────────────────────────────┘  │
│  ████████████████░░░░░░░░░  −18.0  [/‾\] │  the big meter
│  ⚠ It has clipped — move the microphone…  │  only when it has clipped
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
│  │ PEAK │ │CLIPS │ │ SIZE │ │ ROOM FOR │  │  the take so far, in four figures
│  │−4.1dB│ │  0   │ │1.2 MB│ │   19 h   │  │
│  └──────┘ └──────┘ └──────┘ └──────────┘  │
│       ( ‖ )     (  ■  )      ( 🗑 )        │  pause · stop · discard
└───────────────────────────────────────────┘
```

- **The timer** is the largest type in the app and it ticks tenths, so a
  glance says "yes, it is running". The red dot beside it pulses.
- **The context line** repeats the quality and the destination read-only,
  because they can't change mid-take but a journalist wants to be sure.
- **The headphones glyph** is the monitor, the same toggle as Listening's,
  at the end of the context line (upright, a spacer of its width at the
  other end keeps the line centred). Not in the timer's corner: an hour's
  take, `1:00:00.0`, needs the whole width on a small phone. Not in the
  action row: that
  row is the button and one neighbour either side, and the monitor is about
  hearing the take, not what happens to it. Stop, Discard and leaving
  close it; Pause does not, because the room is still worth hearing.
- **The visualizer** takes all the height the other rows leave. Along its
  foot runs **the whole take** as a thin strip: the same thumbnail the list
  will show, so the take is recognisable later, and the long view beside the
  last few seconds.
- **The big meter** is the same as Listening's. The clip warning under it is
  one line with a glyph, and it stays once the take has clipped.
- **With the sound trigger on**, the context line is the gate instead:
  **Hearing sound** or **Waiting for sound**, and how much has been kept
  ("0:12 kept"). The dot beside the timer pulses while it hears sound and
  is a hollow ring while it waits, so "is it taking this down?" is answered
  in two ways, not by colour alone. The timer still counts the whole take,
  because it is still running; the meter carries the trigger as a mark
  across its track, with "TRIGGER −40 dB" over it beside the target, so the
  bar crossing the mark _is_ the gate opening. **Size** is what the file
  will hold.
- **The four figures** are what the take is so far, each one a decision:
  **Peak** (the loudest moment, red past −3: back off?), **Clips** (red
  once any: is it ruined?), **Size** (will it fit an email?) and **Room
  for** (how much longer this device can record at this quality, from the
  browser's own estimate of its free space: can the interview run on?).
- **The action row:** Pause on the left, **Stop** in the middle (the
  96 px button, where the record button was, so the thumb doesn't move), and
  a trash glyph on the right for Discard, which asks first.

### The visualizers

One card, three views of the same frames. The switcher sits in the card's
corner as three glyphs, because trying them against a room is the point of
having three. The choice is remembered (Settings → Record screen →
Visualizer).

- **Waveform** (the default): the loudest moment of each 45 ms slice,
  scrolling left with the newest at the right edge, about six seconds across a
  phone. It is drawn on the **meter's decibel scale**, not in raw
  amplitude, so a quiet voice still has a shape. The **target level** (the
  Quality sheet's) is a band shaded across it, its edges dashed and
  labelled, and every slice wears where its peak landed: **grey** under the
  target, the **accent** in it, **amber** over it, **red** past −3 or when it
  clipped. Colour arrives only in the right range, so "am I at a good
  level?" is read off the picture without reading a number, and the caption
  names the range for the person who wants the number. The take's strip
  along the foot wears the same colours. This is the view most people know
  from a voice memo app.
- **Spectrum**: the framework's bars, how loud each frequency is now, bass
  on the left. For a musician tuning a mic position, or seeing a hum.
- **Spectrogram**: frequency over time, low at the foot, brighter where
  louder, in the theme's own colours (accent, then amber, then red at the
  top). A fridge's hum, a fan's hiss or the harmonics of a voice show up as
  lines, which neither of the other two can show.

What a level or a clip _is_ stays the framework's: the views read frames
through `readFrame`, `meterFill` and `meterTone`, and red is the framework's
hot zone whatever the target says. The waveform, the meter and the
Listening verdict read the one target, so the picture, the bar and the
words never disagree; the Voice target is exactly the meter's own zones. A
scrolling waveform and a
spectrogram are candidates to move into the framework's `audio` module next
to `SpectrumBars` once a sibling app wants them.

### Review: the take is in memory

A take that has stopped is not saved yet. The Review mode is where it gets a
name and a place. It replaces the old full-screen naming sheet, which spent a
whole screen on two fields and put a big red Discard under a small Save.

```
┌───────────────────────────────────────────┐
│  TITLE                                    │
│  New recording 3________________________  │  the title, focused and selected
│  ┌─────────────────────────────────────┐  │
│  │ ▁▂▃▅▃▂▁▂▅▇▅▃▂▁▂▃▂▁▂▃▅▃▂▁▂▅▇▅▃▂      │  │  the take's shape, with a playhead
│  └─────────────────────────────────────┘  │
│  (▶) 0:00 / 0:42 · Peak −4.1 dB · No clip │  listen back, and what you got
│  🗀 SAVE TO  Ideas                     ›  │  where it goes (the same picker)
│                                           │
│  ( 🗑 )   [        ✓  Save        ]       │  discard glyph · the big Save
└───────────────────────────────────────────┘
```

- **The title** is the first thing, already focused and selected, so typing
  replaces "New recording 3" and Enter saves.
- **Listen back** before keeping it: the play button beside the facts plays
  the take from memory, and the shape above it is the playhead's track and
  seekable. "Did I get it?" is the question this moment is for. A compact
  take plays as the encoder wrote it; a lossless one (still samples) is made
  into a WAV on the first press, so a take nobody plays back costs nothing.
- **One line of facts** (length, peak, clipping) is what a musician checks
  before deciding the take is a keeper. Clipping is shown in the danger
  colour with the count.
- **The destination** is the one picker again, preset to what Ready showed.
- **Save** is the widest button on the screen, in the accent, in the thumb's
  reach. **Discard** is a trash glyph beside it, and it asks before it throws
  anything away. The bottom bar stays hidden until the take is saved or
  discarded, because a take in memory is not something to navigate away
  from.

### The Quality sheet

```
┌───────────────────────────────────────────┐
│  Quality                              ✕   │
│  ◉ Memo      Speech, smallest    64 kbit/s  ≈480 kB/min  room for 34 h
│  ○ Standard  Voices, interviews  128 kbit/s ≈960 kB/min  room for 17 h
│  ○ High      Music, near CD      256 kbit/s ≈1.9 MB/min  room for 9 h
│  ○ Lossless  Every sample, FLAC  FLAC       ≈3.5 MB/min  room for 5 h
│  Bitrate, kbit/s  64  96 [128] 192 256 320│  fine-tune (compact only)
│  ☐ Voice processing                       │  echo / noise / auto-gain
│    Cancel echo, suppress noise, level …   │
│  Target level                             │  where the peaks should land
│  [Voice] Music  Loud  Ambience  Custom    │
│  ░░░░░░░░░░░░░░░░██████████▒▒▒▓           │  the range on the meter's scale
│  −18 to −6 dB · Speech, interviews …      │
│  Lowest peak     ( − )  −30 dB  ( + )     │  Custom only, a dB at a time
│  Highest peak    ( − )  −12 dB  ( + )     │
└───────────────────────────────────────────┘
```

- **Presets first, with a size per minute**, because "how much room will an
  hour-long interview take?" is the question a journalist has, and "will it
  be good enough?" is the musician's. Each row says who it is for in a few
  words. Memo, Standard and High are the device's own encoder at 64, 128 and
  256 kbit/s; Lossless is the samples as 16-bit FLAC (its size is an
  estimate: 48 kHz mono at about 60 % of the raw samples). Under the size,
  **room for** how long this device could record at that quality — the
  browser's own estimate of its free space (`navigator.storage.estimate`,
  read on the device, sent nowhere), in whole hours once there is an hour;
  the line is left out where the browser does not say.
- **The bitrate row** is for the person who wants a number the presets
  don't offer. Choosing one that matches a preset selects the preset; the
  button on Ready then says "Custom".
- **Voice processing** lives here, not in Settings, because it changes what
  is recorded, and whether you want it depends on the take (on for a call
  in a noisy room, off for an instrument).
- **The target level** is here for the same reason: where a take's peaks
  should sit depends on what is being recorded — a voice, a drum kit, a
  room — not on the device. Four presets name the source, not a number;
  Custom is two steppers, held between −48 and −3 dB and at least 3 dB
  apart. The strip under them draws the range on the meter's own scale, so
  it is the waveform's band turned on its side.
- **Both segmented rows stay inside their bar.** On a narrow phone the
  buttons shrink to their text, and past that the row wraps onto a second
  line within the bar (`SEGMENTS_FIT`) — a choice never sits outside it.
- The choice is remembered on this device and is what the next take starts
  on. It is not a per-space or per-folder setting. A quality is a fact about
  a take, and the take records it (Player → facts).

### The Trigger sheet

```
┌───────────────────────────────────────────┐
│  Sound trigger                        ✕   │
│  ☑ Record only when there is sound        │  the switch; the rest dims while off
│  Trigger level             ( − ) −40 dB ( + )
│  ░░░░░░░░░░░░│███████████████████████████ │  what will be kept, on the meter's scale
│  The room is at −52 dB right now.         │  while Listening, with the live meter
│  Keep recording after the sound           │
│  0.5 s  1 s [2 s] 3 s  5 s  10 s          │
│  Keep from before the sound               │
│  0 s  0.25 s [0.5 s]  1 s  2 s            │
│  The quiet parts                          │
│  [Cut out]        Keep as silence         │
│  A shorter file with only the sound in it.│
└───────────────────────────────────────────┘
```

- **The switch first**, with what the trigger does in one sentence; the
  rest of the sheet is dimmed and disabled while it is off, so the numbers
  are seen before they are needed.
- **The level is in dB on the meter's scale**, because that is what the
  reader watches: the bar reaching the line is the take starting. It is a
  stepper, a decibel at a time like the target's Custom range, held
  between −60 and −10. The strip shades everything from the trigger up —
  what will be kept. While Listening, the room's noise floor is a mark on it
  and a sentence under it, and the live meter is in the sheet, so the
  trigger is set above the room by watching, not guessing.
- **After and before** are the two times a person tunes: how long a pause
  may be before the take stops (the hold), and how much is kept from before
  the sound crossed (the pre-roll), so a word's first sound is never lost.
- **The quiet parts** says what becomes of the rest: cut out for the
  shortest file, or kept as silence so the take keeps its length beside a
  video. The line under the choice says which is which in words.
- It is remembered on this device, like Quality. The gate is cut from every
  sample at Stop; the screen's "Hearing sound" runs the same rule live
  (`gate.ts`), so what the screen said is what was kept.

### The EQ sheet

```
┌───────────────────────────────────────────┐
│  Equalizer                            ✕   │
│  Podcast · Low cut            [Compare]   │  preset or Custom · hear it flat
│  ┌─────────────────────────────────────┐  │
│  │      ╭─•──•───•──╮•─────            │  │  the curve, bands marked; the
│  │  ╭──╯              ▒▒▒ live ▒▒▒     │  │  sound after it behind, live
│  └─────────────────────────────────────┘  │
│  [Flat] [Podcast] [Warm] [Bright] …       │  starting points
│   (◜)    (◝)    (│)    (◝)    (◝)         │  a knob per band
│   Bass  Warmth  Mids  Presence  Air       │
│  [■ ] Low cut — rumble under 80 Hz        │
│  🎧 Hear yourself through it  [Monitor]   │  Record screen: the microphone
│     ── or ──                              │
│  ▶ Interview: Mira, part 1   0:03 / 0:10  │  player: the transport
└───────────────────────────────────────────┘
```

- **One sheet, two owners.** From the Record screen it is the EQ new takes
  start with (a per-device setting, like Quality); from the player it is
  that recording's. It is never written into the bytes: it is kept beside
  the recording, heard in the player and in Review, and baked into an
  export, and Flat always brings the recording back.
- **The curve is on top** because it is what an EQ _is_; the knobs under it
  are how it is turned. While something is heard, the sound is drawn
  behind the curve as bars, moved by the EQ as it turns — what it adds in
  the accent, what it takes away hollow — so a cut can be seen taking a
  hum out. The curve's floor sits past −24 dB, so a band turned off runs
  out of the bottom rather than stopping at a number.
- **Knobs, not sliders**, because that is what an EQ is to anyone who has
  used one, and five of them fit a phone's width. They are named for what
  they do — Bass, Warmth, Mids, Presence, Air — with the frequency under
  the name for the reader who thinks in hertz.
- **The low cut is its own switch**, not part of a starting point. A
  starting point sets the five knobs and leaves the switch as it was;
  turning the switch leaves the starting point named as it was ("Podcast ·
  Low cut"). When a preset carried the low cut, the two undid each other —
  a "No rumble" preset that was the switch plus a little bass lit and went
  dark as the switch was flipped — so there is no such preset.
- **Compare** is beside the preset's name, so A/B is one press away while
  judging a change; it changes nothing.
- **Monitor** (Record screen only) says to put headphones on before it
  starts, stops itself the moment it hears feedback (and says so, in the
  place the hint was), opens the microphone only on the press, and keeps
  nothing. It is the same monitor as the headphones glyph while Listening
  and Recording: it runs beside Listening rather than taking the microphone
  from it, and closing the sheet closes it only when nothing else has the
  microphone open. In the player, the same place holds
  the transport, so a change is heard without leaving the sheet.

## Recordings

The library is where the "after" happens: find it, play it, file it, get it
out.

```
┌───────────────────────────────────────────┐
│  [🗀 Ideas ▾]  3                      🔍   │  scope (with count) · search glyph
│                                           │
│  TODAY                                    │  day headings replace a date per row
│  ▁▃▅▂  Idea: garden shed layout      0:10 │
│        7:58 AM                            │
│  YESTERDAY                                │
│  ▂▅▃▁  Song sketch, chorus  ★         0:10 │
│        7:58 AM                            │
│  FRIDAY                                   │
│  ▃▂▅▃  Lecture notes, week 4         0:10 │
│        2:58 PM                            │
└───────────────────────────────────────────┘
```

- **The scope button** is the heading. It says where you are (All
  recordings, Favorites, a folder's path, Recently deleted) and how many
  recordings are in it, and pressing it opens the **folder picker** in its
  browsing form. It replaces the search field, four chips and a separate
  count line that together took a quarter of a phone screen.
- **Search is a glyph** at the right of the scope. It opens the **search
  sheet**: a field at the top, focused, and the results under it as the
  same rows. Searching is a moment, not a permanent fixture, and a full
  sheet gives the results the whole height instead of the gap under a
  crammed field.
- **Day headings** ("Today", "Yesterday", "Friday", "Sep 23") group the
  rows, so each row's second line is only the time and, in All, the folder.
  A date repeated on every row was the least useful text on the screen.
- **A row** is the waveform thumbnail (recognition at a glance), the title
  (with a star when favourited), the time and folder, and the **length,
  right-aligned** in tabular figures. Lengths line up so a long interview
  stands out from a thirty-second memo. The chevron is gone: every row is
  obviously tappable, and the length now lives in that corner.
- **A tap** opens the player. **A swipe** left bares one red trash button,
  and pressing _it_ deletes (to Recently deleted) — a swipe that went too
  far, or was meant as a scroll, throws nothing away. **A hold** (or
  right-click) offers favourite, move, export, delete, each with its glyph.
- **Recently deleted** says how long it keeps things in one line under the
  scope, and its rows offer Put back and Delete for good.

### The folder picker

One sheet, three uses. The layout is the same each time, so learning it once
is enough.

```
┌───────────────────────────────────────────┐
│  Show                                 ✕   │   (or "Move to" / "Save to")
│                                           │
│  ☰  All recordings                   12   │   browsing only
│  ★  Favorites                         2   │   browsing only
│  FOLDERS                                  │
│  🗀  Meetings                         5 ⋯  │
│     🗀  Interviews                    2 ⋯  │
│  🗀  Ideas                  ✓         3 ⋯  │
│  ＋ New folder                            │   every use
│  🗑  Recently deleted                 0   │   browsing only
└───────────────────────────────────────────┘
```

- **Browsing** (the library's scope): All, Favorites, the folder tree with
  counts, New folder, Recently deleted. The counts are derived, never
  stored, and they're shown because "which folder has the interview in it"
  is often answered by a number.
- **Choosing** (Move, and the take's destination): "No folder", the tree,
  New folder. The current choice is ticked.
- **New folder** is the last item in the tree, where you look when the
  folder you want isn't there. It opens a small sheet: a name and where it
  goes ("Top level" or inside a folder, starting on the one that is
  selected). In the choosing form the new folder is then selected, so
  "move this to a folder that doesn't exist yet" is one flow and not a
  detour.
- **⋯ on a folder** (browsing only) is the folder's menu: rename, new
  folder inside, move, move up, move down, delete. This is all the old
  Folders page did, next to the thing it is about.

## The player

The player is a recording's page: listen, annotate, file, export.

```
┌───────────────────────────────────────────┐
│  Interview: Mira, part 1            ★  ✕  │  title (editable) · favourite · close
│  Monday 10:58 AM · [🗀 Interviews ›]       │  when · where (the picker)
│                                           │
│  ▁▂▃▅▃▂▁▂▅▇▅▃▂▁▂▃▂▁▂▃▅▃▂▁▂▅▇▅▃▂▁▂▃▂▁       │  the shape, seekable, with the playhead
│  0:03                              0:10   │
│                                           │
│  [╭╮]  (↺15)    ( ▶ )     (15↻)    [1×]   │  EQ · transport · speed
│                                           │
│  Add a note…                              │  the note
│                                           │
│  AAC 128k · 48 kHz · Mono · 160 KB        │  the facts, always visible
│  Peak −3.1 dB · No clipping               │
│                                           │
│  [ ⇪ Export… ]                      ( 🗑 ) │  export · delete glyph
└───────────────────────────────────────────┘
```

- **The title** is editable in place, because a take named "New recording
  4" gets its real name here, usually right after listening back.
- **The folder** is a chip beside the date, which opens the picker in its
  choosing form. Filing is one tap from the recording, with no need to find
  a Move button.
- **EQ** is a glyph left of the transport, balancing Speed on the right,
  and lit when the recording has one. It opens the EQ sheet for this
  recording, with the transport inside it.
- **Speed** is a single button that steps through the rates (0.5× … 2×).
  The six-way segmented control took a row for something set occasionally.
  It sits beside the transport because it changes the transport.
- **The facts** used to be hidden under a Details disclosure, and now they
  are two quiet lines. Format, rate, channels and size are what someone
  checks before exporting to a DAW; peak and clipping are what a musician
  checks before calling it a keeper.
- **Export** is the one labelled action because it is the way out, and it is
  what the player is opened for as often as listening. **Delete** is a
  trash glyph at the opposite end, so the two can't be mistaken for each
  other.

## Export

```
┌───────────────────────────────────────────┐
│  Cancel          Export          [Export] │
│                                           │
│  Format   [ WAV ][ FLAC ][ MP3 ]          │
│           Small and plays everywhere.     │
│  Bitrate  64  96 [128] 192 256 320        │  per format: depth / compression / bitrate
│  Rate     [As recorded] 22 44.1 48 kHz    │
│  ☑ Mono                                   │
│                                           │
│  ≈ 160 KB · 48 kHz · mono MP3             │  what you'll get, before you press it
│                                           │
│  Share the original file                  │  the take as it is, no re-encode
└───────────────────────────────────────────┘
```

- The sheet keeps its shape because the choices it offers are the right
  ones: format, the one quality knob that format has, rate, mono.
- **What you'll get** is new: an estimate of the file's size and a
  one-line summary of the result, from the same `exportPlan` the encoder
  uses. A journalist mailing a file wants to know it will fit; a musician
  wants to see "48 kHz stereo WAV" before dragging it into a session.
- It still starts on the export defaults and writes the choice back.

## Settings

Settings is for things you set once. After this change it holds: the
theme and its looks (a card per look, drawn in its own colours — by day
and by night while following the device), the Record screen's visualizer, the skip length, the export defaults,
storage and encryption, your data, developer mode, and About. What left:

- **Recording quality and voice processing** moved to the Quality sheet on
  the Record screen, because they vary between takes.
- **Spaces** moved to the top bar's space glyph, which opens the same sheet
  the Settings button did.

## What was removed, and why

| Element                                  | Why it went                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| The Folders tab                          | A page for managing names. All of it is now in the folder picker, next to the recordings.                                   |
| The "Spaces" chip in the top-left corner | A labelled control for a set-once choice. Now a glyph by the cog.                                                           |
| The library's search field               | Permanent chrome for an occasional act. Now a glyph that opens a sheet.                                                     |
| The library's four chips and count line  | Folded into one scope button that says where you are and how many.                                                          |
| The full-screen naming sheet             | Two fields on a whole screen, and Discard louder than Save. Now the Review mode, inline.                                    |
| "Aim for peaks between −12 and −6 dB"    | Static advice under a meter. Now the Listening verdict, which says whether _you_ are there.                                 |
| The empty meter card before a take       | A dead instrument. Now the invitation to listen.                                                                            |
| The Recording mode's empty lower half    | Half a screen of nothing under a small spectrum. Now the visualizer fills it, with the take's four figures under the meter. |
| The spectrum on/off setting              | Now a choice of three visualizers, switched on the Record screen itself.                                                    |
| The quality pill under the record button | It looked like a caption. Now a real button that opens the Quality sheet.                                                   |
| The row chevron                          | Every row is tappable; the length took its place.                                                                           |
| The player's Details disclosure          | The facts matter to this audience; now two quiet lines, always shown.                                                       |
| The player's six-way speed control       | A row for an occasional setting; now one button that steps.                                                                 |
| Text "Delete" / "Discard" buttons        | Now trash glyphs, set apart from the primary action, confirming before a take is lost.                                      |
| The Record screen's Latest list          | A second subject on the instrument. The recordings are the Recordings screen's.                                             |
| Text "Stop" and "Cancel" buttons         | Now a stop glyph and a close glyph; a word is kept only where a glyph alone would not say what happens.                     |
| Swipe-to-delete in one motion            | A swipe too far lost a recording. Now the swipe bares a red trash button and the press deletes.                             |
| Toasts at the top of the screen          | Under the status bar and far from the thumb. Now on the bottom bar, and a tap anywhere on one puts it away.                 |

## Layout rules

- **Phone first.** Every screen is drawn for a phone held in one hand; the
  primary action is in the bottom third.
- **The desk** is the phone's layout, centred at a readable width, with the
  destinations on the top bar and Settings as a side panel. It does not grow
  a sidebar: the folder picker is a sheet on both.
- **Sheets:** a sheet that is saved or abandoned carries a close glyph /
  title / ✓ Save across its top (`ModalHeader`). A sheet that only chooses (the folder
  picker, Quality, search) has a title and a close glyph, and a choice closes
  it.
- **Glyphs first.** An action a symbol says plainly — stop, pause, play,
  close, delete, search, share, download — is its glyph. An action that
  needs its word keeps it, with the glyph in front (Listen, Export, Save
  now, Delete everything). Delete is always red: the glyph, the swipe's
  button and the menu row.
- **Glyph buttons** always carry an accessible name, and a tooltip under a
  mouse (`IconButton`).
- **Toasts** stand on the bottom bar (on the screen's foot where there is
  no bar), above the update prompt when one is up. A tap anywhere on one
  dismisses it; the ✕ is only the visible half.
- **Colour is never the only signal.** The Listening verdict and the clip
  warning are words as well as colours; a favourite is a filled star, not a
  yellow row.
- **Every string goes through `t()`**, and a new element's copy is written
  for the person, not the implementation: "Nothing is kept", not "capture
  cancelled".
