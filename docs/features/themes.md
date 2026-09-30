# Themes

Under **Settings → Appearance**: a mode — **Light**, **Dark** or **Device**
(the default, which follows the device) — and a **look** for each side of
the day. While the app follows the device it shows both: one look **by
day** and one **by night**, so it can be Paper while the phone is light and
Vinyl once it goes dark.

| By night  | Feels like                                        |
| --------- | ------------------------------------------------- |
| Studio    | A quiet control room. Nothing competes with sound |
| Vinyl     | Warm browns and amber, like a valve amp glowing   |
| Neon      | City lights after midnight, blue and electric     |
| Velvet    | Stage curtains and a purple spotlight             |
| Dusk      | Rose and gold as the light goes down              |
| Fjord     | Cool northern blues, calm as still water          |
| Dream pop | Soft pastels on a night sky                       |
| Lagoon    | Deep teal and brass, like tape under water        |

| By day      | Feels like                                         |
| ----------- | -------------------------------------------------- |
| Studio      | White walls and daylight. Clean and out of the way |
| Paper       | Cream stock and ink, like a songwriter's notebook  |
| Dawn        | Morning light on linen, soft and warm              |
| Watercolour | Pale washes and bright pigment                     |

Studio is the default on both sides.

## Why these names

The palettes are the framework's — every one it ships — but the framework
names them after where they came from among programmers (GitHub, Dracula,
Solarized, Tokyo Night). The people this app is for are recording a song
idea, an interview, a field sound or a voice line, so each palette is
named for what it feels like to work in, and each card in the picker is
drawn in its own colours as a little of this app: a take's shape, the
meter's green, amber and red, and the record button. The names are the
app's own ids (`src/app/look.ts`) and are what a device stores, so a
palette the framework renames only changes the table in that file.

## What stays the same in every look

The meter's three zones are always the look's accent, its amber and its
red, and the red always means one thing: too loud. A look changes how the
app feels, never what a colour says. Every look keeps the Play and Save
buttons' label (the page's ground on the accent) at better than 3:1, which
`tests/look_test.ts` checks.

The framework's full appearance picker (fonts, corner radius, density, a
custom palette) is still not offered: those are a programmer's knobs, and a
recorder is looked at while something else is happening.
