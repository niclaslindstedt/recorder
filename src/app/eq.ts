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
// Low cut for the rumble under everything. Every filter is a biquad on the
// formulas the Web Audio spec gives its `BiquadFilterNode` (the RBJ
// cookbook, shelves at slope 1), so what the player plays through the
// browser's filters (`eqChain.ts`) and what an export computes here
// (`applyEq`) are the same curve.
//
// Pure and clock-free; no browser needed.

import type { Pcm } from "@niclaslindstedt/oss-framework/audio";

export type EqBandKind = "lowshelf" | "peaking" | "highshelf";

export const EQ_BANDS = [
  { id: "bass", kind: "lowshelf", hz: 100, q: 1 },
  { id: "warmth", kind: "peaking", hz: 300, q: 1 },
  { id: "mids", kind: "peaking", hz: 1000, q: 1 },
  { id: "presence", kind: "peaking", hz: 3500, q: 1 },
  { id: "air", kind: "highshelf", hz: 10000, q: 1 },
] as const satisfies ReadonlyArray<{
  id: string;
  kind: EqBandKind;
  hz: number;
  q: number;
}>;

export type EqBandId = (typeof EQ_BANDS)[number]["id"];

/** Where the low cut starts, Hz: under a voice, over a rumble. */
export const LOW_CUT_HZ = 80;

/** How far a band turns either way, dB, and the step it turns in. */
export const EQ_MAX_DB = 12;
export const EQ_STEP_DB = 0.5;

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
  const clamped = Math.max(-EQ_MAX_DB, Math.min(EQ_MAX_DB, stepped));
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

/** Starting points, named for what they are for: a setting of the five
 *  bands. The low cut is not part of one — it is its own switch, and
 *  picking a starting point leaves it as it was, so the two never undo
 *  each other. */
export const EQ_PRESETS = [
  { id: "flat", gains: FLAT_EQ.gains },
  {
    id: "podcast",
    gains: { bass: -1, warmth: -2, mids: 0, presence: 3, air: 2 },
  },
  {
    id: "warm",
    gains: { bass: 3, warmth: 2, mids: 0, presence: -1, air: -2 },
  },
  {
    id: "bright",
    gains: { bass: 0, warmth: -1, mids: 0, presence: 3, air: 4 },
  },
  {
    id: "lofi",
    gains: { bass: -6, warmth: 2, mids: 4, presence: 0, air: -9 },
  },
] as const satisfies ReadonlyArray<{ id: string; gains: Eq["gains"] }>;

export type EqPresetId = (typeof EQ_PRESETS)[number]["id"];

/** A starting point picked: its bands, the low cut as it was. */
export function withPreset(eq: Eq | null, id: EqPresetId): Eq {
  const preset = EQ_PRESETS.find((p) => p.id === id) ?? EQ_PRESETS[0];
  return { lowCut: eq?.lowCut ?? false, gains: { ...preset.gains } };
}

/** Which starting point an EQ's bands are, or `null` for bands turned by
 *  hand. The low cut does not count: it is said beside the name. */
export function presetOf(eq: Eq | null): EqPresetId | null {
  const gains = (eq ?? FLAT_EQ).gains;
  return (
    EQ_PRESETS.find((p) => EQ_BANDS.every((b) => p.gains[b.id] === gains[b.id]))
      ?.id ?? null
  );
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

/** The low cut's resonance: Butterworth, the flattest pass band. The Web
 *  Audio node takes it in dB for a high-pass (`LOW_CUT_Q_DB`). */
const LOW_CUT_Q = Math.SQRT1_2;
export const LOW_CUT_Q_DB = 20 * Math.log10(LOW_CUT_Q);

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

function highPass(hz: number, q: number, rate: number): Biquad {
  const w = (2 * Math.PI * hz) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  return normalise(
    (1 + cos) / 2,
    -(1 + cos),
    (1 + cos) / 2,
    1 + alpha,
    -2 * cos,
    1 - alpha,
  );
}

function band(
  kind: EqBandKind,
  hz: number,
  q: number,
  db: number,
  rate: number,
): Biquad {
  const A = 10 ** (db / 40);
  const w = (2 * Math.PI * hz) / rate;
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  if (kind === "peaking") {
    const alpha = sin / (2 * q);
    return normalise(
      1 + alpha * A,
      -2 * cos,
      1 - alpha * A,
      1 + alpha / A,
      -2 * cos,
      1 - alpha / A,
    );
  }
  // Shelves at slope 1, as the Web Audio spec has them.
  const alpha = (sin / 2) * Math.SQRT2;
  const k = 2 * alpha * Math.sqrt(A);
  if (kind === "lowshelf") {
    return normalise(
      A * (A + 1 - (A - 1) * cos + k),
      2 * A * (A - 1 - (A + 1) * cos),
      A * (A + 1 - (A - 1) * cos - k),
      A + 1 + (A - 1) * cos + k,
      -2 * (A - 1 + (A + 1) * cos),
      A + 1 + (A - 1) * cos - k,
    );
  }
  return normalise(
    A * (A + 1 + (A - 1) * cos + k),
    -2 * A * (A - 1 + (A + 1) * cos),
    A * (A + 1 + (A - 1) * cos - k),
    A + 1 - (A - 1) * cos + k,
    2 * (A - 1 - (A + 1) * cos),
    A + 1 - (A - 1) * cos - k,
  );
}

/** The stages an EQ is at `rate`: only the ones that change anything. A
 *  band above the rate's Nyquist is left out rather than folded back. */
export function eqFilters(eq: Eq | null, rate: number): Biquad[] {
  if (!eq || !(rate > 0)) return [];
  const out: Biquad[] = [];
  const nyquist = rate / 2;
  if (eq.lowCut) out.push(highPass(LOW_CUT_HZ, LOW_CUT_Q, rate));
  for (const b of EQ_BANDS) {
    const db = eq.gains[b.id];
    if (db === 0 || b.hz >= nyquist * 0.95) continue;
    out.push(band(b.kind, b.hz, b.q, db, rate));
  }
  return out;
}

/** What the EQ does at `hz`, dB — the curve the sheet draws. */
export function responseDb(eq: Eq | null, hz: number, rate = 48000): number {
  const w = (2 * Math.PI * hz) / rate;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  let db = 0;
  for (const f of eqFilters(eq, rate)) {
    // H(e^jw) = (b0 + b1 e^-jw + b2 e^-2jw) / (1 + a1 e^-jw + a2 e^-2jw)
    const nr = f.b0 + f.b1 * c1 + f.b2 * c2;
    const ni = -(f.b1 * s1 + f.b2 * s2);
    const dr = 1 + f.a1 * c1 + f.a2 * c2;
    const di = -(f.a1 * s1 + f.a2 * s2);
    db += 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  }
  return db;
}

/** The samples through the EQ — what an export is encoded from. A flat EQ
 *  hands the same samples back. */
export function applyEq(pcm: Pcm, eq: Eq | null): Pcm {
  const filters = eqFilters(eq, pcm.sampleRate);
  if (filters.length === 0) return pcm;
  const channels = pcm.channels.map((input) => {
    const out = new Float32Array(input);
    for (const f of filters) {
      // Direct form II transposed, state in doubles.
      let z1 = 0;
      let z2 = 0;
      for (let i = 0; i < out.length; i++) {
        const x = out[i]!;
        const y = f.b0 * x + z1;
        z1 = f.b1 * x - f.a1 * y + z2;
        z2 = f.b2 * x - f.a2 * y;
        out[i] = y;
      }
    }
    return out;
  });
  return { sampleRate: pcm.sampleRate, channels };
}
