// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import type { Eq } from "./eq.ts";
import { createEqChain, newAudioContext, type EqChain } from "./eqChain.ts";

// Monitoring: the microphone, through the EQ, into the headphones — so the
// EQ a take will start with can be set by ear before pressing Record.
//
// It opens only when someone presses Monitor in the EQ sheet, and closes
// when they press it again or the sheet closes. It keeps nothing: there is
// no recorder on this path, only the microphone, the filters and the
// output. It asks the device for what a take would ask for — voice
// processing on or off as the Quality sheet says — so it sounds like the
// take will.
//
// On speakers it would feed back, which is why the sheet says to use
// headphones before it starts. The browser's lowest output latency is asked
// for; what a device delivers varies, and a wireless headset adds its own.

export type MonitorState = "off" | "starting" | "on" | "denied" | "failed";

export type Monitor = {
  state: MonitorState;
  analyser: AnalyserNode | null;
  start: () => void;
  stop: () => void;
};

type Open = {
  ctx: AudioContext;
  stream: MediaStream;
  chain: EqChain;
};

export function useMonitor(eq: Eq | null, processing: boolean): Monitor {
  const [state, setState] = useState<MonitorState>("off");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const open = useRef<Open | null>(null);
  const eqRef = useRef(eq);
  eqRef.current = eq;
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current += 1;
    const o = open.current;
    open.current = null;
    setAnalyser(null);
    setState("off");
    if (!o) return;
    for (const track of o.stream.getTracks()) track.stop();
    o.chain.disconnect();
    void o.ctx.close().catch(() => {});
  }, []);

  const start = useCallback(() => {
    if (open.current) return;
    const media =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    // The context is made inside the press, so the browser lets it sound.
    const ctx = newAudioContext({ latencyHint: "interactive" });
    if (!ctx || !media?.getUserMedia) {
      void ctx?.close();
      setState("failed");
      return;
    }
    void ctx.resume();
    const mine = ++run.current;
    setState("starting");
    media
      .getUserMedia({
        audio: {
          echoCancellation: processing,
          noiseSuppression: processing,
          autoGainControl: processing,
        },
      })
      .then((stream) => {
        if (run.current !== mine) {
          for (const track of stream.getTracks()) track.stop();
          void ctx.close();
          return;
        }
        const chain = createEqChain(ctx, eqRef.current);
        ctx.createMediaStreamSource(stream).connect(chain.input);
        chain.output.connect(ctx.destination);
        open.current = { ctx, stream, chain };
        setAnalyser(chain.output);
        setState("on");
      })
      .catch((err: unknown) => {
        void ctx.close();
        if (run.current !== mine) return;
        const name = (err as { name?: string } | null)?.name;
        setState(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : "failed",
        );
      });
  }, [processing]);

  useEffect(() => {
    open.current?.chain.set(eq);
  }, [eq]);

  // Closed on leaving, whatever else happened.
  useEffect(() => stop, [stop]);

  return { state, analyser, start, stop };
}
