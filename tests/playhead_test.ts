// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { stepPlayhead, type Playhead } from "../src/app/playhead.ts";

const FRAME_MS = 1000 / 60;

/** An element whose `currentTime` advances in uneven chunks — what a
 *  browser reports while it plays. Returns what it would say at `ms`. */
function chunky(rate = 1) {
  const chunks = [40, 60, 20, 80, 45, 35];
  return (ms: number) => {
    let at = 0;
    let i = 0;
    while (at + chunks[i % chunks.length]! <= ms) {
      at += chunks[i % chunks.length]!;
      i++;
    }
    return (at / 1000) * rate;
  };
}

function run(
  frames: number,
  reported: (ms: number) => number,
  options = { playing: true, rate: 1, duration: 60 },
) {
  let head: Playhead | null = null;
  const out: number[] = [];
  for (let f = 0; f <= frames; f++) {
    const ms = f * FRAME_MS;
    head = stepPlayhead(head, reported(ms), ms, options);
    out.push(head.time);
  }
  return out;
}

describe("the playhead's clock", () => {
  it("moves on every frame though the element reports in chunks", () => {
    const times = run(120, chunky());
    const steps = times.slice(1).map((t, i) => t - times[i]!);
    // Every frame moves, by about a frame's worth — never still, never a
    // leap.
    for (const s of steps.slice(10)) {
      expect(s).toBeGreaterThan(0.005);
      expect(s).toBeLessThan(0.03);
    }
  });

  it("stays on the element's time", () => {
    const report = chunky();
    const times = run(600, report);
    const end = 600 * FRAME_MS;
    expect(Math.abs(times[600]! - report(end))).toBeLessThan(0.08);
  });

  it("runs at the playback rate", () => {
    const times = run(300, chunky(2), { playing: true, rate: 2, duration: 60 });
    expect(times[300]!).toBeCloseTo((300 * FRAME_MS * 2) / 1000, 0);
  });

  it("jumps with a seek", () => {
    const report = (ms: number) => (ms < 500 ? ms / 1000 : 30 + ms / 1000);
    const times = run(60, report);
    expect(times[60]!).toBeGreaterThan(30.9);
  });

  it("stands where the element says while paused, and never passes the end", () => {
    expect(
      stepPlayhead({ time: 3, at: 0 }, 12, 16, {
        playing: false,
        rate: 1,
        duration: 60,
      }).time,
    ).toBe(12);
    expect(
      stepPlayhead({ time: 9.99, at: 0 }, 9.99, 100, {
        playing: true,
        rate: 1,
        duration: 10,
      }).time,
    ).toBe(10);
  });
});
