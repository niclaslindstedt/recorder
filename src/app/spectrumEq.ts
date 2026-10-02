// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The spectrum as it will be heard: what the take's EQ does to each of the
// spectrum's bars, and what that does to the level as a whole. Pure — the
// curve is `eq.ts`'s, the bars' scale the framework's (`bandLevels`), and
// `tests/spectrumEq_test.ts` checks the arithmetic between them.
//
// The microphone is captured as it is: an EQ is a fact about a recording,
// applied when it is played or exported and never written into its bytes.
// So the spectrum's bars are the sound before the EQ, and this is what moves
// each one to where it will be heard — and how much louder or quieter the
// whole sound gets for it, so the spectrum's colour can say whether the EQ
// pushes a take off its target.
//
// That last figure is an estimate: the bars are each band's peak bin, the
// change in level is what the EQ does to their power summed, and a peak in
// the samples does not move by exactly that. It is close enough to say
// "this boost takes you over", which is what it is for.

import {
  SPECTRUM_CEIL_DB,
  SPECTRUM_FLOOR_DB,
} from "@niclaslindstedt/oss-framework/audio";

import { eqResponse, isFlat, type Eq } from "./eq.ts";

const SPAN_DB = SPECTRUM_CEIL_DB - SPECTRUM_FLOOR_DB;

/** What the EQ does under each bar, dB, at the middle of the bar on the
 *  log scale. `edgesHz` is the framework's layout: each bar's lower edge,
 *  and the top edge last. Flat is `null`, so a caller can skip the work. */
export function bandGains(
  eq: Eq | null,
  edgesHz: readonly number[],
  rate = 48000,
): number[] | null {
  if (isFlat(eq)) return null;
  const response = eqResponse(eq, rate);
  const gains: number[] = [];
  for (let i = 0; i + 1 < edgesHz.length; i++)
    gains.push(response(Math.sqrt(edgesHz[i]! * edgesHz[i + 1]!)));
  return gains;
}

/** A bar's height (0…1) moved by `gainDb`, on the bars' own scale. */
export function shiftBar(share: number, gainDb: number): number {
  if (!(share > 0)) return 0;
  const moved = share + gainDb / SPAN_DB;
  return moved > 1 ? 1 : moved > 0 ? moved : 0;
}

/**
 * How much the EQ moves the sound as a whole, dB: the bars' power before
 * and after, summed. A bar at the floor holds no sound worth counting, so
 * silence moves nothing.
 */
export function levelShiftDb(
  bars: ArrayLike<number>,
  gains: readonly number[] | null,
): number {
  if (!gains) return 0;
  let before = 0;
  let after = 0;
  const n = Math.min(bars.length, gains.length);
  for (let i = 0; i < n; i++) {
    const share = bars[i]!;
    if (!(share > 0)) continue;
    const power = Math.pow(10, (SPECTRUM_FLOOR_DB + share * SPAN_DB) / 10);
    before += power;
    after += power * Math.pow(10, gains[i]! / 10);
  }
  if (before === 0) return 0;
  return 10 * Math.log10(after / before);
}
