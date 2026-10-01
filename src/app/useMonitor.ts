// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import type { Eq } from "./eq.ts";
import { createEqChain, newAudioContext, type EqChain } from "./eqChain.ts";
import { HowlDetector } from "./howl.ts";

// Monitoring: the microphone, through the EQ, into the headphones — so the
// EQ a take will start with can be set by ear before pressing Record.
//
// It opens only when someone presses Monitor — in the EQ sheet, or the
// headphones glyph while Listening and Recording — and closes when they
// press it again or the Record screen has no microphone open for it to sit
// beside. It is a stream of its own, never the capture's. It keeps nothing: there is
// no recorder on this path, only the microphone, the filters and the
// output. It asks the device for what a take would ask for — voice
// processing on or off as the Quality sheet says — so it sounds like the
// take will.
//
// On speakers it would feed back, which is why the sheet says to use
// headphones before it starts — and why it does not trust that they were
// put on. What it sends out is listened to twenty times a second for the
// one steady, piercing tone a loop rings at (`howl.ts`); the moment that is
// heard the output is cut and the monitor stops, saying why. It fades in
// over a moment rather than starting at full level, so a loop has to build
// where the guard can hear it, and it stops when the app goes to the
// background, where nobody is watching it. The browser's lowest output
// latency is asked for; what a device delivers varies, and a wireless
// headset adds its own.

export type MonitorState =
  | "off"
  | "starting"
  | "on"
  | "denied"
  | "failed"
  /** It heard itself, and stopped. */
  | "feedback";

/** How long the monitor takes to reach full level, s. */
const FADE_IN_S = 0.4;

/** How often the guard listens, ms. */
const GUARD_MS = 50;

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
  out: GainNode;
  guard: ReturnType<typeof setInterval>;
};

export function useMonitor(eq: Eq | null, processing: boolean): Monitor {
  const [state, setState] = useState<MonitorState>("off");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const open = useRef<Open | null>(null);
  const eqRef = useRef(eq);
  eqRef.current = eq;
  const run = useRef(0);

  const stop = useCallback((why: "off" | "feedback" = "off") => {
    run.current += 1;
    const o = open.current;
    open.current = null;
    setAnalyser(null);
    setState(why);
    if (!o) return;
    // Silence first, at once; then let go of everything.
    o.out.gain.cancelScheduledValues(o.ctx.currentTime);
    o.out.gain.setValueAtTime(0, o.ctx.currentTime);
    clearInterval(o.guard);
    for (const track of o.stream.getTracks()) track.stop();
    o.chain.disconnect();
    o.out.disconnect();
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
        const out = ctx.createGain();
        out.gain.setValueAtTime(0, ctx.currentTime);
        out.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN_S);
        ctx.createMediaStreamSource(stream).connect(chain.input);
        chain.output.connect(out);
        out.connect(ctx.destination);

        const howl = new HowlDetector();
        const spectrum = new Float32Array(chain.output.frequencyBinCount);
        let last = performance.now();
        const guard = setInterval(() => {
          const now = performance.now();
          chain.output.getFloatFrequencyData(spectrum);
          if (howl.step(spectrum, ctx.sampleRate, now - last)) stop("feedback");
          last = now;
        }, GUARD_MS);

        open.current = { ctx, stream, chain, out, guard };
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
  }, [processing, stop]);

  useEffect(() => {
    open.current?.chain.set(eq);
  }, [eq]);

  // Not left running where nobody can hear what it is doing.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onHidden = () => {
      if (document.hidden && open.current) stop();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [stop]);

  // Closed on leaving, whatever else happened.
  useEffect(() => () => stop(), [stop]);

  const stopOff = useCallback(() => stop(), [stop]);
  return { state, analyser, start, stop: stopOff };
}
