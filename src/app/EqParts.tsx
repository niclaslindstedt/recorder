// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_STEP_DB,
  clampGain,
  eqResponse,
  isOff,
  presetOf,
  type Eq,
} from "./eq.ts";
import { useT } from "./i18n/index.ts";
import { palette, useCanvas } from "./canvas.ts";

// The equalizer's two instruments: a knob per band, and the curve the
// knobs make, drawn over what the sound is doing now when there is a sound
// to show (`EqSheet.tsx`). And the curve small, for a button that opens
// the sheet, with the EQ's name in words.

/** How far a drag goes for the knob's whole sweep, px — off to +12 dB in
 *  a thumb's comfortable reach. */
const SWEEP_PX = 160;

/** The knob's sweep either side of 0 dB at the top, degrees: the cut side
 *  runs to off, the boost side to +12 dB. */
const SWEEP = 135;

/** Where a dB sits on the knob, −1 (off) to 1 (+12), 0 dB at the top. */
function positionOf(db: number): number {
  return db >= 0 ? db / EQ_MAX_DB : db / -EQ_MIN_DB;
}

function dbAt(position: number): number {
  const p = Math.max(-1, Math.min(1, position));
  return p >= 0 ? p * EQ_MAX_DB : p * -EQ_MIN_DB;
}

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

/** A dB as the knob prints it: "+3.5", "−6", "0" — or `null` for a band
 *  turned off, which is said in words. */
export function formatGain(db: number): string | null {
  if (isOff(db)) return null;
  if (db === 0) return "0";
  const text =
    Math.abs(db) % 1 === 0 ? String(Math.abs(db)) : Math.abs(db).toFixed(1);
  return db > 0 ? `+${text}` : `−${text}`;
}

