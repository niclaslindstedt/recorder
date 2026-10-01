// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What Listening says about a room: the last few seconds of the meter,
// read as three numbers and a verdict. Pure and clock-free — a reading
// carries its own time, so a test can play a room back at any speed.
//
// The verdict is read against the target level (`target.ts`) — the same
// range the waveform shades and the meter's bar is coloured by — so the
// words, the bar and the picture never disagree. What is hot or clipping is
// the framework's (`meterTone`, the clip lamp), whatever the target says.

import { METER_FLOOR_DB } from "@niclaslindstedt/oss-framework/audio";

import { DEFAULT_TARGET, targetTone, type TargetRange } from "./target.ts";

export type Reading = {
  /** When, ms, on any monotonic clock. */
  at: number;
  /** The meter's bar, dBFS. */
  levelDb: number;
  /** The meter's peak mark, dBFS. */
  peakDb: number;
  /** Whether the clip lamp was lit. */
  clipping: boolean;
};

/** How far back Listening looks. Long enough that a sentence's peaks are
 *  all in it; short enough that moving the microphone shows in a breath. */
export const LISTEN_WINDOW_MS = 4000;

/** Below this peak nothing is being heard at all — a muted input, or a
 *  microphone that is not the one in front of you. */
export const SILENT_DB = METER_FLOOR_DB + 10;

export type Verdict = "silent" | "quiet" | "good" | "loud" | "hot" | "clipping";

export type Ambient = {
  /** The noise floor: the quiet end of the window's level. */
  roomDb: number;
  /** The loudest peak in the window. */
  peakDb: number;
  /** How far that peak is from full scale. */
  headroomDb: number;
  verdict: Verdict;
};

/** Add a reading and drop the ones older than the window. Returns a new
 *  array; the one handed in is not touched. */
export function pushReading(
  window: readonly Reading[],
  reading: Reading,
  spanMs = LISTEN_WINDOW_MS,
): Reading[] {
  const from = reading.at - spanMs;
  const kept = window.filter((r) => r.at >= from && r.at <= reading.at);
  kept.push(reading);
  return kept;
}

/** The share of the window's quietest readings the noise floor is taken
 *  from: the tenth percentile, so a pause between words counts and a cough
 *  does not. */
const ROOM_PERCENTILE = 0.1;

/** The window, read against the target. `null` before the first reading. */
export function readAmbient(
  window: readonly Reading[],
  target: TargetRange = DEFAULT_TARGET,
): Ambient | null {
  if (window.length === 0) return null;
  const levels = window.map((r) => r.levelDb).sort((a, b) => a - b);
  const roomDb =
    levels[
      Math.min(levels.length - 1, Math.floor(levels.length * ROOM_PERCENTILE))
    ]!;
  let peakDb = METER_FLOOR_DB;
  let clipping = false;
  for (const r of window) {
    if (r.peakDb > peakDb) peakDb = r.peakDb;
    if (r.clipping) clipping = true;
  }
  return {
    roomDb,
    peakDb,
    headroomDb: Math.max(0, -peakDb),
    verdict: verdictFor(peakDb, clipping, target),
  };
}

/** A peak in words: nothing heard, under the target, in it, over it, in
 *  the framework's hot zone, or clipping. */
export function verdictFor(
  peakDb: number,
  clipping: boolean,
  target: TargetRange = DEFAULT_TARGET,
): Verdict {
  if (clipping) return "clipping";
  if (peakDb <= SILENT_DB) return "silent";
  const tone = targetTone(peakDb, false, target);
  return tone === "under"
    ? "quiet"
    : tone === "in"
      ? "good"
      : tone === "over"
        ? "loud"
        : "hot";
}
