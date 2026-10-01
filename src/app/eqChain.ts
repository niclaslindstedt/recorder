// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The EQ as the browser's own filters: the low cut, then the sound split
// into the five bands' pieces (`bandPaths` in `eq.ts`), each through a gain,
// added back together — and an analyser on the sound before any of it, for
// the sheet's live spectrum, which draws the EQ's effect over it.
//
// Every stage is always there, so turning a knob only moves a gain (glided
// over a few milliseconds, so it never clicks): five pieces at unity add up
// to the sound as it was, and a band turned off is a gain of 0. The low
// cut, off, is a peaking filter at 0 dB, which passes everything. Where two
// bands' pieces start with the same filters (every band over a crossover
// is high-passed at it), they share the nodes. The coefficients the browser
// computes are the spec's, which `eq.ts` computes too — what is heard is
// what is exported.

import {
  FLAT_EQ,
  LOW_CUT_HZ,
  LOW_CUT_Q,
  bandGain,
  bandPaths,
  stageCeiling,
  type Eq,
  type EqStage,
} from "./eq.ts";

/** How long a knob's move takes to land, s. */
const GLIDE_S = 0.015;

export type EqChain = {
  /** Where the sound goes in. */
  input: AudioNode;
  /** Where it comes out, through the EQ; connect it onward. */
  output: AudioNode;
  /** The sound as it went in, before the EQ, for the spectrum. */
  analyser: AnalyserNode;
  set: (eq: Eq | null) => void;
  disconnect: () => void;
};

/** A plain Q as the node takes it: in dB for a low- or high-pass. */
function nodeQ(stage: EqStage): number {
  return stage.type === "allpass" ? stage.q : 20 * Math.log10(stage.q);
}

export function createEqChain(ctx: BaseAudioContext, eq: Eq | null): EqChain {
  const input = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.75;
  input.connect(analyser);

  const lowCut = ctx.createBiquadFilter();
  input.connect(lowCut);
  const output = ctx.createGain();
  const nodes: AudioNode[] = [input, analyser, lowCut, output];

  // Each piece's filters, built once per run of stages it shares with the
  // pieces before it.
  const built = new Map<string, AudioNode>();
  const gains = bandPaths(ctx.sampleRate).map(({ id, stages }) => {
    let from: AudioNode = lowCut;
    let key = "";
    for (const stage of stages) {
      key += `${stage.type}:${stage.hz}:${stage.q};`;
      let node = built.get(key);
      if (!node) {
        const f = ctx.createBiquadFilter();
        f.type = stage.type;
        f.frequency.value = Math.min(stage.hz, stageCeiling(ctx.sampleRate));
        f.Q.value = nodeQ(stage);
        from.connect(f);
        built.set(key, f);
        nodes.push(f);
        node = f;
      }
      from = node;
    }
    const gain = ctx.createGain();
    from.connect(gain);
    gain.connect(output);
    nodes.push(gain);
    return { id, gain: gain.gain };
  });

  const set = (next: Eq | null) => {
    const e = next ?? FLAT_EQ;
    const at = ctx.currentTime;
    if (e.lowCut) {
      lowCut.type = "highpass";
      lowCut.frequency.value = LOW_CUT_HZ;
      lowCut.Q.value = 20 * Math.log10(LOW_CUT_Q);
    } else {
      // A peaking filter at 0 dB passes everything as it is.
      lowCut.type = "peaking";
      lowCut.gain.value = 0;
    }
    for (const { id, gain } of gains) {
      gain.cancelScheduledValues(at);
      gain.setTargetAtTime(bandGain(e.gains[id]), at, GLIDE_S);
    }
  };
  set(eq);

  return {
    input,
    output,
    analyser,
    set,
    disconnect: () => {
      for (const node of nodes) node.disconnect();
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
