// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The sound trigger: which stretches of a take the gate keeps, how the rest
// is cut or silenced, and what the take says about itself afterwards.
import { describe, expect, it } from "vitest";

import type { Pcm } from "@niclaslindstedt/oss-framework/audio";

import {
  GATE_REST,
  GATE_WINDOW,
  applyGate,
  clampGateDb,
  gateKept,
  gateOpen,
  gateStretches,
  gateTake,
  gateTimesIn,
  readGated,
  stepGate,
} from "../src/app/gate.ts";
import { finishTake, gateCapture, type Trigger } from "../src/app/takes.ts";
import { DEFAULT_SETTINGS, parseSettings } from "../src/app/useAppSettings.ts";
import { ctx } from "./fixtures/helpers.ts";

const RATE = 48_000;

/** A take of `seconds`, silent but for a 440 Hz tone at `amplitude` over
 *  each `[from, to)` second range. */
function take(
  seconds: number,
  tones: Array<[number, number]>,
  amplitude = 0.5,
): Pcm {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (const [from, to] of tones) {
    for (let i = Math.round(from * RATE); i < Math.round(to * RATE); i++) {
      samples[i] = amplitude * Math.sin((2 * Math.PI * 440 * i) / RATE);
    }
  }
  return { sampleRate: RATE, channels: [samples] };
}

const times = { thresholdDb: -40, pre: 2, hold: 5 };

describe("the gate, a window at a time", () => {
  it("stays shut under the trigger", () => {
    const state = stepGate(GATE_REST, 0, 10, -50, times);
    expect(state).toBe(GATE_REST);
    expect(gateOpen(state, 10)).toBe(false);
    expect(gateKept(state, 10)).toBe(0);
  });

  it("opens the pre-roll before the crossing and holds after the last window over", () => {
    let state = stepGate(GATE_REST, 10, 20, -30, times);
    expect(state.from).toBe(8);
    expect(state.closeAt).toBe(25);
    expect(gateOpen(state, 24)).toBe(true);
    expect(gateOpen(state, 25)).toBe(false);
    // Kept so far counts only what has been heard.
    expect(gateKept(state, 20)).toBe(12);
    expect(gateKept(state, 40)).toBe(17);
    // Quiet windows do not move it.
    state = stepGate(state, 20, 30, -60, times);
    expect(gateStretches(state, 100)).toEqual([[8, 25]]);
  });

  it("carries a stretch on while the sound returns within the hold, or the pre-roll bridges the gap", () => {
    let state = stepGate(GATE_REST, 10, 20, -30, times); // 8 … 25
    state = stepGate(state, 22, 24, -30, times); // within the hold
    expect(state.closeAt).toBe(29);
    state = stepGate(state, 31, 32, -30, times); // 31 − 2 = 29 bridges
    expect(gateStretches(state, 100)).toEqual([[8, 37]]);
  });

  it("starts a new stretch past a gap neither bridges", () => {
    let state = stepGate(GATE_REST, 10, 20, -30, times); // 8 … 25
    state = stepGate(state, 40, 41, -30, times);
    expect(gateStretches(state, 100)).toEqual([
      [8, 25],
      [38, 46],
    ]);
    expect(gateKept(state, 100)).toBe(17 + 8);
  });

  it("holds every stretch inside the take", () => {
    let state = stepGate(GATE_REST, 0, 10, -30, times);
    state = stepGate(state, 90, 100, -30, times);
    expect(gateStretches(state, 100)).toEqual([
      [0, 15],
      [88, 100],
    ]);
  });

  it("opens at the trigger exactly", () => {
    expect(stepGate(GATE_REST, 0, 1, -40, times).from).toBe(0);
    expect(stepGate(GATE_REST, 0, 1, -40.1, times).from).toBeNull();
  });

  it("holds the trigger level to its range, in whole decibels", () => {
    expect(clampGateDb(-38.6)).toBe(-39);
    expect(clampGateDb(-90)).toBe(-60);
    expect(clampGateDb(0)).toBe(-10);
    expect(clampGateDb("loud")).toBe(-40);
  });
});

