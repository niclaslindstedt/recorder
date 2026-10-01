// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The equalizer: a low cut and five bands, and what they do to a sound.
//
// An EQ is a fact about a recording, kept beside it and never written into
// its bytes: the take stays as the microphone heard it, the EQ is heard in
// the player and baked into an export. Turning it back to Flat is always
// possible, which is the point of keeping it apart.
//
// The bands are named for what they do to a voice or an instrument rather
// than by a frequency alone: Bass, Warmth, Mids, Presence and Air, plus a
// Low cut for the rumble under everything.
//
// The bands split the sound rather than bend it: four crossovers, each
// halfway between two bands' centres on a log axis, cut the spectrum into
// five pieces that add back up to the whole, and a knob is how loud its
// piece is. So two bands turned down together stay down between them —
// there is no bump where one filter's skirt ends before the next begins —
// every band turned the same way is that much everywhere, and a band can
// be turned off altogether. Each crossover is Linkwitz–Riley at 48 dB an
// octave, and every piece passes the all-passes of the
// crossovers it does not use, so the pieces stay in phase and sum flat.
//
// Every stage is a biquad on the formulas the Web Audio spec gives its
// `BiquadFilterNode` (the RBJ cookbook), so what the player plays through
// the browser's filters (`eqChain.ts`) and what an export computes here
// (`applyEq`) are the same curve.
//
// Pure and clock-free; no browser needed.

import type { Pcm } from "@niclaslindstedt/oss-framework/audio";

export const EQ_BANDS = [
  { id: "bass", hz: 100 },
  { id: "warmth", hz: 300 },
  { id: "mids", hz: 1000 },
  { id: "presence", hz: 3500 },
  { id: "air", hz: 10000 },
] as const satisfies ReadonlyArray<{ id: string; hz: number }>;

export type EqBandId = (typeof EQ_BANDS)[number]["id"];

/** Where each band hands over to the next, Hz: halfway between their
 *  centres on a log axis (173, 548, 1871 and 5916 Hz). */
export const EQ_CROSSOVERS: readonly number[] = EQ_BANDS.slice(1).map((b, i) =>
  Math.round(Math.sqrt(EQ_BANDS[i]!.hz * b.hz)),
);

/** Where the low cut starts, Hz: under a voice, over a rumble. */
export const LOW_CUT_HZ = 80;

/** How far a band turns up and down, dB, and the step it turns in. The
 *  bottom of the knob is off: that band is not heard at all. */
export const EQ_MAX_DB = 12;
export const EQ_MIN_DB = -24;
export const EQ_STEP_DB = 0.5;

/** A band turned all the way down, which is silence rather than −24 dB. */
export function isOff(db: number): boolean {
  return db <= EQ_MIN_DB;
}

/** A knob's dB as the gain its piece of the sound is multiplied by. */
export function bandGain(db: number): number {
  return isOff(db) ? 0 : 10 ** (db / 20);
}

export type Eq = {
  lowCut: boolean;
  gains: Record<EqBandId, number>;
};

export const FLAT_EQ: Eq = {
  lowCut: false,
  gains: { bass: 0, warmth: 0, mids: 0, presence: 0, air: 0 },
};

/** An EQ that changes nothing. */
export function isFlat(eq: Eq | null | undefined): boolean {
  if (!eq) return true;
  return !eq.lowCut && EQ_BANDS.every((b) => eq.gains[b.id] === 0);
}

/** A gain turned to the knob's range and its step. */
export function clampGain(db: number): number {
  if (!Number.isFinite(db)) return 0;
  const stepped = Math.round(db / EQ_STEP_DB) * EQ_STEP_DB;
  const clamped = Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, stepped));
  return clamped === 0 ? 0 : clamped; // no −0
}

/** Anything → an EQ, or `null` for one that changes nothing (or cannot be
 *  read). What stored bytes go through: a document, the settings. */
export function normalizeEq(value: unknown): Eq | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const v = value as { lowCut?: unknown; gains?: unknown };
  const raw =
    typeof v.gains === "object" && v.gains !== null && !Array.isArray(v.gains)
      ? (v.gains as Record<string, unknown>)
      : {};
  const gains = { ...FLAT_EQ.gains };
  for (const b of EQ_BANDS) gains[b.id] = clampGain(Number(raw[b.id] ?? 0));
  const eq: Eq = { lowCut: v.lowCut === true, gains };
  return isFlat(eq) ? null : eq;
}

export function withGain(eq: Eq, band: EqBandId, db: number): Eq {
  return { ...eq, gains: { ...eq.gains, [band]: clampGain(db) } };
}

export function sameEq(a: Eq | null, b: Eq | null): boolean {
  const x = a ?? FLAT_EQ;
  const y = b ?? FLAT_EQ;
  return (
    x.lowCut === y.lowCut &&
    EQ_BANDS.every((band) => x.gains[band.id] === y.gains[band.id])
  );
}

