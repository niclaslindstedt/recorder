// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The player's playhead, as a clock that runs smoothly.
//
// An audio element's `currentTime` is not a smooth clock: browsers advance
// it in steps (a decoded chunk, an output buffer — tens of milliseconds, and
// unevenly), so a playhead drawn from it holds still for a frame or two and
// then jumps. Over silence nobody sees it; over the tall bars of a voice,
// where the played colour sweeps across, it reads as the line catching on
// the sound.
//
// So the line runs on its own clock at the playback rate, anchored to the
// element: each frame it moves by the time that passed, and is drawn a
// little toward what the element says — enough to stay on it, never enough
// to step. A seek, a stall or a skip (the two disagreeing by more than a
// glance) puts it straight back on the element.
//
// Pure and clock-free: `now` comes in with each step.

/** Where the clock stood, and when. */
export type Playhead = {
  /** Seconds into the recording. */
  time: number;
  /** When that was, ms, on any monotonic clock. */
  at: number;
};

/** A disagreement this large is a seek or a stall, not jitter: jump. */
export const SNAP_SECONDS = 0.25;

/** How much of the disagreement is taken up per frame. */
const PULL = 0.1;

/** One frame of the playhead. `reported` is the element's own time. */
export function stepPlayhead(
  prev: Playhead | null,
  reported: number,
  now: number,
  options: { playing: boolean; rate: number; duration: number },
): Playhead {
  const { playing, rate, duration } = options;
  const clamp = (t: number) =>
    Math.max(0, duration > 0 ? Math.min(duration, t) : t);
  if (!playing || !prev) return { time: clamp(reported), at: now };
  const ran = prev.time + (Math.max(0, now - prev.at) / 1000) * rate;
  const off = reported - ran;
  if (Math.abs(off) > SNAP_SECONDS * Math.max(1, rate))
    return { time: clamp(reported), at: now };
  // Forward only while playing: the pull never walks the line back.
  return { time: clamp(Math.max(prev.time, ran + off * PULL)), at: now };
}
