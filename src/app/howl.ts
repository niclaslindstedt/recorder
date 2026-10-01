// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Feedback, heard: the monitor's guard against hearing itself.
//
// A phone monitoring its own microphone on its own speaker builds a loop,
// and the loop rings at one frequency — a single pure tone that climbs
// until it is the loudest thing in the room. That is what is listened for,
// in the spectrum of what the monitor is sending out:
//
// - one peak standing far above everything else (`DOMINANCE_DB` over the
//   next strongest peak, and well over the spectrum's middle), where a
//   voice or an instrument has harmonics within a few decibels of each
//   other;
// - holding its pitch to within a bin, where a sung note wavers and a
//   word moves on;
// - loud (`LOUD_DB`), and for long enough (`HOLD_MS`) that a click or a
//   consonant is not mistaken for it.
//
// All four together are feedback; any one alone is not. A held whistle
// close to the microphone can pass for it, and then the monitor stops and
// can be started again. Pure and clock-free: the spectrum and the time
// step come in with each reading.

/** The band feedback is looked for in, Hz. */
const MIN_HZ = 100;
const MAX_HZ = 12000;

/** How far the ringing peak stands above the next strongest peak, dB. */
export const DOMINANCE_DB = 18;

/** …and above the middle of the spectrum, dB. */
const OVER_MEDIAN_DB = 30;

/** How loud the peak is, in the analyser's dB per bin. */
export const LOUD_DB = -40;

/** How long it rings before it is called feedback, ms. */
export const HOLD_MS = 350;

/** Bins either side of a peak that are its own spread (the window's main
 *  lobe), not another peak. */
const LOBE_BINS = 6;

/** How far the peak may move and still be the same ring, bins. */
const DRIFT_BINS = 1;

export class HowlDetector {
  /** Where the ring started, and how long it has held there. */
  private bin = -1;
  private heldMs = 0;

  /** One reading of the spectrum (`getFloatFrequencyData`'s dB per bin)
   *  `dtMs` after the last. True once it is feedback. */
  step(freqDb: Float32Array, sampleRate: number, dtMs: number): boolean {
    const peak = ringingPeak(freqDb, sampleRate);
    if (peak === null) {
      this.reset();
      return false;
    }
    // Measured from where the ring started, not from the last reading, so
    // a slow vibrato that wanders a bin at a time still counts as moving.
    if (this.bin >= 0 && Math.abs(peak - this.bin) <= DRIFT_BINS) {
      this.heldMs += Math.max(0, dtMs);
    } else {
      this.bin = peak;
      this.heldMs = 0;
    }
    return this.heldMs >= HOLD_MS;
  }

  reset() {
    this.bin = -1;
    this.heldMs = 0;
  }
}

/** The bin of a peak that looks like a ring in this one reading, or null. */
export function ringingPeak(
  freqDb: Float32Array,
  sampleRate: number,
): number | null {
  const n = freqDb.length;
  if (n === 0 || !(sampleRate > 0)) return null;
  const binHz = sampleRate / 2 / n;
  const lo = Math.max(1, Math.floor(MIN_HZ / binHz));
  const hi = Math.min(n - 1, Math.ceil(MAX_HZ / binHz));
  if (hi - lo < 4 * LOBE_BINS) return null;

  let peak = lo;
  for (let i = lo; i <= hi; i++) if (freqDb[i]! > freqDb[peak]!) peak = i;
  const top = freqDb[peak]!;
  if (!(top >= LOUD_DB)) return null;

  // The strongest thing that is not this peak's own spread.
  let second = -Infinity;
  for (let i = lo; i <= hi; i++) {
    if (Math.abs(i - peak) <= LOBE_BINS) continue;
    if (freqDb[i]! > second) second = freqDb[i]!;
  }
  if (top - second < DOMINANCE_DB) return null;

  const band = Array.from(freqDb.subarray(lo, hi + 1)).sort((a, b) => a - b);
  const median = band[Math.floor(band.length / 2)]!;
  if (top - median < OVER_MEDIAN_DB) return null;
  return peak;
}
