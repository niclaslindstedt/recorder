// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  SPECTRUM_CEIL_DB,
  SPECTRUM_FLOOR_DB,
  layoutBands,
} from "@niclaslindstedt/oss-framework/audio";
import { describe, expect, it } from "vitest";

import { FLAT_EQ, responseDb, type Eq } from "../src/app/eq.ts";
import { bandGains, levelShiftDb, shiftBar } from "../src/app/spectrumEq.ts";

const { edgesHz } = layoutBands(48, 2048, 48000);
const SPAN = SPECTRUM_CEIL_DB - SPECTRUM_FLOOR_DB;

function eq(gains: Partial<Eq["gains"]>, lowCut = false): Eq {
  return { lowCut, gains: { ...FLAT_EQ.gains, ...gains } };
}

/** The bar whose middle is nearest `hz`. */
function barAt(hz: number): number {
  let best = 0;
  for (let i = 0; i + 1 < edgesHz.length; i++) {
    const mid = Math.sqrt(edgesHz[i]! * edgesHz[i + 1]!);
    const was = Math.sqrt(edgesHz[best]! * edgesHz[best + 1]!);
    if (Math.abs(Math.log(mid / hz)) < Math.abs(Math.log(was / hz))) best = i;
  }
  return best;
}

describe("bandGains", () => {
  it("is nothing at all for no EQ or a flat one", () => {
    expect(bandGains(null, edgesHz)).toBeNull();
    expect(bandGains(FLAT_EQ, edgesHz)).toBeNull();
  });

  it("has one gain per bar, the curve's at the bar's middle", () => {
    const e = eq({ bass: 6, air: -6 });
    const gains = bandGains(e, edgesHz)!;
    expect(gains).toHaveLength(edgesHz.length - 1);
    const i = barAt(1000);
    const mid = Math.sqrt(edgesHz[i]! * edgesHz[i + 1]!);
    expect(gains[i]).toBeCloseTo(responseDb(e, mid), 6);
  });

  it("raises the bass bars for a bass boost and leaves the mids", () => {
    const gains = bandGains(eq({ bass: 6 }), edgesHz)!;
    expect(gains[barAt(100)]!).toBeGreaterThan(4);
    expect(Math.abs(gains[barAt(1000)]!)).toBeLessThan(0.5);
  });

  it("takes the lowest bars right down for the low cut", () => {
    const gains = bandGains(eq({}, true), edgesHz)!;
    expect(gains[0]!).toBeLessThan(-6);
    expect(gains[0]!).toBeLessThan(gains[barAt(100)]!);
    expect(Math.abs(gains[barAt(1000)]!)).toBeLessThan(0.5);
  });
});

describe("shiftBar", () => {
  it("moves a bar by the gain on the bars' own scale", () => {
    expect(shiftBar(0.5, 7)).toBeCloseTo(0.5 + 7 / SPAN, 9);
    expect(shiftBar(0.5, -7)).toBeCloseTo(0.5 - 7 / SPAN, 9);
  });

  it("stays inside the card", () => {
    expect(shiftBar(0.95, 12)).toBe(1);
    expect(shiftBar(0.05, -24)).toBe(0);
  });

  it("never raises a silent bar out of nothing", () => {
    expect(shiftBar(0, 12)).toBe(0);
  });
});

describe("levelShiftDb", () => {
  it("is nothing without an EQ, or with nothing heard", () => {
    expect(levelShiftDb(new Float32Array(48).fill(0.5), null)).toBe(0);
    expect(levelShiftDb(new Float32Array(48), new Array(48).fill(6))).toBe(0);
  });

  it("is the gain itself when every bar is moved the same", () => {
    const bars = new Float32Array(48).fill(0.4);
    expect(levelShiftDb(bars, new Array(48).fill(6))).toBeCloseTo(6, 6);
    expect(levelShiftDb(bars, new Array(48).fill(-3))).toBeCloseTo(-3, 6);
  });

  it("follows where the sound is: a boost where it is loud counts", () => {
    const e = eq({ bass: 6 });
    const gains = bandGains(e, edgesHz)!;
    const bassy = new Float32Array(48).fill(0.1);
    bassy[barAt(100)] = 0.8;
    const bright = new Float32Array(48).fill(0.1);
    bright[barAt(8000)] = 0.8;
    expect(levelShiftDb(bassy, gains)).toBeGreaterThan(4);
    expect(Math.abs(levelShiftDb(bright, gains))).toBeLessThan(1);
  });

  it("goes down when the loud part is cut", () => {
    const gains = bandGains(eq({ mids: -12 }), edgesHz)!;
    const voice = new Float32Array(48).fill(0.1);
    voice[barAt(1000)] = 0.8;
    expect(levelShiftDb(voice, gains)).toBeLessThan(-8);
  });
});
