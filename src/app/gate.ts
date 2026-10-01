// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The sound trigger: a take that records only while there is something to
// hear (docs/features/record.md, "Sound trigger"). Voice-operated recording,
// as a dictaphone calls it; voice activity, as a call app does.
//
// It is a gate. The level is read a window at a time, on the same scale as
// the meter's bar (a window's RMS, dBFS). A window at or over the trigger
// level opens it; it stays open for `holdMs` after the last window over,
// and it opens `preMs` *before* the window that crossed, so the first
// syllable is in the take rather than cut in half. What it kept is a list
// of stretches; what happens to the rest is the reader's choice — cut out,
// so the file is only the sound, or turned to silence, so the file keeps
// the take's length and lines up with a video shot at the same time.
//
// One state machine, `stepGate`, read in two places so they never
// disagree: the Record screen's live "Waiting / Recording" (fed the tap's
// batches as they arrive, in ms), and the take itself at Stop (fed the
// samples, in samples). It is unit-free: the times in and the times out are
// in whatever unit the caller counts in. Pure and clock-free.
//
// What a level in dBFS is stays the framework's (`readFrame`); this module
// only decides which stretches to keep. A gate that ran as the capture
// does — holding only the pre-roll, never the quiet — is a candidate for
// the framework's `audio` module; today the take is gated once it stops.

import {
  readFrame,
  toDb,
  type Pcm,
} from "@niclaslindstedt/oss-framework/audio";

/** What becomes of the stretches the gate did not keep. */
export type GateQuiet = "cut" | "silence";
export const GATE_QUIETS: GateQuiet[] = ["cut", "silence"];

/** The trigger level's range, dBFS, and its default. The floor is the
 *  meter's own −60; the ceiling leaves a loud voice able to open it. */
export const GATE_MIN_DB = -60;
export const GATE_MAX_DB = -10;
export const DEFAULT_GATE_DB = -40;

/** How long the gate stays open after the sound drops under the trigger. */
export const GATE_HOLDS_MS = [500, 1000, 2000, 3000, 5000, 10_000] as const;
export type GateHoldMs = (typeof GATE_HOLDS_MS)[number];
export const DEFAULT_GATE_HOLD_MS: GateHoldMs = 2000;

/** How much from before the sound crossed is kept — the buffer the take
 *  reaches back into. */
export const GATE_PRES_MS = [0, 250, 500, 1000, 2000] as const;
export type GatePreMs = (typeof GATE_PRES_MS)[number];
export const DEFAULT_GATE_PRE_MS: GatePreMs = 500;

/** The window the level is read over, samples: the size of the batches the
 *  framework's tap hands over, so the take's windows are the batches the
 *  screen saw. */
export const GATE_WINDOW = 2048;

/** The ramp at each end of a kept stretch, seconds — long enough that a cut
 *  does not click, short enough to be inside the pre-roll and the hold. */
export const GATE_FADE_S = 0.01;

/** The trigger as the gate reads it, in the caller's unit of time. */
export type GateTimes = {
  thresholdDb: number;
  /** How far back a crossing reaches. */
  pre: number;
  /** How long after the last window over the gate stays open. */
  hold: number;
};

export type GateState = {
  /** The stretches already closed, `[from, to)`, in order and apart. */
  kept: Array<[number, number]>;
  /** Where the stretch in progress began, or `null` with none. */
  from: number | null;
  /** When it closes unless the sound crosses again. */
  closeAt: number;
};

export const GATE_REST: GateState = { kept: [], from: null, closeAt: 0 };

/** The trigger level, held to its range and to whole decibels. */
export function clampGateDb(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_GATE_DB;
  }
  return Math.min(GATE_MAX_DB, Math.max(GATE_MIN_DB, Math.round(value)));
}

/** Read one window `[from, to)` at `levelDb`. Under the trigger nothing
 *  changes — a stretch closes by its own `closeAt`, which is what lets the
 *  hold run on. Over it, the stretch in progress is carried on, or — past a
 *  gap the pre-roll does not bridge — closed and a new one begun. */
export function stepGate(
  state: GateState,
  from: number,
  to: number,
  levelDb: number,
  times: GateTimes,
): GateState {
  if (!(levelDb >= times.thresholdDb)) return state;
  const begin = Math.max(0, from - times.pre);
  const end = to + times.hold;
  if (state.from !== null && begin <= state.closeAt) {
    return { ...state, closeAt: Math.max(state.closeAt, end) };
  }
  const kept =
    state.from === null
      ? state.kept
      : [...state.kept, [state.from, state.closeAt] as [number, number]];
  return { kept, from: begin, closeAt: end };
}

