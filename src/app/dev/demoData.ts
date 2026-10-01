// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The demo library: a fortnight of invented recordings in three folders,
// every date an offset from `now`, so the list reads "Today" and "Yesterday"
// whenever it is opened. The audio is made too — short tones written as WAV
// by the framework's own encoder — so every row plays, every export works,
// and nothing is fetched from anywhere.
//
// Pure: `buildDemoData(now)` is the document, `demoAudio(recording)` the
// bytes for one of its files. `tests/demo_test.ts` opens it on every day of
// a year and at hours around the clock.

import {
  encodeWav,
  peaksOf,
  type Pcm,
} from "@niclaslindstedt/oss-framework/audio";

import { withPreset, type EqPresetId } from "../eq.ts";
import {
  emptyDoc,
  type AppData,
  type Folder,
  type Recording,
} from "../types.ts";

type Seed = {
  id: string;
  title: string;
  folder: string | null;
  /** How long ago it was taken, in hours. */
  agoHours: number;
  seconds: number;
  favorite?: boolean;
  notes?: string;
  kind?: Recording["kind"];
  /** The EQ preset it is heard through, so the EQ shows lit somewhere. */
  eq?: EqPresetId;
  /** The tone's pitch, so each demo file sounds different. */
  hz: number;
};

const FOLDERS: Array<Omit<Folder, "updatedAt">> = [
  { id: "demofolder1", name: "Meetings", parentId: null, order: 0 },
  { id: "demofolder2", name: "Ideas", parentId: null, order: 1 },
  { id: "demofolder3", name: "Interviews", parentId: "demofolder1", order: 0 },
];

const SEEDS: Seed[] = [
  {
    id: "demorec01",
    title: "Standup, Monday",
    folder: "demofolder1",
    agoHours: 3,
    seconds: 312,
    hz: 220,
    favorite: true,
  },
  {
    id: "demorec02",
    title: "Idea: garden shed layout",
    folder: "demofolder2",
    agoHours: 7,
    seconds: 48,
    hz: 330,
    notes: "Check the fence line first.",
  },
  {
    id: "demorec03",
    title: "Call with the printer",
    folder: "demofolder1",
    agoHours: 28,
    seconds: 601,
    hz: 262,
  },
  {
    id: "demorec04",
    title: "Song sketch, chorus",
    folder: null,
    agoHours: 31,
    seconds: 95,
    hz: 392,
    kind: "lossless",
    favorite: true,
  },
  {
    id: "demorec05",
    title: "Interview: Mira, part 1",
    folder: "demofolder3",
    agoHours: 52,
    seconds: 1843,
    hz: 247,
    eq: "podcast",
  },
  {
    id: "demorec06",
    title: "Interview: Mira, part 2",
    folder: "demofolder3",
    agoHours: 51,
    seconds: 1210,
    hz: 247,
  },
  {
    id: "demorec07",
    title: "Grocery list",
    folder: null,
    agoHours: 74,
    seconds: 22,
    hz: 440,
  },
  {
    id: "demorec08",
    title: "Lecture notes, week 4",
    folder: "demofolder2",
    agoHours: 120,
    seconds: 2710,
    hz: 294,
  },
  {
    id: "demorec09",
    title: "Voice note to self",
    folder: null,
    agoHours: 170,
    seconds: 61,
    hz: 349,
  },
  {
    id: "demorec10",
    title: "Retro, sprint 12",
    folder: "demofolder1",
    agoHours: 200,
    seconds: 1502,
    hz: 220,
  },
  {
    id: "demorec11",
    title: "Bird at the window",
    folder: "demofolder2",
    agoHours: 260,
    seconds: 17,
    hz: 880,
    kind: "lossless",
  },
  {
    id: "demorec12",
    title: "Pitch rehearsal",
    folder: null,
    agoHours: 330,
    seconds: 412,
    hz: 311,
  },
];

// The tones do not depend on `now`, so each is made once: the year-walk test
// opens the demo seven hundred times, and a document is the same document
// whether its samples were computed this time or last.
const pcmCache = new Map<string, Pcm>();
const peaksCache = new Map<string, number[]>();

/** A recording's demo shape: a tone that swells and fades, so the
 *  thumbnail has a shape and the meter has something to show. */
export function demoPcm(
  seed: Pick<Seed, "seconds" | "hz">,
  sampleRate = 22_050,
): Pcm {
  const key = `${seed.seconds}:${seed.hz}:${sampleRate}`;
  const cached = pcmCache.get(key);
  if (cached) return cached;
  const made = makePcm(seed, sampleRate);
  pcmCache.set(key, made);
  return made;
}

function makePcm(seed: Pick<Seed, "seconds" | "hz">, sampleRate: number): Pcm {
  // Kept short whatever the record claims — the row says 45 minutes, the
  // file plays the first ten seconds — so the demo stays small.
  const n = Math.round(Math.min(seed.seconds, 10) * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tSec = i / sampleRate;
    const env = 0.3 + 0.25 * Math.sin(tSec * 1.7) + 0.1 * Math.sin(tSec * 5.3);
    out[i] = env * Math.sin(2 * Math.PI * seed.hz * tSec) * 0.6;
  }
  return { sampleRate, channels: [out] };
}

/** The bytes for one demo file. */
export function demoAudio(recording: Recording): Uint8Array {
  const seed = SEEDS.find((s) => s.id === recording.id) ?? {
    seconds: 5,
    hz: 440,
  };
  return encodeWav(demoPcm(seed), 16);
}

export function buildDemoData(now: Date): AppData {
  const doc = emptyDoc();
  const stamp = new Date(now.getTime() - 15 * 86_400_000).toISOString();
  for (const f of FOLDERS) doc.folders[f.id] = { ...f, updatedAt: stamp };
  for (const s of SEEDS) {
    const created = new Date(now.getTime() - s.agoHours * 3_600_000);
    const pcm = demoPcm(s);
    const size = 44 + pcm.channels[0]!.length * 2;
    const peaks = peaksCache.get(s.id) ?? peaksOf(pcm, 96);
    peaksCache.set(s.id, peaks);
    doc.recordings[s.id] = {
      id: s.id,
      title: s.title,
      folderId: s.folder,
      createdAt: created.toISOString(),
      updatedAt: new Date(created.getTime() + s.seconds * 1000).toISOString(),
      durationMs: Math.min(s.seconds, 10) * 1000,
      sampleRate: 22_050,
      channels: 1,
      kind: s.kind ?? "compact",
      mimeType: "audio/wav",
      fileName: `${s.id}.wav`,
      size,
      peaks,
      favorite: s.favorite ?? false,
      notes: s.notes ?? "",
      clipCount: 0,
      maxPeakDb: -6.4,
    };
    // With the low cut on, as an interview would be.
    if (s.eq)
      doc.recordings[s.id]!.eq = { ...withPreset(null, s.eq), lowCut: true };
  }
  return doc;
}
