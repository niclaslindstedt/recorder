// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import {
  readFrame,
  type CaptureFrame,
} from "@niclaslindstedt/oss-framework/audio";

import { GATE_REST, gateKept, gateOpen, stepGate } from "./gate.ts";

// The sound trigger as the Record screen shows it while a take runs: is the
// gate open now ("Hearing sound") or waiting, and how much it has kept.
// The same state machine the take is gated by at Stop (`gate.ts`), fed the
// tap's batches as the frames carry them, in ms. It is what the screen
// says, not what is kept: a frame the browser skipped (a hidden tab) is
// read at the next one's level, and the take is gated from every sample.

/** How often the kept time is re-read into state, ms of take. */
const READ_MS = 100;

export type GateLive = { open: boolean; keptMs: number };

const SHUT: GateLive = { open: false, keptMs: 0 };

export function useGateLive(
  subscribe: (listener: (frame: CaptureFrame) => void) => () => void,
  on: boolean,
  trigger: { thresholdDb: number; preMs: number; holdMs: number },
): GateLive {
  const [live, setLive] = useState<GateLive>(SHUT);
  const { thresholdDb, preMs, holdMs } = trigger;

  useEffect(() => {
    setLive(SHUT);
    if (!on) return;
    const times = { thresholdDb, pre: preMs, hold: holdMs };
    let state = GATE_REST;
    let lastBatch: Float32Array | null = null;
    let lastAt = 0;
    let shown = SHUT;
    return subscribe((frame) => {
      const at = frame.elapsedMs;
      if (frame.samples === lastBatch && at === lastAt) return;
      if (at < lastAt) state = GATE_REST; // a new take
      lastBatch = frame.samples;
      const from = at < lastAt ? 0 : lastAt;
      lastAt = at;
      if (at > from) {
        state = stepGate(
          state,
          from,
          at,
          readFrame(frame.samples).rmsDb,
          times,
        );
      }
      const next = { open: gateOpen(state, at), keptMs: gateKept(state, at) };
      if (
        next.open !== shown.open ||
        Math.abs(next.keptMs - shown.keptMs) >= READ_MS
      ) {
        shown = next;
        setLive(next);
      }
    });
  }, [subscribe, on, thresholdDb, preMs, holdMs]);

  return live;
}
