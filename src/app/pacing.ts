// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The capture's frames, paced to the display.
//
// The framework's capture hands its subscribers a frame on every animation
// frame, but what is *in* one only changes when the audio tap delivers a
// batch — 2048 samples, about 43 ms, so some 23 times a second. Drawn as it
// comes, the level bar steps at that rate while the wave above it slides at
// sixty, and the eye reads the meter as the one that stutters.
//
// So each batch is played out across the display frames until the next
// one: a frame reads the samples that "happened" since the last frame, and
// the bar is filled from the batch-long window that ends there. The picture
// runs one batch behind the microphone, which no one can see, and every
// frame shows something new. What a level *is* stays the framework's: the
// window is read by its `readFrame` and the bar is moved by its `stepMeter`,
// the same ballistics at a finer step. The clip lamp and the take's tallies
// are the capture's own, passed through untouched — a clip is counted once,
// where it was found, never again by a window sliding over it.
//
// Pure and clock-free: `now` comes in with each frame.

import {
  METER_REST,
  readFrame,
  stepMeter,
  type CaptureFrame,
  type FrameReading,
  type MeterState,
} from "@niclaslindstedt/oss-framework/audio";

/** How long a batch is taken to last before any have been timed, ms. */
const FIRST_INTERVAL_MS = 43;

/** The longest step taken as time passed, ms — a hidden tab resumes where
 *  it was rather than lurching. */
const MAX_STEP_MS = 100;

const SILENCE: FrameReading = {
  rmsDb: -Infinity,
  peakDb: -Infinity,
  clipped: false,
};

const EMPTY: Float32Array = new Float32Array(0);

export class FramePacer {
  /** The batch before the one being played out: the window reaches into
   *  it. */
  private prev: Float32Array | null = null;
  /** The batch being played out, and how much of it has been. */
  private cur: Float32Array | null = null;
  private cursor = 0;
  private arrivedAt = 0;
  /** How far apart batches arrive, ms, eased. */
  private interval = FIRST_INTERVAL_MS;
  private meter: MeterState = METER_REST;
  private lastAt: number | null = null;
  private lastElapsed = 0;
  private window: Float32Array = EMPTY;

  /** One display frame: the capture's frame, with the meter moved by the
   *  samples since the last one, and `samples` those samples alone. */
  step(frame: CaptureFrame, now: number): CaptureFrame {
    // A capture started over (a new take, Listening recycled) starts the
    // bar over too.
    if (frame.elapsedMs < this.lastElapsed) this.reset();
    this.lastElapsed = frame.elapsedMs;

    const dt =
      this.lastAt === null
        ? 0
        : Math.min(MAX_STEP_MS, Math.max(0, now - this.lastAt));
    this.lastAt = now;

    // What is left of the batch being played out goes into this frame when
    // the next one lands early, so no sample is skipped.
    let leftover = EMPTY;
    const batch = frame.samples;
    if (batch !== this.cur && batch.length > 0) {
      if (this.cur) {
        leftover = this.cur.subarray(this.cursor);
        const gap = now - this.arrivedAt;
        if (gap > 0)
          this.interval = clamp(this.interval * 0.8 + gap * 0.2, 8, 250);
      }
      this.prev = this.cur;
      this.cur = batch;
      this.cursor = 0;
      this.arrivedAt = now;
    }

    const cur = this.cur;
    if (!cur) return { ...frame, meter: this.carry(frame, SILENCE, dt) };

    const n = cur.length;
    const target = Math.min(
      n,
      Math.round((n * (now - this.arrivedAt)) / this.interval),
    );
    const head = cur.subarray(this.cursor, Math.max(this.cursor, target));
    this.cursor = Math.max(this.cursor, target);
    const fresh = leftover.length > 0 ? concat(leftover, head) : head;

    // The window: the last batch's worth of samples up to the cursor.
    if (this.window.length !== n) this.window = new Float32Array(n);
    const prev = this.prev;
    const fromPrev = prev ? Math.min(prev.length, n - this.cursor) : 0;
    if (prev && fromPrev > 0)
      this.window.set(prev.subarray(prev.length - fromPrev), 0);
    this.window.set(cur.subarray(0, this.cursor), fromPrev);
    const filled = fromPrev + this.cursor;

    const reading =
      fresh.length === 0 || filled === 0
        ? SILENCE
        : readFrame(this.window.subarray(0, filled));
    return { ...frame, meter: this.carry(frame, reading, dt), samples: fresh };
  }

  /** Move the bar and its peak mark; the lamp and the tallies are the
   *  capture's. */
  private carry(
    frame: CaptureFrame,
    reading: FrameReading,
    dt: number,
  ): MeterState {
    const moved = stepMeter(this.meter, reading, dt);
    this.meter = {
      ...moved,
      clipping: frame.meter.clipping,
      sinceClipMs: frame.meter.sinceClipMs,
      clipCount: frame.meter.clipCount,
      maxPeakDb: frame.meter.maxPeakDb,
    };
    return this.meter;
  }

  private reset() {
    this.prev = null;
    this.cur = null;
    this.cursor = 0;
    this.interval = FIRST_INTERVAL_MS;
    this.meter = METER_REST;
    this.lastAt = null;
  }
}

type Subscribe = (listener: (frame: CaptureFrame) => void) => () => void;

/** A capture's `subscribe`, paced: each subscriber gets frames from its own
 *  {@link FramePacer}. */
export function paced(subscribe: Subscribe): Subscribe {
  return (listener) => {
    const pacer = new FramePacer();
    return subscribe((frame) => listener(pacer.step(frame, clock())));
  };
}

function clock(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function concat(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** The running thumbnail's first bucket, ms, and how many it keeps before
 *  it halves them — the framework's capture defaults (`RunningPeaks` at a
 *  twentieth of a second, `thumbnail: 200`). */
const THUMB_FIRST_MS = 50;
const THUMB_COUNT = 200;

/** How much of the take's width each of the thumbnail's `count` buckets
 *  stands for, 0…1, after `elapsedMs`. Drawn this way the picture of the
 *  whole take narrows smoothly as it grows — the newest bucket, still
 *  filling, only as wide as the time it holds — instead of every bar
 *  jumping sideways when a bucket closes. Where the count does not fit the
 *  thumbnail's arithmetic (another framework's defaults) the buckets share
 *  the width equally, as the framework's own `Waveform` draws them. */
export function bucketShare(elapsedMs: number, count: number): number {
  if (count <= 0) return 1;
  if (!(elapsedMs > 0)) return 1 / count;
  let bucket = THUMB_FIRST_MS;
  while (elapsedMs / bucket >= THUMB_COUNT) bucket *= 2;
  const buckets = elapsedMs / bucket;
  return buckets > count - 1.5 && buckets <= count + 0.5
    ? bucket / elapsedMs
    : 1 / count;
}
