// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared fixtures: a recording, a folder, and a `ctx` whose ids are named
// and whose clock is set, so a test reads as a story rather than a lottery.

import type { Ctx } from "../../src/app/folders.ts";
import {
  emptyDoc,
  type AppData,
  type Folder,
  type Recording,
} from "../../src/app/types.ts";

/** A `ctx` that hands out `f1`, `f2`, … and stamps a fixed, then advancing,
 *  clock: each call to `now` is a minute after the last. */
export function ctx(
  start = "2026-03-10T09:00:00.000Z",
): Ctx & { at: () => string } {
  let n = 0;
  let t = Date.parse(start);
  return {
    id: () => `id${++n}`,
    now: () => {
      t += 60_000;
      return new Date(t).toISOString();
    },
    at: () => new Date(t).toISOString(),
  };
}

export function recording(overrides: Partial<Recording> = {}): Recording {
  const id = overrides.id ?? "rec1";
  return {
    id,
    title: "Standup notes",
    folderId: null,
    createdAt: "2026-03-10T08:30:00.000Z",
    updatedAt: "2026-03-10T08:31:00.000Z",
    durationMs: 65_000,
    sampleRate: 48_000,
    channels: 1,
    kind: "compact",
    mimeType: "audio/webm;codecs=opus",
    fileName: `${id}.webm`,
    size: 512_000,
    peaks: [0.1, 0.5, 0.3],
    favorite: false,
    notes: "",
    clipCount: 0,
    maxPeakDb: -12,
    ...overrides,
  };
}

export function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "fold1",
    name: "Work",
    parentId: null,
    order: 0,
    updatedAt: "2026-03-01T10:00:00.000Z",
    ...overrides,
  };
}

export function doc(
  recordings: Recording[] = [],
  folders: Folder[] = [],
): AppData {
  const out = emptyDoc();
  for (const r of recordings) out.recordings[r.id] = r;
  for (const f of folders) out.folders[f.id] = f;
  return out;
}
