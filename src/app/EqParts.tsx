// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_STEP_DB,
  clampGain,
  responseDb,
  type Eq,
} from "./eq.ts";
import { useT } from "./i18n/index.ts";
import { palette, useCanvas } from "./Visualizer.tsx";

// The equalizer's two instruments: a knob per band, and the curve the
// knobs make, drawn over what the sound is doing now when there is a sound
// to show (`EqSheet.tsx`).

/** How far a knob turns for a pixel dragged, dB — the whole range in a
 *  thumb's comfortable reach. */
const DB_PER_PX = (2 * EQ_MAX_DB) / 160;

/** The knob's sweep either side of 0 dB at the top, degrees. */
const SWEEP = 135;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const s = polar(cx, cy, r, a);
  const e = polar(cx, cy, r, b);
  const large = b - a > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/** A dB as the knob prints it: "+3.5", "−6", "0". */
export function formatGain(db: number): string {
  if (db === 0) return "0";
  const text =
    Math.abs(db) % 1 === 0 ? String(Math.abs(db)) : Math.abs(db).toFixed(1);
  return db > 0 ? `+${text}` : `−${text}`;
}

/** One band's knob: drag up to boost and down to cut, the arrow keys in
 *  half-dB steps, Page Up / Down in threes, a double-tap back to 0. It is
 *  a slider to assistive tech, and says its value in words. */
