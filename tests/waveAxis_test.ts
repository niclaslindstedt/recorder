// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  SPECTRUM_CEIL_DB,
  SPECTRUM_FLOOR_DB,
  meterFill,
} from "@niclaslindstedt/oss-framework/audio";
import { describe, expect, it } from "vitest";

import { TARGET_PRESETS } from "../src/app/target.ts";
import {
  MARK_GAP_PX,
  pickMarks,
  spectrumAt,
  spectrumMarks,
  waveMarks,
} from "../src/app/waveAxis.ts";

const voice = { lowDb: -18, highDb: -6 };

/** No two labels closer than the gap, none crowding the top or the foot. */
function readable(marks: ReturnType<typeof pickMarks>, lengthPx: number) {
  const ys = marks.map((m) => m.at * lengthPx);
  for (const y of ys) {
    expect(y).toBeGreaterThanOrEqual(MARK_GAP_PX / 2);
    expect(y).toBeLessThanOrEqual(lengthPx - MARK_GAP_PX / 2);
  }
  for (let i = 1; i < ys.length; i++)
    expect(ys[i - 1]! - ys[i]!).toBeGreaterThanOrEqual(MARK_GAP_PX);
}

describe("pickMarks", () => {
  it("takes marks in the order asked, skipping one that would crowd", () => {
    const marks = pickMarks(
      [
        { db: 1, at: 0.5 },
        { db: 2, at: 0.52 },
        { db: 3, at: 0.2 },
      ],
      100,
    );
    expect(marks.map((m) => m.db)).toEqual([1, 3]);
  });

  it("returns them from the top down", () => {
    const marks = pickMarks(
      [
        { db: 1, at: 0.3 },
        { db: 2, at: 0.7 },
      ],
      100,
    );
    expect(marks.map((m) => m.db)).toEqual([2, 1]);
  });

  it("has nothing for an axis with no length", () => {
    expect(pickMarks([{ db: 1, at: 0.5 }], 0)).toEqual([]);
    expect(pickMarks([{ db: 1, at: 0.5 }], Number.NaN)).toEqual([]);
  });

  it("keeps a label off the very top and the very foot", () => {
    expect(pickMarks([{ db: 0, at: 1 }], 100)).toEqual([]);
    expect(pickMarks([{ db: -60, at: 0 }], 100)).toEqual([]);
    expect(pickMarks([{ db: -1, at: 0.97 }], 100)).toEqual([]);
  });
});

describe("waveMarks", () => {
  it("puts the target's two edges first, marked as edges", () => {
    const marks = waveMarks(voice, 120);
    const edges = marks.filter((m) => m.edge).map((m) => m.db);
    expect(edges.sort((a, b) => a - b)).toEqual([-18, -6]);
    for (const m of marks) expect(m.at).toBe(meterFill(m.db));
  });

  it("fills a tall card with the meter's scale, readably", () => {
    const marks = waveMarks(voice, 160);
    expect(marks.length).toBeGreaterThanOrEqual(4);
    expect(marks.map((m) => m.db)).toContain(-40);
    readable(marks, 160);
  });

  it("keeps a short strip to what fits, the target's edges before the scale", () => {
    // The player's shape on a phone: about 60 px a half.
    const marks = waveMarks(voice, 60);
    readable(marks, 60);
    expect(marks.some((m) => m.edge)).toBe(true);
  });

  it("is readable for every preset, short or tall", () => {
    for (const preset of TARGET_PRESETS)
      for (const half of [40, 60, 90, 140, 220]) {
        const marks = waveMarks(preset, half);
        readable(marks, half);
        expect(new Set(marks.map((m) => m.db)).size).toBe(marks.length);
      }
  });

  it("never prints the hot edge as one of the target's", () => {
    const marks = waveMarks(voice, 200);
    const hot = marks.find((m) => m.db === -3);
    if (hot) expect(hot.edge).toBe(false);
  });
});

describe("the spectrum's marks", () => {
  it("sit on the framework's floor and ceiling", () => {
    expect(spectrumAt(SPECTRUM_FLOOR_DB)).toBe(0);
    expect(spectrumAt(SPECTRUM_CEIL_DB)).toBe(1);
  });

  it("are whole tens, readable, and the twenties come first", () => {
    const marks = spectrumMarks(150);
    readable(marks, 150);
    for (const m of marks) expect(Math.abs(m.db % 10)).toBe(0);
    const short = spectrumMarks(50);
    readable(short, 50);
    for (const m of short) expect(Math.abs(m.db % 20)).toBe(0);
  });
});
