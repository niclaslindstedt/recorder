// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_PRESETS,
  FLAT_EQ,
  applyEq,
  clampGain,
  isFlat,
  normalizeEq,
  presetOf,
  responseDb,
  withGain,
  type Eq,
} from "../src/app/eq.ts";

const RATE = 48000;

function sine(hz: number, seconds = 0.5, amp = 0.25): Float32Array {
  const n = Math.round(RATE * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = amp * Math.sin((2 * Math.PI * hz * i) / RATE);
  return out;
}

/** The level of the second half of a signal, after the filters settle. */
function levelDb(samples: Float32Array): number {
  let sum = 0;
  const from = Math.floor(samples.length / 2);
  for (let i = from; i < samples.length; i++) sum += samples[i]! ** 2;
  return 10 * Math.log10(sum / (samples.length - from));
}

/** What the EQ does to a sine at `hz`, measured on the samples. */
function measured(eq: Eq, hz: number): number {
  const dry = sine(hz);
  const wet = applyEq({ sampleRate: RATE, channels: [dry] }, eq).channels[0]!;
  return levelDb(wet) - levelDb(dry);
}

describe("the equalizer", () => {
  it("leaves the sound alone when flat", () => {
    const pcm = { sampleRate: RATE, channels: [sine(440)] };
    expect(applyEq(pcm, FLAT_EQ)).toBe(pcm);
    expect(applyEq(pcm, null)).toBe(pcm);
    expect(responseDb(FLAT_EQ, 1000)).toBe(0);
  });

  it("boosts a band at its centre by what the knob says", () => {
    const eq = withGain(FLAT_EQ, "mids", 6);
    expect(responseDb(eq, 1000)).toBeCloseTo(6, 1);
    expect(measured(eq, 1000)).toBeCloseTo(6, 0);
    // An octave and more away it hardly moves.
    expect(Math.abs(measured(eq, 8000))).toBeLessThan(0.6);
  });

  it("cuts as far as it boosts", () => {
    const eq = withGain(FLAT_EQ, "presence", -9);
    expect(responseDb(eq, 3500)).toBeCloseTo(-9, 1);
    expect(measured(eq, 3500)).toBeCloseTo(-9, 0);
  });

  it("lifts everything under Bass and over Air like a shelf", () => {
    const bass = withGain(FLAT_EQ, "bass", 6);
    expect(responseDb(bass, 30)).toBeCloseTo(6, 0);
    expect(Math.abs(responseDb(bass, 3000))).toBeLessThan(0.3);
    const air = withGain(FLAT_EQ, "air", 6);
    expect(responseDb(air, 18000)).toBeGreaterThan(5);
    expect(Math.abs(responseDb(air, 300))).toBeLessThan(0.3);
  });

  it("takes the rumble out with the low cut and leaves the voice", () => {
    const eq = { ...FLAT_EQ, lowCut: true };
    expect(measured(eq, 30)).toBeLessThan(-12);
    expect(Math.abs(measured(eq, 1000))).toBeLessThan(0.2);
    // Butterworth: three down at the corner.
    expect(responseDb(eq, 80)).toBeCloseTo(-3, 0);
  });

  it("draws the curve the samples get", () => {
    const eq = EQ_PRESETS.find((p) => p.id === "podcast")!.eq;
    for (const hz of [60, 200, 700, 2500, 6000]) {
      expect(measured(eq, hz)).toBeCloseTo(responseDb(eq, hz), 0);
    }
  });

  it("filters every channel", () => {
    const eq = withGain(FLAT_EQ, "mids", -12);
    const out = applyEq(
      { sampleRate: RATE, channels: [sine(1000), sine(1000)] },
      eq,
    );
    expect(levelDb(out.channels[1]!)).toBeCloseTo(levelDb(out.channels[0]!), 6);
  });

  it("leaves a band out that the rate cannot carry", () => {
    const eq = withGain(FLAT_EQ, "air", 6);
    const low = { sampleRate: 16000, channels: [sine(1000)] };
    expect(applyEq(low, eq)).toBe(low);
  });
});

describe("an EQ as stored", () => {
  it("keeps the knob's range and step", () => {
    expect(clampGain(3.3)).toBe(3.5);
    expect(clampGain(40)).toBe(EQ_MAX_DB);
    expect(clampGain(-40)).toBe(-EQ_MAX_DB);
    expect(clampGain(Number.NaN)).toBe(0);
    expect(Object.is(clampGain(-0.1), 0)).toBe(true);
  });

  it("reads what it can, and calls flat nothing at all", () => {
    expect(normalizeEq(null)).toBeNull();
    expect(normalizeEq("loud")).toBeNull();
    expect(normalizeEq({ lowCut: false, gains: { bass: 0 } })).toBeNull();
    expect(
      normalizeEq({ lowCut: "yes", gains: { bass: "3", treble: 9, air: 99 } }),
    ).toEqual({
      lowCut: false,
      gains: { bass: 3, warmth: 0, mids: 0, presence: 0, air: 12 },
    });
    expect(normalizeEq({ lowCut: true })).toEqual({
      ...FLAT_EQ,
      lowCut: true,
    });
  });

  it("names every preset once, and knows an EQ turned by hand", () => {
    const ids = EQ_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of EQ_PRESETS) expect(presetOf(p.eq)).toBe(p.id);
    expect(presetOf(null)).toBe("flat");
    expect(presetOf(withGain(FLAT_EQ, "mids", 0.5))).toBeNull();
    expect(isFlat(EQ_PRESETS[0].eq)).toBe(true);
    for (const p of EQ_PRESETS.slice(1)) expect(isFlat(p.eq)).toBe(false);
    for (const p of EQ_PRESETS)
      for (const b of EQ_BANDS)
        expect(Math.abs(p.eq.gains[b.id])).toBeLessThanOrEqual(EQ_MAX_DB);
  });
});