/** Whether the gate is open at `at` — what the screen's "Recording" says. */
export function gateOpen(state: GateState, at: number): boolean {
  return state.from !== null && at < state.closeAt;
}

/** How much the gate has kept by `at`: the closed stretches, and the one in
 *  progress up to `at` (its hold has not been heard yet). */
export function gateKept(state: GateState, at: number): number {
  let total = 0;
  for (const [a, b] of state.kept) total += b - a;
  if (state.from !== null) {
    total += Math.max(0, Math.min(at, state.closeAt) - state.from);
  }
  return total;
}

/** The stretches kept once the take is `length` long: the one in progress
 *  closed, every stretch held inside the take, empty ones dropped. */
export function gateStretches(
  state: GateState,
  length: number,
): Array<[number, number]> {
  const all =
    state.from === null
      ? state.kept
      : [...state.kept, [state.from, state.closeAt] as [number, number]];
  const out: Array<[number, number]> = [];
  for (const [a, b] of all) {
    const from = Math.max(0, Math.min(length, a));
    const to = Math.max(0, Math.min(length, b));
    if (to > from) out.push([from, to]);
  }
  return out;
}

/** The trigger in samples, for a take at `sampleRate`. */
export function gateTimesIn(
  sampleRate: number,
  trigger: { thresholdDb: number; preMs: number; holdMs: number },
): GateTimes {
  return {
    thresholdDb: trigger.thresholdDb,
    pre: Math.round((trigger.preMs * sampleRate) / 1000),
    hold: Math.round((trigger.holdMs * sampleRate) / 1000),
  };
}

/** A window's level: the loudest channel's RMS, dBFS — the meter's bar. */
function windowDb(pcm: Pcm, from: number, to: number): number {
  let db = -Infinity;
  for (const channel of pcm.channels) {
    const reading = readFrame(channel.subarray(from, to));
    if (reading.rmsDb > db) db = reading.rmsDb;
  }
  return db;
}

function frames(pcm: Pcm): number {
  return pcm.channels[0]?.length ?? 0;
}

/** Which stretches of a take the gate keeps, in samples. */
export function gateTake(pcm: Pcm, times: GateTimes): Array<[number, number]> {
  const length = frames(pcm);
  let state = GATE_REST;
  for (let at = 0; at < length; at += GATE_WINDOW) {
    const to = Math.min(length, at + GATE_WINDOW);
    state = stepGate(state, at, to, windowDb(pcm, at, to), times);
  }
  return gateStretches(state, length);
}

/** The take with only the stretches kept: the rest cut out, or turned to
 *  silence so the take keeps its length. Each stretch is faded in and out
 *  over `GATE_FADE_S`, so the cuts do not click. */
export function applyGate(
  pcm: Pcm,
  stretches: ReadonlyArray<readonly [number, number]>,
  quiet: GateQuiet,
): Pcm {
  const length = frames(pcm);
  const keptLength = stretches.reduce((n, [a, b]) => n + (b - a), 0);
  const fade = Math.max(1, Math.round(pcm.sampleRate * GATE_FADE_S));
  const channels = pcm.channels.map((source) => {
    const out = new Float32Array(quiet === "cut" ? keptLength : length);
    let write = 0;
    for (const [from, to] of stretches) {
      const at = quiet === "cut" ? write : from;
      const span = to - from;
      out.set(source.subarray(from, to), at);
      const ramp = Math.min(fade, Math.floor(span / 2));
      for (let i = 0; i < ramp; i++) {
        const gain = i / ramp;
        out[at + i]! *= gain;
        out[at + span - 1 - i]! *= gain;
      }
      write += span;
    }
    return out;
  });
  return { sampleRate: pcm.sampleRate, channels };
}

/** What a gated take says about itself, re-read from what was kept: its
 *  loudest peak, and how many windows clipped. */
export function readGated(pcm: Pcm): { maxPeakDb: number; clipCount: number } {
  const length = frames(pcm);
  let peak = 0;
  let clipCount = 0;
  for (let at = 0; at < length; at += GATE_WINDOW) {
    const to = Math.min(length, at + GATE_WINDOW);
    let clipped = false;
    for (const channel of pcm.channels) {
      const reading = readFrame(channel.subarray(at, to));
      clipped ||= reading.clipped;
    }
    if (clipped) clipCount += 1;
  }
  for (const channel of pcm.channels) {
    for (let i = 0; i < channel.length; i++) {
      const a = Math.abs(channel[i]!);
      if (a > peak) peak = a;
    }
  }
  return { maxPeakDb: toDb(peak), clipCount };
}
