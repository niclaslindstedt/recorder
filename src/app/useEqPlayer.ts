// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Player } from "@niclaslindstedt/oss-framework/audio";

import { isFlat, type Eq } from "./eq.ts";
import { createEqChain, newAudioContext, type EqChain } from "./eqChain.ts";

// A player that can be heard through an EQ.
//
// The framework's `usePlayer` keeps its audio element to itself, and an
// element's sound can only be routed through filters by the one who holds
// it, so the player and Review use this instead. It is the framework's
// player in shape — the same `Player` it hands back, the same element, the
// same pitch-keeping speed — with one difference: once an EQ is wanted, the
// element's sound is taken into an audio context and through `eqChain.ts`.
//
// That happens only when it is needed (an EQ that is not flat, or the EQ
// sheet opening) and only in answer to a press, because a browser starts an
// audio context silent unless someone just touched the page. A recording
// nobody equalises plays exactly as the framework's player would. Once taken
// in, the element stays in: a flat EQ is a chain that changes nothing.

export type EqPlayer = Player & {
  /** Take the sound through the EQ now — call it from a press, such as
   *  the one that opens the EQ sheet. */
  attachEq: () => void;
  /** The analyser at the chain's end, once attached. */
  analyser: AnalyserNode | null;
};

type Graph = { ctx: AudioContext; chain: EqChain };

export function useEqPlayer(
  source: Blob | string | null,
  eq: Eq | null,
): EqPlayer {
  const audio = useRef<HTMLAudioElement | null>(null);
  const graph = useRef<Graph | null>(null);
  const eqRef = useRef(eq);
  eqRef.current = eq;
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);
  const raf = useRef(0);

  const element = useCallback(() => {
    if (audio.current) return audio.current;
    if (typeof Audio === "undefined") return null;
    const el = new Audio();
    el.preload = "metadata";
    audio.current = el;
    return el;
  }, []);

  const attachEq = useCallback(() => {
    if (graph.current) {
      if (graph.current.ctx.state === "suspended")
        void graph.current.ctx.resume();
      return;
    }
    const el = element();
    if (!el) return;
    const ctx = newAudioContext();
    if (!ctx) return;
    try {
      const src = ctx.createMediaElementSource(el);
      const chain = createEqChain(ctx, eqRef.current);
      src.connect(chain.input);
      chain.output.connect(ctx.destination);
      graph.current = { ctx, chain };
      setAnalyser(chain.output);
      void ctx.resume();
    } catch {
      // No routing here: the element plays as it is, without the EQ.
      void ctx.close();
    }
  }, [element]);

  useEffect(() => {
    graph.current?.chain.set(eq);
  }, [eq]);

  useEffect(() => {
    const el = element();
    if (!el) return;
    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
    };
    const onMeta = () => {
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      setLoading(false);
    };
    const onDuration = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onTime = () => setTime(el.currentTime);
    const onError = () => {
      setLoading(false);
      setError(el.error?.message || "The recording could not be played.");
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onDuration);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onDuration);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("error", onError);
      el.pause();
      el.removeAttribute("src");
      el.load();
      const g = graph.current;
      graph.current = null;
      if (g) {
        g.chain.disconnect();
        void g.ctx.close().catch(() => {});
      }
    };
  }, [element]);

  useEffect(() => {
    const el = element();
    if (!el) return;
    setTime(0);
    setDuration(0);
    setEnded(false);
    setError(null);
    setPlaying(false);
    if (!source) {
      el.pause();
      el.removeAttribute("src");
      el.load();
      return;
    }
    const url =
      typeof source === "string" ? source : URL.createObjectURL(source);
    setLoading(true);
    el.src = url;
    el.load();
    return () => {
      el.pause();
      if (typeof source !== "string") URL.revokeObjectURL(url);
    };
  }, [element, source]);

  useEffect(() => {
    const el = element();
    if (el) el.playbackRate = rate;
  }, [element, rate]);

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const el = audio.current;
      if (el) setTime(el.currentTime);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const play = useCallback(async () => {
    const el = element();
    if (!el) return;
    // A press is the moment an audio context may start, so it is taken
    // here when the EQ wants one.
    if (!isFlat(eqRef.current) || graph.current) attachEq();
    if (el.ended) el.currentTime = 0;
    try {
      await el.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [element, attachEq]);
  const pause = useCallback(() => element()?.pause(), [element]);
  const toggle = useCallback(async () => {
    const el = element();
    if (!el) return;
    if (el.paused) await play();
    else el.pause();
  }, [element, play]);
  const seek = useCallback(
    (seconds: number) => {
      const el = element();
      if (!el) return;
      const max = Number.isFinite(el.duration) ? el.duration : duration;
      const next = Math.max(0, Math.min(max || seconds, seconds));
      el.currentTime = next;
      setTime(next);
      setEnded(false);
    },
    [element, duration],
  );
  const skip = useCallback(
    (seconds: number) => seek((audio.current?.currentTime ?? 0) + seconds),
    [seek],
  );
  const setRate = useCallback((next: number) => setRateState(next), []);

  return useMemo(
    () => ({
      playing,
      time,
      duration,
      ended,
      loading,
      error,
      rate,
      play,
      pause,
      toggle,
      seek,
      skip,
      setRate,
      attachEq,
      analyser,
    }),
    [
      playing,
      time,
      duration,
      ended,
      loading,
      error,
      rate,
      play,
      pause,
      toggle,
      seek,
      skip,
      setRate,
      attachEq,
      analyser,
    ],
  );
}
