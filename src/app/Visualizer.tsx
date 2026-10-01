// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  SpectrumBars,
  meterFill,
  readFrame,
  toDb,
  type CaptureFrame,
} from "@niclaslindstedt/oss-framework/audio";
import { WaveformIcon } from "@niclaslindstedt/oss-framework/components";

import { SpectrogramIcon, SpectrumIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { bucketShare } from "./pacing.ts";
import {
  formatTargetDb,
  targetTone,
  type TargetRange,
  type TargetTone,
} from "./target.ts";
import type { VisualizerKind } from "./useAppSettings.ts";

// The Record screen's big picture (docs/design.md, "Record"): the card that
// takes the room between the timer and the meter while listening and
// recording, drawing one of three views of the same frames —
//
// - wave: the sound's shape scrolling by, the newest at the right edge, on
//   the meter's own decibel scale, with the target range (`target.ts`)
//   shaded across it and every bar coloured by where its peak landed —
//   grey under the range, the accent in it, amber over it, red when hot or
//   clipped — so "is this a good level?" is read off the picture;
// - spectrum: the framework's bars, how loud each frequency is now;
// - spectrogram: frequency over time, brighter where louder, so a hum, a
//   hiss or a voice's harmonics show as lines.
//
// It draws from what the capture hands every subscriber; what a level or a
// clip *is* stays the framework's (`readFrame`, `meterFill`, `meterTone`),
// and where one should be for this source is the target's.
// The switcher is in the card's corner, because trying the three against a
// room is the point of having three.

type Subscribe = (listener: (frame: CaptureFrame) => void) => () => void;

type Props = {
  kind: VisualizerKind;
  onKind: (kind: VisualizerKind) => void;
  subscribe: Subscribe;
  /** Frames arrive while paused too; the scrolling views hold still. */
  running: boolean;
  /** The frequency printed beside a band. */
  ticks: Array<{ band: number; label: string }>;
  bands: number;
  /** Where the peaks should land: the waveform's band and its colours. */
  target: TargetRange;
  /** Draw the whole take so far as a strip along the card's foot, from the
   *  frames' own thumbnail. */
  overview?: boolean;
  className?: string;
};

/** How long one column of the scrolling views stands for, ms — about six
 *  seconds across a phone. The picture does not step by a column at a time:
 *  it slides a little on every frame the capture hands out (one per
 *  display frame), so the motion is as smooth as the screen can draw it. */
const COLUMN_MS = 45;

/** The longest gap between two frames that is still taken as time passed —
 *  a tab that was hidden resumes where it was rather than lurching. */
const MAX_STEP_MS = 100;

export function Visualizer({
  kind,
  onKind,
  subscribe,
  running,
  ticks,
  bands,
  target,
  overview,
  className = "",
}: Props) {
  const t = useT();
  const kinds: Array<[VisualizerKind, ReactNode]> = [
    ["wave", <WaveformIcon key="w" className="h-4 w-4" />],
    ["spectrum", <SpectrumIcon key="s" className="h-4 w-4" />],
    ["spectrogram", <SpectrogramIcon key="g" className="h-4 w-4" />],
  ];
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {kind === "wave"
            ? t("visualizer.caption.wave", {
                low: formatTargetDb(target.lowDb),
                high: formatTargetDb(target.highDb),
              })
            : t(`visualizer.caption.${kind}`)}
        </span>
        <div
          role="radiogroup"
          aria-label={t("visualizer.label")}
          className="flex shrink-0 gap-0.5 rounded-md bg-surface-2 p-0.5"
        >
          {kinds.map(([k, icon]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              aria-label={t(`visualizer.${k}`)}
              title={t(`visualizer.${k}`)}
              onClick={() => onKind(k)}
              className={`flex h-7 w-8 items-center justify-center rounded transition-colors ${
                kind === k
                  ? "bg-surface text-accent shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-16 flex-1">
        <div className="absolute inset-0">
          {kind === "wave" && (
            <ScrollingWave
              subscribe={subscribe}
              running={running}
              target={target}
            />
          )}
          {kind === "spectrum" && (
            <SpectrumBars
              subscribe={subscribe}
              ticks={ticks}
              label={t("visualizer.spectrum")}
              className="h-full"
            />
          )}
          {kind === "spectrogram" && (
            <Spectrogram
              subscribe={subscribe}
              running={running}
              ticks={ticks}
              bands={bands}
            />
          )}
        </div>
      </div>
      {overview && (
        <div
          className="h-8 shrink-0 rounded-sm bg-surface-2 px-1"
          title={t("visualizer.overview")}
        >
          <TakeOverview subscribe={subscribe} target={target} />
        </div>
      )}
    </div>
  );
}

/** A canvas that fills its box at the device's pixel density, and the
 *  box's size, which the drawing restarts on. */
function useCanvas() {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1]?.contentRect;
      if (!r) return;
      const width = Math.round(r.width);
      const height = Math.round(r.height);
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = canvas.current;
    if (!el || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(size.width * dpr);
    el.height = Math.round(size.height * dpr);
  }, [size]);
  return { box, canvas, size };
}

/** The theme's colours, read off the page so both themes draw right. */
function palette(el: Element) {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    accent: v("--accent", "#2da44e"),
    flag: v("--flag", "#d4a72c"),
    danger: v("--danger", "#cf222e"),
    line: v("--line", "#8886"),
    muted: v("--muted", "#888"),
    ground: v("--surface-2", "transparent"),
  };
}

/** A bar's colour by where its peak landed against the target: no colour
 *  under it, the accent in it, amber over it, red when hot. */
function targetColor(tone: TargetTone, p: ReturnType<typeof palette>): string {
  return tone === "hot"
    ? p.danger
    : tone === "over"
      ? p.flag
      : tone === "in"
        ? p.accent
        : p.muted;
}

function ScrollingWave({
  subscribe,
  running,
  target,
}: {
  subscribe: Subscribe;
  running: boolean;
  target: TargetRange;
}) {
  const t = useT();
  const { box, canvas, size } = useCanvas();
  const runningRef = useRef(running);
  runningRef.current = running;
  const { lowDb, highDb } = target;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const colW = 3 * dpr;
    const gap = 1 * dpr;
    const pitch = colW + gap;
    const count = Math.ceil(el.width / pitch) + 2;
    // Each column: the loudest reading in its slice of time, dBFS, and
    // whether it clipped. Oldest first. `slice` is the one being filled,
    // already sliding in at the right edge; `phase` is how far into it the
    // clock is, ms.
    const cols: Array<{ db: number; clipped: boolean }> = [];
    let slice = { db: -Infinity, clipped: false };
    let phase = 0;
    let last = performance.now();
    const colours = palette(el);
    const range = { lowDb, highDb };

    const bar = (x: number, c: { db: number; clipped: boolean }) => {
      const mid = el.height / 2;
      const half = Math.max(dpr, meterFill(c.db) * mid);
      ctx.fillStyle = targetColor(targetTone(c.db, c.clipped, range), colours);
      ctx.fillRect(x, mid - half, colW, half * 2);
    };

    const draw = () => {
      const w = el.width;
      const h = el.height;
      const mid = h / 2;
      ctx.clearRect(0, 0, w, h);
      // The target, mirrored: a band in a wash of the accent, so the bars
      // that reach into it are the ones in the right place.
      const lowY = meterFill(lowDb) * mid;
      const highY = meterFill(highDb) * mid;
      ctx.fillStyle = colours.accent;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(0, mid - highY, w, highY - lowY);
      ctx.fillRect(0, mid + lowY, w, highY - lowY);
      ctx.globalAlpha = 1;
      // Its edges, dashed across.
      ctx.strokeStyle = colours.line;
      ctx.lineWidth = dpr;
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      for (const db of [lowDb, highDb]) {
        const y = meterFill(db) * mid;
        for (const yy of [mid - y, mid + y]) {
          ctx.beginPath();
          ctx.moveTo(0, yy);
          ctx.lineTo(w, yy);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Whole device pixels, so a bar's edges stay sharp as it slides.
      const offset = Math.round((phase / COLUMN_MS) * pitch);
      const edge = w - offset;
      if (slice.db > -Infinity) bar(edge, slice);
      for (let i = 0; i < cols.length; i++) {
        const x = edge - (i + 1) * pitch;
        if (x + colW < 0) break;
        bar(x, cols[cols.length - 1 - i]!);
      }
    };

    draw();
    return subscribe((frame) => {
      const now = performance.now();
      const dt = Math.min(MAX_STEP_MS, now - last);
      last = now;
      if (!runningRef.current) return;
      const reading = readFrame(frame.samples);
      if (reading.peakDb > slice.db) slice.db = reading.peakDb;
      if (reading.clipped) slice.clipped = true;
      phase += dt;
      while (phase >= COLUMN_MS) {
        phase -= COLUMN_MS;
        cols.push(slice);
        slice = { db: -Infinity, clipped: false };
      }
      if (cols.length > count) cols.splice(0, cols.length - count);
      draw();
    });
  }, [subscribe, size, canvas, lowDb, highDb]);

  return (
    <div ref={box} className="relative h-full w-full">
      <canvas
        ref={canvas}
        role="img"
        aria-label={t("visualizer.waveLabel", {
          low: formatTargetDb(lowDb),
          high: formatTargetDb(highDb),
        })}
        className="absolute inset-0 h-full w-full"
      />
      {[highDb, lowDb].map((db) => (
        <span
          key={db}
          aria-hidden
          className="pointer-events-none absolute left-0 font-figures text-[9px] leading-none text-muted"
          style={{ top: `calc(50% - ${meterFill(db) * 50}% - 0.7em)` }}
        >
          {formatTargetDb(db)}
        </span>
      ))}
    </div>
  );
}

function Spectrogram({
  subscribe,
  running,
  ticks,
  bands,
}: {
  subscribe: Subscribe;
  running: boolean;
  ticks: Array<{ band: number; label: string }>;
  bands: number;
}) {
  const t = useT();
  const { box, canvas, size } = useCanvas();
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const colW = 2 * dpr;
    const colours = palette(el);
    ctx.fillStyle = colours.ground;
    ctx.fillRect(0, 0, el.width, el.height);
    // The loudest each band has been since the last strip was drawn, and
    // how many device pixels the picture owes the clock: it moves one
    // column (`colW`) every `COLUMN_MS`, a pixel or two per frame.
    const slice = new Float32Array(bands);
    const speed = colW / COLUMN_MS;
    let owed = 0;
    let last = performance.now();

    return subscribe((frame) => {
      const now = performance.now();
      const dt = Math.min(MAX_STEP_MS, now - last);
      last = now;
      if (!runningRef.current) return;
      const n = Math.min(bands, frame.bands.length);
      for (let b = 0; b < n; b++)
        if (frame.bands[b]! > slice[b]!) slice[b] = frame.bands[b]!;
      owed += dt * speed;
      const step = Math.floor(owed);
      if (step < 1) return;
      owed -= step;
      const w = el.width;
      const h = el.height;
      // Move what is drawn `step` pixels to the left, and draw the new strip
      // at the right edge: low frequencies at the foot, as a stave reads.
      ctx.drawImage(el, step, 0, w - step, h, 0, 0, w - step, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colours.ground;
      ctx.fillRect(w - step, 0, step, h);
      const bandH = h / n;
      for (let b = 0; b < n; b++) {
        const v = slice[b]!;
        const y = h - (b + 1) * bandH;
        // Heat in three layers of the theme's own colours: accent for
        // present, the flag's amber for loud, danger for the loudest.
        ctx.globalAlpha = Math.min(1, v * 1.4);
        ctx.fillStyle = colours.accent;
        ctx.fillRect(w - step, y, step, bandH + 0.5);
        if (v > 0.55) {
          ctx.globalAlpha = Math.min(1, (v - 0.55) * 3);
          ctx.fillStyle = colours.flag;
          ctx.fillRect(w - step, y, step, bandH + 0.5);
        }
        if (v > 0.8) {
          ctx.globalAlpha = Math.min(1, (v - 0.8) * 5);
          ctx.fillStyle = colours.danger;
          ctx.fillRect(w - step, y, step, bandH + 0.5);
        }
        slice[b] = 0;
      }
      ctx.globalAlpha = 1;
    });
  }, [subscribe, size, canvas, bands]);

  const labels = useMemo(
    () =>
      ticks.map((tick) => ({
        label: tick.label,
        bottom: `${((tick.band + 0.5) / bands) * 100}%`,
      })),
    [ticks, bands],
  );

  return (
    <div
      ref={box}
      className="relative h-full w-full overflow-hidden rounded-sm"
    >
      <canvas
        ref={canvas}
        role="img"
        aria-label={t("visualizer.spectrogram")}
        className="absolute inset-0 h-full w-full"
      />
      {labels.map((l) => (
        <span
          key={l.label}
          aria-hidden
          className="pointer-events-none absolute left-1 translate-y-1/2 rounded-xs bg-surface/70 px-0.5 font-figures text-[9px] leading-none text-muted"
          style={{ bottom: l.bottom }}
        >
          {l.label}
        </span>
      ))}
    </div>
  );
}

/** The whole take so far, redrawn on every frame: the thumbnail's buckets
 *  laid out by the time each holds (`bucketShare`), so the picture narrows
 *  smoothly as the take grows rather than re-flowing four times a second.
 *  Each bucket wears the target's colour, a little quieter than the
 *  waveform's, so how much of the take landed in range is seen at once. */
function TakeOverview({
  subscribe,
  target,
}: {
  subscribe: Subscribe;
  target: TargetRange;
}) {
  const t = useT();
  const { box, canvas, size } = useCanvas();
  const { lowDb, highDb } = target;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const colours = palette(el);
    const range = { lowDb, highDb };
    let drawnCount = -1;
    let drawnElapsed = -1;

    return subscribe((frame) => {
      const peaks = frame.peaks;
      const n = peaks.length;
      // Paused, nothing changes: leave the picture as it is.
      if (n === drawnCount && frame.elapsedMs === drawnElapsed) return;
      drawnCount = n;
      drawnElapsed = frame.elapsedMs;
      const w = el.width;
      const h = el.height;
      const mid = h / 2;
      ctx.clearRect(0, 0, w, h);
      if (n === 0) return;
      const pitch = bucketShare(frame.elapsedMs, n) * w;
      // Bars with a gap while there is room for one; a solid shape once
      // the take is long enough that there is not.
      const bar = pitch >= 3 * dpr ? pitch * 0.7 : pitch;
      const inset = (pitch - bar) / 2;
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < n; i++) {
        const x = i * pitch + inset;
        if (x >= w) break;
        const peak = Math.min(1, peaks[i]!);
        const half = Math.max(dpr / 2, peak * mid);
        ctx.fillStyle = targetColor(
          targetTone(toDb(peak), false, range),
          colours,
        );
        ctx.fillRect(x, mid - half, Math.min(bar, w - x), half * 2);
      }
      ctx.globalAlpha = 1;
    });
  }, [subscribe, size, canvas, lowDb, highDb]);

  return (
    <div ref={box} className="relative h-full w-full">
      <canvas
        ref={canvas}
        role="img"
        aria-label={t("visualizer.overview")}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
