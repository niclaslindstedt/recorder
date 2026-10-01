// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { HOLD_MS, HowlDetector, ringingPeak } from "../src/app/howl.ts";

const RATE = 48000;
const BINS = 2048; // an analyser at fftSize 4096
const BIN_HZ = RATE / 2 / BINS;
const STEP_MS = 50;

/** A spectrum as the analyser reports it: a floor of room noise, and
 *  peaks with the window's spread around each. `seed` varies the floor. */
function spectrum(
  peaks: Array<{ hz: number; db: number }>,
  seed = 0,
  floor = -95,
): Float32Array {
  const out = new Float32Array(BINS);
  for (let i = 0; i < BINS; i++)
    out[i] = floor + 4 * Math.sin(i * 12.9898 + seed * 78.233);
  const spread = [0, -6, -15, -30, -45];
  for (const p of peaks) {
    const c = Math.round(p.hz / BIN_HZ);
    for (let d = -4; d <= 4; d++) {
      const i = c + d;
      if (i < 0 || i >= BINS) continue;
      out[i] = Math.max(out[i]!, p.db + spread[Math.abs(d)]!);
    }
  }
  return out;
}

/** Feed `ms` of readings; true if it was called feedback. */
function listen(
  at: (ms: number, step: number) => Float32Array,
  ms: number,
  detector = new HowlDetector(),
): { howled: boolean; afterMs: number | null } {
  for (let t = 0, step = 0; t <= ms; t += STEP_MS, step++) {
    if (detector.step(at(t, step), RATE, STEP_MS))
      return { howled: true, afterMs: t };
  }
  return { howled: false, afterMs: null };
}

/** A voice or an instrument: a fundamental and its harmonics, falling
 *  off a few dB each, with the pitch wavering. */
function voiced(f0: number, db: number, vibrato = 0.02) {
  return (ms: number, step: number) => {
    const f = f0 * (1 + vibrato * Math.sin((2 * Math.PI * ms) / 180));
    const harmonics = Array.from({ length: 12 }, (_, h) => ({
      hz: f * (h + 1),
      db: db - 5 * Math.log2(h + 1),
    }));
    return spectrum(harmonics, step);
  };
}

describe("hearing feedback", () => {
  it("calls a loud, steady, pure tone feedback once it has rung a moment", () => {
    const ring = (_: number, step: number) =>
      spectrum([{ hz: 2400, db: -20 }], step);
    const { howled, afterMs } = listen(ring, 2000);
    expect(howled).toBe(true);
    expect(afterMs).toBeGreaterThanOrEqual(HOLD_MS);
    expect(afterMs).toBeLessThan(HOLD_MS + 3 * STEP_MS);
  });

  it("catches it low and high in the range a phone rings at", () => {
    for (const hz of [180, 700, 1300, 4000, 9000]) {
      const ring = (_: number, step: number) =>
        spectrum([{ hz, db: -25 }], step);
      expect(listen(ring, 1000).howled).toBe(true);
    }
  });

  it("lets a voice talk and a singer hold a note", () => {
    expect(listen(voiced(130, -15), 5000).howled).toBe(false);
    expect(listen(voiced(220, -10), 5000).howled).toBe(false);
    // A note held with almost no vibrato still has its harmonics.
    expect(listen(voiced(440, -8, 0.002), 5000).howled).toBe(false);
  });

  it("does not mind a quiet tone, a hum under a voice, or a sweep", () => {
    const quiet = (_: number, step: number) =>
      spectrum([{ hz: 1000, db: -60 }], step);
    expect(listen(quiet, 2000).howled).toBe(false);
    const sweep = (ms: number, step: number) =>
      spectrum([{ hz: 500 + ms * 2, db: -20 }], step);
    expect(listen(sweep, 2000).howled).toBe(false);
  });

  it("starts the count over when the ring stops short of the hold", () => {
    const detector = new HowlDetector();
    const ring = spectrum([{ hz: 3000, db: -20 }]);
    const silence = spectrum([]);
    for (let i = 0; i < 4; i++)
      expect(detector.step(ring, RATE, 50)).toBe(false);
    expect(detector.step(silence, RATE, 50)).toBe(false);
    // The first reading after the gap only marks where the ring is; the
    // hold is counted from there.
    for (let i = 0; i < HOLD_MS / 50; i++)
      expect(detector.step(ring, RATE, 50)).toBe(false);
    expect(detector.step(ring, RATE, 50)).toBe(true);
  });

  it("reads one spectrum on its own", () => {
    expect(ringingPeak(spectrum([{ hz: 2400, db: -20 }]), RATE)).toBe(
      Math.round(2400 / BIN_HZ),
    );
    expect(ringingPeak(spectrum([]), RATE)).toBeNull();
    expect(ringingPeak(new Float32Array(0), RATE)).toBeNull();
    // Two tones as loud as each other are not one ring.
    expect(
      ringingPeak(
        spectrum([
          { hz: 1000, db: -20 },
          { hz: 3000, db: -24 },
        ]),
        RATE,
      ),
    ).toBeNull();
  });
});
