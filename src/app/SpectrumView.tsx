// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef } from "react";

import type { CaptureFrame } from "@niclaslindstedt/oss-framework/audio";

import { palette, targetColor, useCanvas } from "./canvas.ts";
import type { Eq } from "./eq.ts";
import { bandGains, carriers, levelShiftDb, shiftBar } from "./spectrumEq.ts";
import { formatTargetDb, targetTone, type TargetRange } from "./target.ts";
import { spectrumAt, spectrumMarks } from "./waveAxis.ts";

// The Record screen's spectrum (docs/design.md, "The visualizers"): how
// loud each frequency is now, bass on the left — and how it will sound.
//
// The microphone is captured as it is and the take's EQ applied when it is
// played or exported, so the frames' bars are the sound before the EQ. Each
// bar is drawn moved to where the EQ puts it (`spectrumEq.ts`): what the EQ
// adds is the bar carried on, paler; what it takes away is the bar that
// was, hollow — the EQ sheet's own picture of a boost and a cut. And the
// loud bars — those within a few dB of the loudest, the ones setting the
// level (`carriers`) — wear where the level *after* the EQ lands against
// the target, the waveform's and the meter's colours, while the quiet ones
// stay grey: so a boost that pushes a take over its target turns the bars
// that did it amber, and those are the ones to cut.
//
// The bars' heights are the framework's (`bandLevels`, smoothed in the
// capture); only their colour and the EQ's part are the app's, which is why
// they are drawn here rather than by the framework's `SpectrumBars`, as the
// spectrogram's are.

type Props = {
  subscribe: (listener: (frame: CaptureFrame) => void) => () => void;
  /** The frequency printed under a bar. */
  ticks: Array<{ band: number; label: string }>;
  bands: number;
  /** Each bar's lower edge, Hz, and the top edge last: the framework's
   *  layout (`layoutBands`). */
  edgesHz: readonly number[];
  /** The EQ the take is saved with — what it will sound like. */
  eq: Eq | null;
  target: TargetRange;
  label: string;
};

export function SpectrumView({
  subscribe,
  ticks,
  bands,
  edgesHz,
  eq,
  target,
  label,
}: Props) {
  const { box, canvas, size } = useCanvas();
  const marks = useMemo(() => spectrumMarks(size.height), [size.height]);
  const gains = useMemo(() => bandGains(eq, edgesHz), [eq, edgesHz]);
  const { lowDb, highDb } = target;
  // The last frame, so a resize or a new EQ redraws at once.
  const last = useRef<CaptureFrame | null>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const colours = palette(el);
    const fg = getComputedStyle(el).getPropertyValue("--fg").trim();
    const range = { lowDb, highDb };

    const draw = (frame: CaptureFrame | null) => {
      const w = el.width;
      const h = el.height;
      ctx.clearRect(0, 0, w, h);
      // The scale, faint, behind the bars.
      ctx.strokeStyle = colours.line;
      ctx.lineWidth = dpr;
      ctx.globalAlpha = 0.5;
      for (const m of marks) {
        const y = Math.round((1 - m.at) * h) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!frame) return;
      const levels = frame.bands;
      const n = Math.min(bands, levels.length);
      if (n === 0) return;
      // The colour: the held peak, moved by what the EQ does to the whole
      // sound, against the target. A clip is red whatever the EQ does —
      // turning it down afterwards does not undo it.
      const shift = levelShiftDb(levels, gains);
      const tone = targetTone(
        frame.meter.peakDb + shift,
        frame.meter.clipping,
        range,
      );
      const colour = targetColor(tone, colours);
      const loud = carriers(levels, gains);
      const gap = Math.max(1, Math.round(dpr));
      const barW = (w - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const was = levels[i]!;
        const now = gains ? shiftBar(was, gains[i] ?? 0) : was;
        const x = i * (barW + gap);
        const wasY = h - Math.round(was * h);
        const nowY = h - Math.round(now * h);
        ctx.fillStyle = loud[i] ? colour : colours.muted;
        ctx.fillRect(x, Math.max(wasY, nowY), barW, h - Math.max(wasY, nowY));
        if (nowY < wasY) {
          // What the EQ adds: the bar carried on, paler.
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x, nowY, barW, wasY - nowY);
          ctx.globalAlpha = 1;
        } else if (nowY > wasY + dpr) {
          // What it takes away: the bar that was, hollow.
          ctx.strokeStyle = fg || colours.muted;
          ctx.lineWidth = dpr;
          ctx.globalAlpha = 0.5;
          ctx.strokeRect(
            x + dpr / 2,
            wasY + dpr / 2,
            Math.max(0, barW - dpr),
            nowY - wasY,
          );
          ctx.globalAlpha = 1;
        }
      }
    };

    draw(last.current);
    return subscribe((frame) => {
      last.current = frame;
      draw(frame);
    });
  }, [subscribe, size, canvas, marks, gains, bands, lowDb, highDb]);

  return (
    <div className="flex h-full w-full flex-col gap-1">
      <div className="flex min-h-0 flex-1">
        <div aria-hidden className="relative w-6 shrink-0">
          {marks.map((m) => (
            <span
              key={m.db}
              className="absolute right-1 translate-y-1/2 font-figures text-[9px] leading-none text-muted"
              style={{ bottom: `${spectrumAt(m.db) * 100}%` }}
            >
              {formatTargetDb(m.db)}
            </span>
          ))}
        </div>
        <div ref={box} className="relative min-w-0 flex-1">
          <canvas
            ref={canvas}
            role="img"
            aria-label={label}
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
      <div aria-hidden className="flex">
        <div className="w-6 shrink-0" />
        <div className="relative h-3 min-w-0 flex-1 font-figures text-[9px] leading-none text-muted">
          {ticks.map((tick) => (
            <span
              key={tick.band}
              className="absolute -translate-x-1/2"
              style={{ left: `${((tick.band + 0.5) / bands) * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