describe("a take through the gate", () => {
  const trigger = { thresholdDb: -40, preMs: 500, holdMs: 2000 };

  it("keeps half a second before a word and two seconds after it", () => {
    // Ten seconds; a word from 3 s to 4 s.
    const pcm = take(10, [[3, 4]]);
    const [stretch, ...rest] = gateTake(pcm, gateTimesIn(RATE, trigger));
    expect(rest).toEqual([]);
    const [from, to] = stretch!;
    // Windows are 2048 samples (≈ 43 ms): the edges land within one of
    // 2.5 s and 6 s.
    expect(Math.abs(from / RATE - 2.5)).toBeLessThan(GATE_WINDOW / RATE);
    expect(Math.abs(to / RATE - 6)).toBeLessThan(GATE_WINDOW / RATE);
  });

  it("keeps nothing from a room under the trigger", () => {
    // −46 dBFS RMS: a 0.007 sine.
    const pcm = take(5, [[0, 5]], 0.007);
    expect(gateTake(pcm, gateTimesIn(RATE, trigger))).toEqual([]);
  });

  it("joins two words closer than the hold, and parts two further apart", () => {
    const close = take(20, [
      [2, 3],
      [4.5, 5],
    ]);
    expect(gateTake(close, gateTimesIn(RATE, trigger))).toHaveLength(1);
    const apart = take(20, [
      [2, 3],
      [10, 11],
    ]);
    expect(gateTake(apart, gateTimesIn(RATE, trigger))).toHaveLength(2);
  });

  it("cuts the quiet out, or keeps it as silence and the take's length", () => {
    const pcm = take(1, []);
    pcm.channels[0]!.fill(0.5);
    const stretches: Array<[number, number]> = [
      [1000, 3000],
      [10_000, 11_000],
    ];
    const cut = applyGate(pcm, stretches, "cut");
    expect(cut.channels[0]!.length).toBe(3000);
    const silence = applyGate(pcm, stretches, "silence");
    expect(silence.channels[0]!.length).toBe(RATE);
    expect(silence.channels[0]![500]).toBe(0);
    expect(silence.channels[0]![2000]).toBe(0.5);
    expect(silence.channels[0]![5000]).toBe(0);
  });

  it("fades each stretch in and out so a cut does not click", () => {
    const pcm = take(1, []);
    pcm.channels[0]!.fill(0.5);
    const cut = applyGate(pcm, [[0, 4800]], "cut").channels[0]!;
    const fade = RATE * 0.01;
    expect(cut[0]).toBe(0);
    expect(cut[fade / 2]).toBeCloseTo(0.25, 5);
    expect(cut[fade]).toBe(0.5);
    expect(cut[4799]).toBe(0);
  });

  it("re-reads the peak and the clips from what was kept", () => {
    const pcm = take(1, [[0, 1]], 0.25);
    pcm.channels[0]!.fill(1, 100, 110); // ten samples flat at full scale
    const read = readGated(pcm);
    expect(read.maxPeakDb).toBeCloseTo(0, 5);
    expect(read.clipCount).toBe(1);
    expect(readGated(take(1, [[0, 1]], 0.25)).clipCount).toBe(0);
  });
});

describe("a gated take, finished", () => {
  const capture = (pcm: Pcm) => ({
    mode: "pcm" as const,
    blob: new Blob([]),
    mimeType: "",
    pcm,
    durationMs: (pcm.channels[0]!.length / RATE) * 1000,
    sampleRate: RATE,
    channels: 1,
    peaks: [0.5],
    clipCount: 0,
    maxPeakDb: -6,
  });
  const trigger: Trigger = {
    thresholdDb: -40,
    preMs: 500,
    holdMs: 1000,
    quiet: "cut",
  };

  it("is only the sound, cut, and saves as FLAC when lossless", async () => {
    const gated = await gateCapture(capture(take(30, [[10, 12]])), trigger, {
      kind: "lossless",
      bitrate: 128,
    });
    expect(gated).not.toBeNull();
    // 0.5 s before, 2 s of sound, 1 s after.
    expect(gated!.durationMs).toBeGreaterThan(3400);
    expect(gated!.durationMs).toBeLessThan(3600);
    expect(gated!.peaks.length).toBeGreaterThan(50);
    const { recording } = finishTake(gated!, {
      title: "Night shift",
      folderId: null,
      ctx: ctx(),
    });
    expect(recording.kind).toBe("lossless");
    expect(recording.mimeType).toBe("audio/flac");
    expect(recording.durationMs).toBe(Math.round(gated!.durationMs));
  });

  it("keeps the take's length when the quiet is kept as silence", async () => {
    const gated = await gateCapture(
      capture(take(30, [[10, 12]])),
      { ...trigger, quiet: "silence" },
      { kind: "lossless", bitrate: 128 },
    );
    expect(gated!.durationMs).toBe(30_000);
    expect(gated!.pcm!.channels[0]![RATE]).toBe(0);
  });

  it("is MP3 at the take's bitrate when compact", async () => {
    const gated = await gateCapture(capture(take(10, [[2, 4]])), trigger, {
      kind: "compact",
      bitrate: 128,
    });
    expect(gated!.mode).toBe("encoded");
    expect(gated!.mimeType).toBe("audio/mpeg");
    expect(gated!.pcm).toBeNull();
    // ≈ 3.5 s at 128 kbit/s: about 56 kB.
    expect(gated!.blob.size).toBeGreaterThan(45_000);
    expect(gated!.blob.size).toBeLessThan(70_000);
    const { recording } = finishTake(gated!, {
      title: "Hallway",
      folderId: null,
      ctx: ctx(),
    });
    expect(recording.kind).toBe("compact");
    expect(recording.fileName).toBe("id1.mp3");
  });

  it("is nothing at all when nothing reached the trigger", async () => {
    expect(
      await gateCapture(capture(take(5, [])), trigger, {
        kind: "compact",
        bitrate: 128,
      }),
    ).toBeNull();
  });
});

describe("the trigger's settings", () => {
  it("is off, at −40 dB, holding two seconds and keeping half a second before", () => {
    expect(DEFAULT_SETTINGS.gate).toBe(false);
    expect(DEFAULT_SETTINGS.gateDb).toBe(-40);
    expect(DEFAULT_SETTINGS.gateHoldMs).toBe(2000);
    expect(DEFAULT_SETTINGS.gatePreMs).toBe(500);
    expect(DEFAULT_SETTINGS.gateQuiet).toBe("cut");
  });

  it("clamps what was stored", () => {
    const s = parseSettings(
      JSON.stringify({
        gate: true,
        gateDb: -3,
        gateHoldMs: 7,
        gatePreMs: 1000,
        gateQuiet: "silence",
      }),
    );
    expect(s.gate).toBe(true);
    expect(s.gateDb).toBe(-10);
    expect(s.gateHoldMs).toBe(2000);
    expect(s.gatePreMs).toBe(1000);
    expect(s.gateQuiet).toBe("silence");
    expect(parseSettings(JSON.stringify({ gateQuiet: "x" })).gateQuiet).toBe(
      "cut",
    );
  });
});