/** One band's knob: drag up to boost and down to cut — all the way down
 *  is off — the arrow keys in half-dB steps, Page Up / Down in threes,
 *  Home for off, a double-tap back to 0. It is a slider to assistive tech,
 *  and says its value in words. */
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
  const angle = positionOf(value) * SWEEP;
  const tip = polar(28, 28, 15, angle);
  const off = isOff(value);
  const shown = formatGain(value) ?? t("eq.off");

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    drag.current = { y: e.clientY, from: positionOf(value), moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 2) d.moved = true;
    const fine = e.shiftKey ? 0.25 : 1;
    onChange(clampGain(dbAt(d.from + ((2 * dy) / SWEEP_PX) * fine)));
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
    else if (e.key === "Home") next = EQ_MIN_DB;
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
        aria-valuemin={EQ_MIN_DB}
        aria-valuemax={EQ_MAX_DB}
        aria-valuenow={value}
        aria-valuetext={off ? shown : t("eq.db", { value: shown })}
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
              stroke={off ? "var(--muted)" : "var(--accent)"}
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
          value === 0 || off ? "text-muted" : "text-accent"
        }`}
      >
        {shown}
      </span>
      <span className="text-[0.625rem] text-muted">{hz}</span>
    </div>
  );
}

const MIN_HZ = 20;
const MAX_HZ = 20000;
/** The curve's dB range: a little past the knobs up, and down past the
 *  last step before off — a band turned off runs out of the bottom. */
const TOP_DB = EQ_MAX_DB + 3;
const BOTTOM_DB = EQ_MIN_DB - 6;
/** The spectrum's dB range, bottom to top. */
const SPEC_FLOOR = -100;
const SPEC_CEIL = -20;
/** A spectrum bar's width and the gap after it, CSS px. */
const BAR_PX = 4;
const GAP_PX = 1;

function xOf(hz: number, w: number) {
  return (Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * w;
}

function hzOf(x: number, w: number) {
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** (x / w);
}

/** A level in dBFS as a share of the spectrum's height. */
function specShare(db: number) {
  return Math.max(0, Math.min(1, (db - SPEC_FLOOR) / (SPEC_CEIL - SPEC_FLOOR)));
}

/** The EQ's curve from 20 Hz to 20 kHz, the bands marked on it, and —
 *  while something is playing or the microphone is monitored — the sound's
 *  spectrum as bars behind it, moved by the EQ as it is turned: what is
 *  left of each bar plain, what the EQ adds in the accent, and what it
 *  takes away as the bar that was, hollow, so a cut can be seen taking
 *  a hum out. Comparing, the EQ's part is drawn faint, as it is not being
 *  heard. */
export function EqCurve({
  eq,
  analyser,
  bypassed,
}: {
  eq: Eq | null;
  /** The sound before the EQ, when there is one to show. */
  analyser: AnalyserNode | null;
  /** Comparing: the EQ is drawn faint, as it is not being heard. */
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
    const w = el.width;
    const h = el.height;
    // Kept inside the frame, so a band turned off still shows its dot.
    const edge = 4 * dpr;
    const yOf = (db: number) =>
      Math.max(
        edge,
        Math.min(h - edge, ((TOP_DB - db) / (TOP_DB - BOTTOM_DB)) * h),
      );
    const fg =
      getComputedStyle(el).getPropertyValue("--fg").trim() || colours.muted;
    const faint = bypassed;

    // Everything that only moves with the EQ, worked out once: the curve,
    // the knobs' places on it, and what it does under each bar.
    const response = eqResponse(eq, 48000);
    const points: Array<[number, number]> = [];
    for (let x = 0; x <= w; x += dpr)
      points.push([x, yOf(response(hzOf(x, w)))]);
    const dots = EQ_BANDS.map((b) => [xOf(b.hz, w), yOf(response(b.hz))]);
    const step = (BAR_PX + GAP_PX) * dpr;
    const bars: Array<{ x: number; lo: number; hi: number; db: number }> = [];
    if (freq) {
      const bin = rate / 2 / freq.length;
      for (let x = 0; x + BAR_PX * dpr <= w; x += step) {
        const lo = Math.min(freq.length - 1, Math.round(hzOf(x, w) / bin));
        const hi = Math.min(
          freq.length - 1,
          Math.max(lo, Math.round(hzOf(x + BAR_PX * dpr, w) / bin)),
        );
        bars.push({ x, lo, hi, db: response(hzOf(x + (BAR_PX * dpr) / 2, w)) });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // The grid: 100 Hz, 1 kHz, 10 kHz across; ±6, ±12 and −24 dB along.
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
      for (const db of [-24, -12, -6, 6, 12]) {
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

      // The sound now: each bar as it came in, and what the EQ does to it.
      if (analyser && freq) {
        analyser.getFloatFrequencyData(freq);
        const barW = BAR_PX * dpr;
        for (const bar of bars) {
          let level = -Infinity;
          for (let i = bar.lo; i <= bar.hi; i++)
            level = Math.max(level, freq[i]!);
          const before = h - specShare(level) * h;
          const after = h - specShare(level + bar.db) * h;
          // What is left of it.
          ctx.fillStyle = colours.muted;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(bar.x, Math.max(before, after), barW, h);
          if (after < before) {
            // What the EQ adds.
            ctx.fillStyle = colours.accent;
            ctx.globalAlpha = faint ? 0.25 : 0.7;
            ctx.fillRect(bar.x, after, barW, before - after);
          } else if (after > before + dpr) {
            // What it takes away: the bar that was, hollow.
            ctx.strokeStyle = fg;
            ctx.lineWidth = dpr;
            ctx.globalAlpha = faint ? 0.2 : 0.45;
            ctx.strokeRect(
              bar.x + dpr / 2,
              before + dpr / 2,
              barW - dpr,
              after - before,
            );
          }
        }
        ctx.globalAlpha = 1;
      }

      // The curve, filled to 0 dB.
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
      for (const [x, y] of dots) {
        ctx.beginPath();
        ctx.arc(x!, y!, 3.5 * dpr, 0, Math.PI * 2);
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
        +{TOP_DB}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0.5 left-1 font-figures text-[9px] leading-none text-muted"
      >
        −{-BOTTOM_DB}
      </span>
    </div>
  );
}

/** An EQ in words: its starting point (or Custom), and the low cut beside
 *  it when it is on — "Podcast · Low cut", or "Low cut" alone over flat
 *  bands. The low cut is a switch of its own, never part of a starting
 *  point, so it is said apart. */
export function useEqName(): (eq: Eq | null) => string {
  const t = useT();
  return (eq) => {
    const id = presetOf(eq);
    const name = id ? t(`eq.preset.${id}`) : t("eq.custom");
    if (!eq?.lowCut) return name;
    return id === "flat" ? t("eq.lowCut") : t("eq.withLowCut", { name });
  };
}

/** How many points the small curve is drawn through. */
const LINE_POINTS = 40;
/** The small curve's dB range either side of 0, at least: a gentle EQ
 *  still bends visibly at a button's size, and a steep one is shown to
 *  the sheet's own range and no further. */
const LINE_MIN_DB = 6;

/** The EQ's curve at a glyph's size, 20 Hz to 20 kHz: what a button that
 *  opens the sheet shows, so the EQ is seen and not only named. Flat is a
 *  straight line along the middle. Drawn in the accent; decorative, so the
 *  button's own name says what it is. */
export function EqLine({
  eq,
  className,
}: {
  eq: Eq | null;
  className?: string;
}) {
  const W = 48;
  const H = 32;
  const { line, fill } = useMemo(() => {
    const response = eqResponse(eq);
    const dbs = Array.from({ length: LINE_POINTS + 1 }, (_, i) =>
      Math.max(BOTTOM_DB, Math.min(TOP_DB, response(hzOf(i, LINE_POINTS)))),
    );
    const range = Math.max(LINE_MIN_DB, ...dbs.map(Math.abs));
    const pad = 3;
    const pts = dbs.map((db, i) => {
      const x = (i / LINE_POINTS) * W;
      const y = H / 2 - (db / range) * (H / 2 - pad);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return {
      line: `M${pts.join("L")}`,
      fill: `M0,${H / 2}L${pts.join("L")}L${W},${H / 2}Z`,
    };
  }, [eq]);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <line
        x1={0}
        y1={H / 2}
        x2={W}
        y2={H / 2}
        stroke="var(--line)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <path d={fill} fill="currentColor" fillOpacity={0.16} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
