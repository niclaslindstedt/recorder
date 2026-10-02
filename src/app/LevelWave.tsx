// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef } from "react";

import { meterFill, toDb } from "@niclaslindstedt/oss-framework/audio";

import { drawWaveBackdrop, palette, targetColor, useCanvas } from "./canvas.ts";
import { formatTargetDb, targetTone, type TargetRange } from "./target.ts";
import { waveMarks, type AxisMark } from "./waveAxis.ts";

// A take's shape, the way the Record screen's live waveform draws one
// (docs/design.md, "Review" and "The player"): on the meter's decibel scale,
// mirrored, with the target shaded across it and every bar wearing where
// its peak landed — grey under the range, the accent in it, amber over it,
// red when hot — and the decibels up the side. So "did I get it?" is read
// off the shape before a note is heard, the same way it was read while
// recording.
//
// It is also the playhead's track: a slider, with what is still to play
// dimmed once playing has started. The pointer and the keys are the
// framework's `Waveform`'s, whose plain thumbnail is still what a row in the
// list draws.
//
// The thumbnail keeps each bucket's peak and not whether it clipped, so a
// bar is red by its height — the framework's hot zone — and the take's own
// clip count stays the chip's to tell.

type Props = {
  peaks: readonly number[];
  target: TargetRange;
  /** The playhead, 0…1 of the length. */
  progress: number;
  /** Make it a slider. Called with 0…1. */
  onSeek?: (share: number) => void;
  label: string;
  /** How far one arrow-key press moves, as a share. */
  step?: number;
};

export function LevelWave({
  peaks,
  target,
  progress,
  onSeek,
  label,
  step = 0.02,
}: Props) {
  const { box, canvas, size } = useCanvas();
  const { lowDb, highDb } = target;
  const marks = useMemo(
    () => waveMarks({ lowDb, highDb }, size.height / 2),
    [lowDb, highDb, size.height],
  );

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.width;
    const h = el.height;
    const mid = h / 2;
    const colours = palette(el);
    const range = { lowDb, highDb };
    ctx.clearRect(0, 0, w, h);
    drawWaveBackdrop(ctx, { w, h, dpr }, range, marks, colours);
    const n = peaks.length;
    if (n === 0) return;
    const pitch = w / n;
    // Bars with a gap while there is room for one; a solid shape once there
    // is not.
    const bar = pitch >= 3 * dpr ? pitch * 0.7 : pitch;
    const inset = (pitch - bar) / 2;
    for (let i = 0; i < n; i++) {
      const peak = Math.min(1, Math.max(0, peaks[i]!));
      const db = toDb(peak);
      const half = Math.max(dpr / 2, meterFill(db) * mid);
      ctx.fillStyle = targetColor(targetTone(db, false, range), colours);
      ctx.fillRect(i * pitch + inset, mid - half, bar, half * 2);
    }
  }, [peaks, size, canvas, lowDb, highDb, marks]);

  const dragging = useRef(false);
  const shareAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const at = Math.max(0, Math.min(1, progress));
  const keys: Record<string, () => number> = {
    ArrowRight: () => Math.min(1, at + step),
    ArrowUp: () => Math.min(1, at + step),
    ArrowLeft: () => Math.max(0, at - step),
    ArrowDown: () => Math.max(0, at - step),
    Home: () => 0,
    End: () => 1,
  };
  const interactive = Boolean(onSeek);

  return (
    <div className="flex h-full w-full">
      <WaveScale marks={marks} />
      <div
        ref={box}
        role={interactive ? "slider" : "img"}
        aria-label={label}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? 100 : undefined}
        aria-valuenow={interactive ? Math.round(at * 100) : undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={(e) => {
          if (!onSeek) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          onSeek(shareAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (onSeek && dragging.current) onSeek(shareAt(e.clientX));
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // Already released.
          }
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={(e) => {
          const to = onSeek ? keys[e.key] : undefined;
          if (!to) return;
          e.preventDefault();
          onSeek!(to());
        }}
        className={`relative h-full min-w-0 flex-1 outline-offset-2 ${
          interactive ? "cursor-pointer touch-none" : ""
        }`}
      >
        <canvas
          ref={canvas}
          aria-hidden
          className="absolute inset-0 h-full w-full"
        />
        {/* What is still to play, dimmed once playing has started; the
          ground's own colour over it, so the band dims with the bars. */}
        {at > 0 && at < 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 bg-surface-2 opacity-55"
            style={{ left: `${at * 100}%` }}
          />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-fg-bright"
          style={{ left: `${at * 100}%` }}
        />
      </div>
    </div>
  );
}

/** The decibels in a gutter beside a waveform, each level with its line on
 *  the top half, the target's two edges brighter than the scale. A gutter
 *  rather than over the picture, so no bar ever runs through a figure. */
export function WaveScale({ marks }: { marks: readonly AxisMark[] }) {
  return (
    <div aria-hidden className="relative w-6 shrink-0">
      {marks.map((m) => (
        <span
          key={m.db}
          className={`absolute right-1 -translate-y-1/2 font-figures text-[9px] leading-none ${
            m.edge ? "text-fg" : "text-muted"
          }`}
          style={{ top: `${50 - m.at * 50}%` }}
        >
          {formatTargetDb(m.db)}
        </span>
      ))}
    </div>
  );
}