/** Starting points, named for what they are for. */
export const EQ_PRESETS = [
  { id: "flat", eq: FLAT_EQ },
  {
    id: "podcast",
    eq: {
      lowCut: true,
      gains: { bass: -1, warmth: -2, mids: 0, presence: 3, air: 2 },
    },
  },
  {
    id: "warm",
    eq: {
      lowCut: false,
      gains: { bass: 3, warmth: 2, mids: 0, presence: -1, air: -2 },
    },
  },
  {
    id: "bright",
    eq: {
      lowCut: false,
      gains: { bass: 0, warmth: -1, mids: 0, presence: 3, air: 4 },
    },
  },
  {
    id: "rumble",
    eq: {
      lowCut: true,
      gains: { bass: -3, warmth: 0, mids: 0, presence: 0, air: 0 },
    },
  },
  {
    id: "lofi",
    eq: {
      lowCut: true,
      gains: { bass: -6, warmth: 2, mids: 4, presence: 0, air: -9 },
    },
  },
] as const satisfies ReadonlyArray<{ id: string; eq: Eq }>;

export type EqPresetId = (typeof EQ_PRESETS)[number]["id"];

/** Which preset an EQ is, or `null` for one turned by hand. */
export function presetOf(eq: Eq | null): EqPresetId | null {
  return EQ_PRESETS.find((p) => sameEq(p.eq, eq))?.id ?? null;
}

// ── The filters ───────────────────────────────────────────────────────────

/** One biquad, normalised (a0 = 1). */
export type Biquad = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
};

/** One stage as the browser's node is told it: a type, a frequency and a
 *  resonance (as a plain Q; the node wants dB for a low- or high-pass). */
export type EqStage = {
  type: "lowpass" | "highpass" | "allpass";
  hz: number;
  q: number;
};

/** A fourth-order Butterworth as two biquads: the flattest pass band. A
 *  crossover is two of them in a row each way — Linkwitz–Riley, 48 dB an
 *  octave — steep enough that a band turned off is gone, not just lower;
 *  its low and high halves add up to the same two Qs as all-passes. */
export const BUTTERWORTH_QS = [
  1 / (2 * Math.cos(Math.PI / 8)),
  1 / (2 * Math.cos((3 * Math.PI) / 8)),
] as const;

/** The low cut's resonance: a second-order Butterworth. */
export const LOW_CUT_Q = Math.SQRT1_2;

/** The highest a stage's frequency goes at `rate` — under the Nyquist,
 *  with room. */
export function stageCeiling(rate: number): number {
  return rate * 0.45;
}

/** The crossovers a rate can carry. */
function crossoversAt(rate: number): number[] {
  return EQ_CROSSOVERS.filter((hz) => hz < stageCeiling(rate));
}

function pair(type: EqStage["type"], hz: number): EqStage[] {
  const half = BUTTERWORTH_QS.map((q) => ({ type, hz, q }));
  return type === "allpass" ? half : [...half, ...half];
}

/** Every crossover's all-pass: what the five pieces add up to. */
export function allpassStages(rate: number): EqStage[] {
  return crossoversAt(rate).flatMap((hz) => pair("allpass", hz));
}

/** The bands a rate can carry, and the stages each one's piece of the
 *  sound goes through from the split to the sum: a high-pass at each
 *  crossover under it, a low-pass at the one over it, and an all-pass at
 *  each crossover above that, so every piece is delayed alike. A crossover
 *  the rate cannot carry is left out, with every band above it: the band
 *  under it runs to the top. */
export function bandPaths(
  rate: number,
): Array<{ id: EqBandId; stages: EqStage[] }> {
  const crossovers = crossoversAt(rate);
  return EQ_BANDS.slice(0, crossovers.length + 1).map((band, i) => ({
    id: band.id,
    stages: crossovers.flatMap((hz, k) =>
      pair(k < i ? "highpass" : k === i ? "lowpass" : "allpass", hz),
    ),
  }));
}

function normalise(
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number,
): Biquad {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** A stage's coefficients at `rate`, as the Web Audio spec computes them. */
export function biquad(stage: EqStage, rate: number): Biquad {
  const w = (2 * Math.PI * stage.hz) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * stage.q);
  if (stage.type === "lowpass")
    return normalise(
      (1 - cos) / 2,
      1 - cos,
      (1 - cos) / 2,
      1 + alpha,
      -2 * cos,
      1 - alpha,
    );
  if (stage.type === "highpass")
    return normalise(
      (1 + cos) / 2,
      -(1 + cos),
      (1 + cos) / 2,
      1 + alpha,
      -2 * cos,
      1 - alpha,
    );
  return normalise(
    1 - alpha,
    -2 * cos,
    1 + alpha,
    1 + alpha,
    -2 * cos,
    1 - alpha,
  );
}

