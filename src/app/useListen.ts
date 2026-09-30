// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  useRecorder,
  type CaptureFrame,
} from "@niclaslindstedt/oss-framework/audio";

import {
  pushReading,
  readAmbient,
  type Ambient,
  type Reading,
} from "./levels.ts";

// Listening: the microphone open, nothing kept (docs/design.md,
// "Listening: ambient mode").
//
// The framework has no listen-only capture, so this is a take that is never
// kept: the framework's own recorder, on the same capture path a real take
// uses — so the meter reads exactly what a take would get, voice processing
// included — cancelled on Stop and on unmount. The recorder holds what it
// hears in memory while it runs, so a long listen is started over every few
// minutes (a blink on the meter) and never holds more than that. Nothing is
// written anywhere, at any point.
//
// It opens only when asked: no listening at launch, no listening behind a
// setting.

/** How long one listening capture runs before it is started over. */
export const LISTEN_RECYCLE_MS = 5 * 60_000;

/** The encoder's rate while listening — the least a browser will take,
 *  since what it encodes is thrown away. */
const LISTEN_BITS_PER_SECOND = 32_000;

/** How often the readings are re-read into state for the numbers under the
 *  meter. The meter and the spectrum draw themselves off the frames. */
const READ_MS = 250;

export type Listen = {
  /** The microphone is open for listening (or opening). */
  on: boolean;
  starting: boolean;
  error: ReturnType<typeof useRecorder>["error"];
  ambient: Ambient | null;
  subscribe: ReturnType<typeof useRecorder>["subscribe"];
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export function useListen(processing: boolean, bands: number): Listen {
  const recorder = useRecorder(
    useMemo(
      () => ({
        mode: "encoded" as const,
        bitsPerSecond: LISTEN_BITS_PER_SECOND,
        processing,
        bands,
      }),
      [processing, bands],
    ),
  );
  const [wanted, setWanted] = useState(false);
  const [ambient, setAmbient] = useState<Ambient | null>(null);
  const readings = useRef<Reading[]>([]);

  useEffect(() => {
    let last = 0;
    return recorder.subscribe((frame: CaptureFrame) => {
      const at = performance.now();
      readings.current = pushReading(readings.current, {
        at,
        levelDb: frame.meter.levelDb,
        peakDb: frame.meter.peakDb,
        clipping: frame.meter.clipping,
      });
      if (at - last >= READ_MS) {
        last = at;
        setAmbient(readAmbient(readings.current));
      }
    });
  }, [recorder]);

  const start = useCallback(async () => {
    readings.current = [];
    setAmbient(null);
    setWanted(true);
    try {
      await recorder.start();
    } catch {
      // `recorder.error` says which; the screen prints it.
      setWanted(false);
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    setWanted(false);
    setAmbient(null);
    readings.current = [];
    await recorder.cancel();
  }, [recorder]);

  // Start over every few minutes, so what the recorder is holding never
  // grows past that; and start over when voice processing is switched, so
  // the meter reads what a take would.
  const { state, cancel, start: open } = recorder;
  useEffect(() => {
    if (!wanted || state !== "recording") return;
    const timer = setTimeout(() => {
      void cancel().then(() => open().catch(() => setWanted(false)));
    }, LISTEN_RECYCLE_MS);
    return () => clearTimeout(timer);
  }, [wanted, state, cancel, open]);

  const processingRef = useRef(processing);
  useEffect(() => {
    if (processingRef.current === processing) return;
    processingRef.current = processing;
    if (!wanted) return;
    void cancel().then(() => open().catch(() => setWanted(false)));
  }, [processing, wanted, cancel, open]);

  return {
    on: wanted,
    starting: state === "starting",
    error: recorder.error,
    ambient,
    subscribe: recorder.subscribe,
    start,
    stop,
  };
}
