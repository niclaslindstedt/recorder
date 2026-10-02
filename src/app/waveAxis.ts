// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The decibels printed up the side of a picture: the waveforms (the live one
// and a take's) and the spectrum. Pure — which marks fit, and where, is
// arithmetic on a height, so `tests/waveAxis_test.ts` can try a phone's
// short strip and a tall card without a canvas.
//
// A waveform here is drawn on the meter's own scale (`meterFill`), mirrored
// about its middle, so its axis is the top half's: the middle is the meter's
// floor and the top edge 0 dBFS. The target's two edges are always the
// first marks asked for, since they are what the colours mean; then −3,
// where red starts whatever the target says; then the meter's own scale
// as room allows. A mark whose label would crowd one already placed is
// left out rather than printed over it.

import {
  METER_SCALE_DB,
  SPECTRUM_CEIL_DB,
  SPECTRUM_FLOOR_DB,
  meterFill,
} from "@niclaslindstedt/oss-framework/audio";

import type { TargetRange } from "./target.ts";

export type AxisMark = {
  db: number;
  /** Where the mark's line is, 0 at the axis's foot and 1 at its top. */
  at: number;
  /** One of the target's two edges: drawn dashed, not as a grid line. */
  edge: boolean;
};

/** How far apart two labels have to be, CSS px — a little over the
 *  nine-pixel figures they are printed in. */
export const MARK_GAP_PX = 12;

/** Where the hot zone starts: the framework's red, whatever the target. */
const HOT_DB = -3;

/**
 * The marks that fit up an axis `lengthPx` long, chosen from `wanted` in
 * the order given. A label is printed level with its line, so a mark too
 * near either end for half a label is skipped; so is one closer than
 * `gapPx` to a mark already taken. Returned from the top down.
 */
export function pickMarks(
  wanted: ReadonlyArray<{ db: number; at: number; edge?: boolean }>,
  lengthPx: number,
  gapPx: number = MARK_GAP_PX,
): AxisMark[] {
  if (!(lengthPx > 0)) return [];
  const taken: AxisMark[] = [];
  for (const w of wanted) {
    if (!Number.isFinite(w.at)) continue;
    const y = w.at * lengthPx;
    if (y > lengthPx - gapPx / 2 || y < gapPx / 2) continue;
    if (taken.some((m) => m.db === w.db)) continue;
    if (taken.some((m) => Math.abs(m.at * lengthPx - y) < gapPx)) continue;
    taken.push({ db: w.db, at: w.at, edge: w.edge ?? false });
  }
  return taken.sort((a, b) => b.at - a.at);
}

/** The marks up one half of a waveform `halfPx` tall: the target's edges,
 *  then −3, then the meter's scale from the middle of it outwards. */
export function waveMarks(target: TargetRange, halfPx: number): AxisMark[] {
  const scale = [-20, -40, -12, -30, -6, ...METER_SCALE_DB];
  return pickMarks(
    [
      { db: target.highDb, at: meterFill(target.highDb), edge: true },
      { db: target.lowDb, at: meterFill(target.lowDb), edge: true },
      { db: HOT_DB, at: meterFill(HOT_DB) },
      ...scale.map((db) => ({ db, at: meterFill(db) })),
    ],
    halfPx,
  );
}

/** Where a level sits on the spectrum's bars, 0 at the foot: the
 *  framework's own floor and ceiling (`bandLevels`). */
export function spectrumAt(db: number): number {
  return (db - SPECTRUM_FLOOR_DB) / (SPECTRUM_CEIL_DB - SPECTRUM_FLOOR_DB);
}

/** The marks up the spectrum, every ten decibels that fits, the round
 *  twenties first. */
export function spectrumMarks(lengthPx: number): AxisMark[] {
  const wanted: number[] = [];
  for (let db = SPECTRUM_CEIL_DB; db > SPECTRUM_FLOOR_DB; db -= 10)
    wanted.push(db);
  wanted.sort((a, b) => (a % 20 === 0 ? 0 : 1) - (b % 20 === 0 ? 0 : 1));
  return pickMarks(
    wanted.map((db) => ({ db, at: spectrumAt(db) })),
    lengthPx,
  );
}