/** What an EQ is at `rate`, worked out for the arithmetic. The pieces sum
 *  to the all-passes alone, so Σ gain × piece is the all-passes plus
 *  (gain − 1) × each piece whose knob is not at 0 — a band left at 0 costs
 *  nothing. `null` for an EQ that changes nothing. */
type Plan = {
  lowCut: Biquad | null;
  /** Every crossover's all-pass: the sound, delayed as the pieces are. */
  allpass: Biquad[];
  pieces: Array<{ weight: number; stages: Biquad[] }>;
};

function plan(eq: Eq | null, rate: number): Plan | null {
  if (!eq || !(rate > 0)) return null;
  const pieces = bandPaths(rate)
    .filter((p) => eq.gains[p.id] !== 0)
    .map((p) => ({
      weight: bandGain(eq.gains[p.id]) - 1,
      stages: p.stages.map((s) => biquad(s, rate)),
    }));
  const lowCut = eq.lowCut
    ? biquad({ type: "highpass", hz: LOW_CUT_HZ, q: LOW_CUT_Q }, rate)
    : null;
  if (!lowCut && pieces.length === 0) return null;
  const allpass =
    pieces.length === 0 ? [] : allpassStages(rate).map((s) => biquad(s, rate));
  return { lowCut, allpass, pieces };
}

type Complex = [number, number];

/** A biquad's response at `w` radians per sample. */
function at(f: Biquad, w: number): Complex {
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  // H(e^jw) = (b0 + b1 e^-jw + b2 e^-2jw) / (1 + a1 e^-jw + a2 e^-2jw)
  const nr = f.b0 + f.b1 * c1 + f.b2 * c2;
  const ni = -(f.b1 * s1 + f.b2 * s2);
  const dr = 1 + f.a1 * c1 + f.a2 * c2;
  const di = -(f.a1 * s1 + f.a2 * s2);
  const d = dr * dr + di * di;
  return [(nr * dr + ni * di) / d, (ni * dr - nr * di) / d];
}

function times(a: Complex, b: Complex): Complex {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function through(stages: Biquad[], w: number): Complex {
  return stages.reduce<Complex>((h, f) => times(h, at(f, w)), [1, 0]);
}

/** As low as the curve says it goes, dB: where every band is off. */
export const RESPONSE_FLOOR_DB = -120;

/** What the EQ does at any frequency, dB, worked out once for many — the
 *  curve the sheet draws, and the spectrum's bars moved by it. */
export function eqResponse(
  eq: Eq | null,
  rate = 48000,
): (hz: number) => number {
  const p = plan(eq, rate);
  if (!p) return () => 0;
  return (hz) => {
    const w = (2 * Math.PI * hz) / rate;
    let h: Complex = [1, 0];
    if (p.pieces.length > 0) {
      h = through(p.allpass, w);
      for (const piece of p.pieces) {
        const [re, im] = through(piece.stages, w);
        h = [h[0] + piece.weight * re, h[1] + piece.weight * im];
      }
    }
    if (p.lowCut) h = times(h, at(p.lowCut, w));
    const power = h[0] * h[0] + h[1] * h[1];
    return Math.max(RESPONSE_FLOOR_DB, 10 * Math.log10(power));
  };
}

/** What the EQ does at `hz`, dB. */
export function responseDb(eq: Eq | null, hz: number, rate = 48000): number {
  return eqResponse(eq, rate)(hz);
}

/** Run samples through stages, in place. Direct form II transposed, state
 *  in doubles. */
function filter(samples: Float32Array, stages: Biquad[]): void {
  for (const f of stages) {
    let z1 = 0;
    let z2 = 0;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i]!;
      const y = f.b0 * x + z1;
      z1 = f.b1 * x - f.a1 * y + z2;
      z2 = f.b2 * x - f.a2 * y;
      samples[i] = y;
    }
  }
}

/** The samples through the EQ — what an export is encoded from. A flat EQ
 *  hands the same samples back. */
export function applyEq(pcm: Pcm, eq: Eq | null): Pcm {
  const p = plan(eq, pcm.sampleRate);
  if (!p) return pcm;
  const channels = pcm.channels.map((input) => {
    const out = new Float32Array(input);
    if (p.pieces.length > 0) {
      filter(out, p.allpass);
      const piece = new Float32Array(input.length);
      for (const { weight, stages } of p.pieces) {
        piece.set(input);
        filter(piece, stages);
        for (let i = 0; i < out.length; i++)
          out[i] = out[i]! + weight * piece[i]!;
      }
    }
    if (p.lowCut) filter(out, [p.lowCut]);
    return out;
  });
  return { sampleRate: pcm.sampleRate, channels };
}
