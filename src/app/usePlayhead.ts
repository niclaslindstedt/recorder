// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The playhead's time for a player, run smoothly on every frame
// (`playhead.ts`) rather than read off the element's stepping
// `currentTime` — the player's line and Review's listen-back both draw it.
import { useEffect, useRef, useState } from "react";

import type { Player } from "@niclaslindstedt/oss-framework/audio";

import { stepPlayhead, type Playhead } from "./playhead.ts";

/** Seconds into the recording, for drawing the line and the time beside it. */
export function usePlayhead(player: Player, duration: number): number {
  const latest = useRef(player);
  latest.current = player;
  const head = useRef<Playhead | null>(null);
  const [time, setTime] = useState(player.time);
  const { playing, rate } = player;

  // Paused, the line stands where the element says — a seek lands at once.
  useEffect(() => {
    if (playing) return;
    head.current = null;
    setTime(player.time);
  }, [playing, player.time]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = (now: number) => {
      head.current = stepPlayhead(head.current, latest.current.time, now, {
        playing: true,
        rate,
        duration,
      });
      setTime(head.current.time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, rate, duration]);

  return time;
}
