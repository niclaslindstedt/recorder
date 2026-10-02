// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState } from "react";

import { meterFill } from "@niclaslindstedt/oss-framework/audio";

import type { AxisMark } from "./waveAxis.ts";
import type { TargetRange, TargetTone } from "./target.ts";

// What the app's canvases share: a canvas sized to its box, the theme's
// colours read off the page, a bar's colour against the target, and the
// backdrop every waveform is drawn on — the live one (`Visualizer.tsx`) and
// a take's (`LevelWave.tsx`) — so the two read the same.

/** A canvas that fills its box at the device's pixel density, and the
 *  box's size, which the drawing restarts on. */
export function useCanvas() {
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
export function palette(el: Element) {
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

export type Palette = ReturnType<typeof palette>;

/** A bar's colour by where its peak landed against the target: no colour
 *  under it, the accent in it, amber over it, red when hot. */
export function targetColor(tone: TargetTone, p: Palette): string {
  return tone === "hot"
    ? p.danger
    : tone === "over"
      ? p.flag
      : tone === "in"
        ? p.accent
        : p.muted;
}

/**
 * A waveform's backdrop, mirrored about the middle on the meter's scale:
 * the target as a band in a wash of the accent with its edges dashed, a
 * faint line at every other mark on the axis, and the middle.
 */
export function drawWaveBackdrop(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number; dpr: number },
  target: TargetRange,
  marks: readonly AxisMark[],
  colours: Palette,
) {
  const { w, h, dpr } = size;
  const mid = h / 2;
  const lowY = meterFill(target.lowDb) * mid;
  const highY = meterFill(target.highDb) * mid;
  ctx.fillStyle = colours.accent;
  ctx.globalAlpha = 0.1;
  ctx.fillRect(0, mid - highY, w, highY - lowY);
  ctx.fillRect(0, mid + lowY, w, highY - lowY);
  ctx.strokeStyle = colours.line;
  ctx.lineWidth = dpr;
  const across = (y: number) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  };
  // The scale, faint: enough to read a bar's height against, not enough to
  // compete with the band.
  ctx.globalAlpha = 0.35;
  for (const m of marks) {
    if (m.edge) continue;
    const y = m.at * mid;
    across(Math.round(mid - y) + 0.5);
    across(Math.round(mid + y) - 0.5);
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([4 * dpr, 4 * dpr]);
  for (const db of [target.lowDb, target.highDb]) {
    const y = meterFill(db) * mid;
    across(mid - y);
    across(mid + y);
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.5;
  across(mid);
  ctx.globalAlpha = 1;
}
