// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The EQ as the browser's own filters: a chain of `BiquadFilterNode`s, one
// per stage of `eq.ts`, that a player or the monitor routes its sound
// through, and an analyser at its end for the sheet's live spectrum.
//
// Every stage is always there, so turning a knob only moves a parameter
// (glided over a few milliseconds, so it never clicks): a band at 0 dB is
// a peaking filter at 0 dB, which passes the sound untouched, and the low
// cut, off, is the same. The coefficients the browser computes are the
// spec's, which `eq.ts` computes too — what is heard is what is exported.

import { EQ_BANDS, FLAT_EQ, LOW_CUT_HZ, LOW_CUT_Q_DB, type Eq } from "./eq.ts";

/** How long a knob's move takes to land, s. */
const GLIDE_S = 0.015;

export type EqChain = {
  /** Where the sound goes in. */
  input: AudioNode;
  /** The analyser at the end, for the spectrum; connect it onward. */
  output: AnalyserNode;
  set: (eq: Eq | null) => void;
  disconnect: () => void;
};

export function createEqChain(ctx: BaseAudioContext, eq: Eq | null): EqChain {
  const lowCut = ctx.createBiquadFilter();
  const bands = EQ_BANDS.map((b) => {
    const node = ctx.createBiquadFilter();
    node.type = b.kind;
    node.frequency.value = Math.min(b.hz, ctx.sampleRate * 0.45);
    node.Q.value = b.q;
    node.gain.value = 0;
    return node;
  });
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.75;

  const stages = [lowCut, ...bands];
  for (let i = 0; i < stages.length - 1; i++)
    stages[i]!.connect(stages[i + 1]!);
  stages[stages.length - 1]!.connect(analyser);

  const set = (next: Eq | null) => {
    const e = next ?? FLAT_EQ;
    const at = ctx.currentTime;
    if (e.lowCut) {
      lowCut.type = "highpass";
      lowCut.frequency.value = LOW_CUT_HZ;
      lowCut.Q.value = LOW_CUT_Q_DB;
    } else {
      // A peaking filter at 0 dB passes everything as it is.
      lowCut.type = "peaking";
      lowCut.gain.value = 0;
    }
    EQ_BANDS.forEach((b, i) => {
      const gain = bands[i]!.gain;
      gain.cancelScheduledValues(at);
      gain.setTargetAtTime(e.gains[b.id], at, GLIDE_S);
    });
  };
  set(eq);

  return {
    input: lowCut,
    output: analyser,
    set,
    disconnect: () => {
      for (const node of [...stages, analyser]) node.disconnect();
    },
  };
}

/** The browser's audio context, where it has one. */
export function newAudioContext(
  options?: AudioContextOptions,
): AudioContext | null {
  const g = globalThis as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor(options);
  } catch {
    return null;
  }
}
