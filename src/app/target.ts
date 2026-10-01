// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where a take's peaks should land: a range in dBFS, chosen by what is in
// front of the microphone. Pure — the Quality sheet's rows, the
// waveform's band and the colour of every bar under it draw from here, so
// what the sheet says and what the picture shows never disagree.
//
// There is no one right level for every recording. What is universal is the
// ceiling: a clip cannot be undone, so the top of every range stays under
// the framework's hot zone (−3 dBFS), and above that the waveform is the
// meter's own amber and red. The floor depends on the source:
//
// - a voice sits where the meter's own good zone is, −18 to −6: −18 dBFS is
//   the European studio alignment level (EBU R68, 0 VU), and peaks kept
//   under −6 leave room for a laugh;
// - an instrument or a singer is tracked a little hotter and steadier,
//   peaks −12 to −6, the advice most engineers give for 24-bit recording;
// - drums, a band or anything that jumps gets more headroom, −20 to −10,
//   because the loudest hit is the one you did not hear coming;
// - a room, birdsong or a field recording is quiet by nature, −36 to −18:
//   turning it up to a voice's level only turns up the hiss.
//
// A loudness target for a finished file (−16 LUFS for a podcast, −14 for a
// streaming service) is a different number — it is what mastering does to
// the take afterwards, not where the take should sit — and is not here.

import { meterTone } from "@niclaslindstedt/oss-framework/audio";

export type TargetPreset = "voice" | "music" | "live" | "ambience";
export type TargetId = TargetPreset | "custom";

export type TargetRange = {
  /** Peaks under this are too quiet for the source, dBFS. */
  lowDb: number;
  /** Peaks over this are louder than the source needs, dBFS. */
  highDb: number;
};

/** The presets, in the order the sheet lists them. Voice first: it is the
 *  default, and the framework's own good zone. */
export const TARGET_PRESETS: ReadonlyArray<{ id: TargetPreset } & TargetRange> =
  [
    { id: "voice", lowDb: -18, highDb: -6 },
    { id: "music", lowDb: -12, highDb: -6 },
    { id: "live", lowDb: -20, highDb: -10 },
    { id: "ambience", lowDb: -36, highDb: -18 },
  ];

export const TARGET_IDS: readonly TargetId[] = [
  ...TARGET_PRESETS.map((p) => p.id),
  "custom",
];

/** The quietest floor a custom range may have — well above the meter's
 *  own −60, where there is still a shape to read. */
export const TARGET_MIN_DB = -48;
/** The highest ceiling a custom range may have: the framework's hot zone
 *  starts here, and that is never a target. */
export const TARGET_MAX_DB = -3;
/** The narrowest a range may be. Speech moves more than this between
 *  syllables; a narrower band would be red ink on every word. */
export const TARGET_MIN_SPAN_DB = 3;

/** A custom range made sensible: whole decibels, inside the bounds, the
 *  floor under the ceiling by at least the minimum span. The ceiling wins
 *  a tie, since it is the one that protects the take. */
export function clampTarget(lowDb: number, highDb: number): TargetRange {
  const whole = (v: number, fallback: number) =>
    Number.isFinite(v) ? Math.round(v) : fallback;
  const high = Math.min(
    TARGET_MAX_DB,
    Math.max(TARGET_MIN_DB + TARGET_MIN_SPAN_DB, whole(highDb, -6)),
  );
  const low = Math.max(
    TARGET_MIN_DB,
    Math.min(high - TARGET_MIN_SPAN_DB, whole(lowDb, -18)),
  );
  return { lowDb: low, highDb: high };
}

/** The range a choice stands for: a preset's own, or the custom one. */
export function targetRange(id: TargetId, custom: TargetRange): TargetRange {
  const preset = TARGET_PRESETS.find((p) => p.id === id);
  return preset
    ? { lowDb: preset.lowDb, highDb: preset.highDb }
    : clampTarget(custom.lowDb, custom.highDb);
}

/** Where a moment's peak lands against the range:
 *
 * - `under`: quieter than the source wants — drawn without colour;
 * - `in`: where it should be — the accent;
 * - `over`: louder than the source needs but not yet hot — amber;
 * - `hot`: the framework's hot zone, or a clip — red, whatever the range.
 *
 * The last is the framework's (`meterTone`), so a range can never call a
 * reading safe that the meter calls hot. */
export type TargetTone = "under" | "in" | "over" | "hot";

export function targetTone(
  peakDb: number,
  clipped: boolean,
  range: TargetRange,
): TargetTone {
  if (clipped || meterTone(peakDb) === "hot") return "hot";
  if (peakDb > range.highDb) return "over";
  if (peakDb >= range.lowDb) return "in";
  return "under";
}

/** A range's edge as the waveform and the sheet print it: whole decibels
 *  with a real minus sign, "−18". */
export function formatTargetDb(db: number): string {
  const n = Math.round(db);
  return n < 0 ? `−${-n}` : String(n);
}