export function Knob({
  name,
  hz,
  hint,
  value,
  onChange,
}: {
  name: string;
  hz: string;
  hint: string;
  value: number;
  onChange: (db: number) => void;
}) {
  const t = useT();
  const drag = useRef<{ y: number; from: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const angle = (value / EQ_MAX_DB) * SWEEP;
  const tip = polar(28, 28, 15, angle);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    drag.current = { y: e.clientY, from: value, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 2) d.moved = true;
    const fine = e.shiftKey ? 0.25 : 1;
    onChange(clampGain(d.from + dy * DB_PER_PX * fine));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    if (d && !d.moved) {
      const now = performance.now();
      if (now - lastTap.current < 320) onChange(0);
      lastTap.current = now;
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowUp: EQ_STEP_DB,
      ArrowRight: EQ_STEP_DB,
      ArrowDown: -EQ_STEP_DB,
      ArrowLeft: -EQ_STEP_DB,
      PageUp: 3,
      PageDown: -3,
    };
    let next: number | null = null;
    if (e.key in step) next = value + step[e.key]!;
    else if (e.key === "Home") next = -EQ_MAX_DB;
    else if (e.key === "End") next = EQ_MAX_DB;
    else if (e.key === "0" || e.key === "Delete" || e.key === "Backspace")
      next = 0;
    if (next === null) return;
    e.preventDefault();
    onChange(clampGain(next));
  };

  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <div
        role="slider"
        tabIndex={0}
        aria-label={name}
        aria-valuemin={-EQ_MAX_DB}
        aria-valuemax={EQ_MAX_DB}
        aria-valuenow={value}
        aria-valuetext={t("eq.db", { value: formatGain(value) })}
        aria-description={`${hint}. ${t("eq.knobHint")}`}
        title={`${name} · ${hz} — ${hint}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="h-14 w-14 cursor-ns-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg viewBox="0 0 56 56" className="h-full w-full" aria-hidden="true">
          <path
            d={arc(28, 28, 24, -SWEEP, SWEEP)}
            fill="none"
            stroke="var(--line)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {value !== 0 && (
            <path
              d={arc(28, 28, 24, 0, angle)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}
          <circle
            cx={28}
            cy={28}
            r={18}
            fill="var(--surface-2)"
            stroke="var(--line)"
          />
          <line
            x1={28}
            y1={28}
            x2={tip.x}
            y2={tip.y}
            stroke="var(--fg-bright)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="max-w-full truncate text-xs font-semibold text-fg-bright">
        {name}
      </span>
      <span
        className={`font-figures text-[0.6875rem] tabular-nums ${
          value === 0 ? "text-muted" : "text-accent"
        }`}
      >
        {formatGain(value)}
      </span>
      <span className="text-[0.625rem] text-muted">{hz}</span>
    </div>
  );
}

const MIN_HZ = 20;
const MAX_HZ = 20000;
/** The curve's dB range, either side of 0: a little past the knobs. */
const RANGE_DB = EQ_MAX_DB + 3;
/** The spectrum's dB range, bottom to top. */
const SPEC_FLOOR = -100;
const SPEC_CEIL = -20;

function xOf(hz: number, w: number) {
  return (Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * w;
}

function hzOf(x: number, w: number) {
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** (x / w);
}

/** The EQ's curve from 20 Hz to 20 kHz, the bands marked on it, and —
 *  while something is playing or the microphone is monitored — the sound's
 *  spectrum after the EQ behind it, so a cut can be seen taking a hum out. */
export function EqCurve({
  eq,
  analyser,
  bypassed,
}: {
  eq: Eq | null;
  analyser: AnalyserNode | null;
  /** Comparing: the curve is drawn faint, as it is not being heard. */
  bypassed: boolean;
}) {
  const t = useT();
  const { box, canvas, size } = useCanvas();

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const colours = palette(el);
    const freq = analyser ? new Float32Array(analyser.frequencyBinCount) : null;
    const rate = analyser?.context.sampleRate ?? 48000;

    const draw = () => {
      const w = el.width;
      const h = el.height;
      const yOf = (db: number) => h / 2 - (db / RANGE_DB) * (h / 2);
      ctx.clearRect(0, 0, w, h);

      // The grid: 100 Hz, 1 kHz, 10 kHz across; ±6 and ±12 dB along.
      ctx.strokeStyle = colours.line;
      ctx.lineWidth = dpr;
      ctx.globalAlpha = 0.6;
      for (const hz of [100, 1000, 10000]) {
        const x = Math.round(xOf(hz, w)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      for (const db of [-12, -6, 6, 12]) {
        const y = Math.round(yOf(db)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(yOf(0)) + 0.5);
      ctx.lineTo(w, Math.round(yOf(0)) + 0.5);
      ctx.stroke();

      // The sound now, after the EQ.
      if (analyser && freq) {
        analyser.getFloatFrequencyData(freq);
        const bin = rate / 2 / freq.length;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 2 * dpr) {
          const i = Math.min(freq.length - 1, Math.round(hzOf(x, w) / bin));
          const v = freq[i]!;
          const share = Math.max(
            0,
            Math.min(1, (v - SPEC_FLOOR) / (SPEC_CEIL - SPEC_FLOOR)),
          );
          ctx.lineTo(x, h - share * h);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = colours.muted;
        ctx.globalAlpha = 0.28;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // The curve, filled to 0 dB.
      const e = eq;
      const points: Array<[number, number]> = [];
      for (let x = 0; x <= w; x += dpr) {
        points.push([x, yOf(responseDb(e, hzOf(x, w), 48000))]);
      }
      const faint = bypassed;
      ctx.beginPath();
      ctx.moveTo(0, yOf(0));
      for (const [x, y] of points) ctx.lineTo(x, y);
      ctx.lineTo(w, yOf(0));
      ctx.closePath();
      ctx.fillStyle = colours.accent;
      ctx.globalAlpha = faint ? 0.05 : 0.14;
      ctx.fill();
      ctx.globalAlpha = faint ? 0.35 : 1;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = colours.accent;
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Where each knob sits on it.
      ctx.fillStyle = colours.accent;
      for (const b of EQ_BANDS) {
        const x = xOf(b.hz, w);
        const y = yOf(responseDb(e, b.hz, 48000));
        ctx.beginPath();
        ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    if (!analyser) {
      draw();
      return;
    }
    let frame = 0;
    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [canvas, size, analyser, eq, bypassed]);

  const label = (hz: number) => ({
    left: `${(Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * 100}%`,
  });

  return (
    <div ref={box} className="relative h-full w-full">
      <canvas
        ref={canvas}
        role="img"
        aria-label={t("eq.curve")}
        className="absolute inset-0 h-full w-full"
      />
      {[
        [100, "100"],
        [1000, "1k"],
        [10000, "10k"],
      ].map(([hz, text]) => (
        <span
          key={text}
          aria-hidden
          className="pointer-events-none absolute bottom-0.5 ml-1 font-figures text-[9px] leading-none text-muted"
          style={label(hz as number)}
        >
          {text}
        </span>
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 left-1 font-figures text-[9px] leading-none text-muted"
      >
        +{RANGE_DB}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0.5 left-1 font-figures text-[9px] leading-none text-muted"
      >
        −{RANGE_DB}
      </span>
    </div>
  );
}
