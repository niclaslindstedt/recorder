// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  METER_REST,
  readFrame,
  stepMeter,
  type CaptureFrame,
  type MeterState,
} from "@niclaslindstedt/oss-framework/audio";

import { FramePacer, bucketShare } from "../src/app/pacing.ts";

const RATE = 48000;
const BATCH = 2048;
const BATCH_MS = (BATCH / RATE) * 1000;
const DISPLAY_MS = 1000 / 60;

/** A sine at `amp`, one batch long, starting at sample `from`. */
function tone(amp: (i: number) => number, from: number): Float32Array {
  const out = new Float32Array(BATCH);
  for (let i = 0; i < BATCH; i++) {
    const n = from + i;
    out[i] = amp(n) * Math.sin((2 * Math.PI * 440 * n) / RATE);
  }
  return out;
}

type Run = {
  /** Every frame handed to subscribers, and when. */
  frames: Array<{ at: number; frame: CaptureFrame }>;
  /** The capture's own meter at each batch, as the framework steps it. */
  raw: MeterState[];
  batches: Float32Array[];
};

/** Play a capture: batches every ~43 ms, a display frame every ~16.7 ms
 *  handing out whichever batch arrived last — what the framework's loop
 *  does. `meter` lets a test set what the capture's own tallies say. */
function capture(
  amp: (i: number) => number,
  ms: number,
  meter: (at: number, m: MeterState) => MeterState = (_, m) => m,
): Run {
  const frames: Run["frames"] = [];
  const raw: MeterState[] = [];
  const batches: Float32Array[] = [];
  let m = METER_REST;
  let latest: Float32Array = new Float32Array(0);
  let nextBatch = BATCH_MS;
  let samples = 0;
  for (let at = 0; at <= ms; at += DISPLAY_MS) {
    while (nextBatch <= at) {
      latest = tone(amp, samples);
      samples += BATCH;
      batches.push(latest);
      m = stepMeter(m, readFrame(latest), BATCH_MS);
      raw.push(m);
      nextBatch += BATCH_MS;
    }
    frames.push({
      at,
      frame: {
        meter: meter(at, m),
        bands: new Float32Array(0),
        peaks: [],
        elapsedMs: (samples / RATE) * 1000,
        samples: latest,
      },
    });
  }
  return { frames, raw, batches };
}

function play(run: Run, pacer = new FramePacer()) {
  return run.frames.map(({ at, frame }) => pacer.step(frame, at));
}

/** The largest change in the bar from one drawn frame to the next, dB. */
function largestStep(levels: number[]): number {
  let most = 0;
  for (let i = 1; i < levels.length; i++)
    most = Math.max(most, Math.abs(levels[i]! - levels[i - 1]!));
  return most;
}

describe("pacing the capture's frames to the display", () => {
  it("hands every sample out once, in order", () => {
    const run = capture(() => 0.5, 1000);
    const out = play(run);
    const handed = out.flatMap((f) => Array.from(f.samples));
    const heard = run.batches.flatMap((b) => Array.from(b));
    // The last batch may still be playing out when the run ends.
    expect(handed.length).toBeGreaterThan(heard.length - BATCH);
    expect(handed).toEqual(heard.slice(0, handed.length));
  });

  it("moves the bar on every frame a voice is swelling, in smaller steps", () => {
    // A swell from silence to loud across half a second.
    const swell = (n: number) => Math.min(1, n / (RATE / 2)) * 0.8;
    const run = capture(swell, 600);
    const paced = play(run).map((f) => f.meter.levelDb);
    const raw = run.frames.map((f) => f.frame.meter.levelDb);
    // Drawn as it comes the bar stands still on two frames of three and
    // jumps on the third; paced, it climbs a little on every one.
    const rising = paced.slice(10, 30);
    for (let i = 1; i < rising.length; i++)
      expect(rising[i]!).toBeGreaterThan(rising[i - 1]!);
    expect(largestStep(paced.slice(10))).toBeLessThan(
      largestStep(raw.slice(10)) * 0.6,
    );
  });

  it("reads a steady tone where the capture's own meter does", () => {
    const run = capture(() => 0.5, 1000);
    const paced = play(run);
    const last = paced[paced.length - 1]!.meter.levelDb;
    const own = run.raw[run.raw.length - 1]!.levelDb;
    expect(Math.abs(last - own)).toBeLessThan(0.5);
  });

  it("lets the bar fall when the batches stop, as on Pause", () => {
    const run = capture(() => 0.5, 500);
    const pacer = new FramePacer();
    const out = play(run, pacer);
    const before = out[out.length - 1]!;
    // Paused: the loop keeps handing out the last batch it had.
    let at = run.frames[run.frames.length - 1]!.at;
    const held = run.frames[run.frames.length - 1]!.frame;
    let after = before;
    for (let i = 0; i < 30; i++) {
      at += DISPLAY_MS;
      after = pacer.step(held, at);
    }
    expect(after.meter.levelDb).toBeLessThan(before.meter.levelDb - 20);
    expect(after.samples.length).toBe(0);
  });

  it("passes the capture's clip lamp and tallies through untouched", () => {
    const run = capture(
      () => 0.5,
      500,
      (at, m) => ({
        ...m,
        clipping: at > 200,
        clipCount: at > 200 ? 3 : 0,
        maxPeakDb: -1.5,
      }),
    );
    const out = play(run);
    const late = out[out.length - 1]!.meter;
    expect(late.clipping).toBe(true);
    expect(late.clipCount).toBe(3);
    expect(late.maxPeakDb).toBe(-1.5);
    expect(out[3]!.meter.clipCount).toBe(0);
  });

  it("starts the bar over when a new capture starts", () => {
    const pacer = new FramePacer();
    const loud = capture(() => 0.9, 500);
    play(loud, pacer);
    const quiet = capture(() => 0.001, 100);
    const first = quiet.frames.find((f) => f.frame.samples.length > 0)!;
    const out = pacer.step(first.frame, 10_000 + first.at);
    expect(out.meter.levelDb).toBeLessThan(-40);
  });
});

describe("the take's overview, drawn to time", () => {
  it("gives a bucket the share of the take it holds", () => {
    // 1.23 s at 50 ms buckets: 24 closed and one filling.
    expect(bucketShare(1230, 25)).toBeCloseTo(50 / 1230);
    // Past ten seconds the buckets are 100 ms.
    expect(bucketShare(12_340, 124)).toBeCloseTo(100 / 12_340);
    // An hour in: 3600 s / 25.6 s buckets.
    expect(bucketShare(3_600_000, 141)).toBeCloseTo(25_600 / 3_600_000);
  });

  it("narrows smoothly as the take grows", () => {
    let last = Infinity;
    for (let ms = 60; ms < 30_000; ms += 17) {
      let b = 50;
      while (ms / b >= 200) b *= 2;
      const count = Math.ceil(ms / b);
      const share = bucketShare(ms, count);
      // The closed buckets fit; the filling one reaches the edge or, just
      // opened, a little past it (drawn cut at the edge).
      expect(share * count).toBeGreaterThan(0.99);
      expect(share * (count - 1)).toBeLessThanOrEqual(1 + 1e-9);
      // The whole take's width per millisecond never jumps up.
      const perMs = share / b;
      expect(perMs).toBeLessThanOrEqual(last + 1e-12);
      last = perMs;
    }
  });

  it("falls back to equal shares when the count does not fit", () => {
    expect(bucketShare(1000, 7)).toBeCloseTo(1 / 7);
    expect(bucketShare(0, 4)).toBeCloseTo(1 / 4);
    expect(bucketShare(500, 0)).toBe(1);
  });
});
