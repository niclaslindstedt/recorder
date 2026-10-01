// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A take, finished: what the microphone handed back, turned into the record
// the document keeps and the bytes the blob store keeps.
//
// Two kinds. A *compact* take is the browser's own container (Opus in WebM,
// AAC in MP4), kept as it came. A *lossless* take is the samples themselves,
// encoded to FLAC here — half the size of WAV and every bit of the sound.
// Pure apart from the encoding, which is pure too: the clock and the id come
// in through `ctx`.

import {
  MIME_FLAC,
  encodeFlac,
  extensionForMime,
  type CaptureResult,
  type FlacLevel,
} from "@niclaslindstedt/oss-framework/audio";

import { normalizeEq, type Eq } from "./eq.ts";
import type { Ctx } from "./folders.ts";
import type { Recording } from "./types.ts";

export type FinishedTake = { recording: Recording; blob: Blob };

/** The title a take starts with, before the reader names it: the app's
 *  words for "New recording", numbered past the first. The caller hands the
 *  words in — no string is composed here. */
export function defaultTitle(base: string, taken: Iterable<string>): string {
  const names = new Set(Array.from(taken));
  if (!names.has(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${base} ${n}`;
    if (!names.has(candidate)) return candidate;
  }
  return base;
}

/** Turn a capture into a recording. `flacLevel` applies to a lossless take. */
export function finishTake(
  result: CaptureResult,
  options: {
    title: string;
    folderId: string | null;
    ctx: Ctx;
    flacLevel?: FlacLevel;
    /** The Record screen's EQ, which a new take starts with. */
    eq?: Eq | null;
  },
): FinishedTake {
  const id = options.ctx.id();
  const now = options.ctx.now();
  let blob: Blob;
  let mimeType: string;
  let kind: Recording["kind"];
  if (result.mode === "pcm" && result.pcm) {
    const bytes = encodeFlac(result.pcm, { level: options.flacLevel });
    blob = new Blob([bytes as BlobPart], { type: MIME_FLAC });
    mimeType = MIME_FLAC;
    kind = "lossless";
  } else {
    blob = result.blob;
    mimeType = result.mimeType || result.blob.type || "audio/webm";
    kind = "compact";
  }
  const ext = extensionForMime(mimeType);
  const started = new Date(Date.parse(now) - result.durationMs).toISOString();
  const recording: Recording = {
    id,
    title: options.title,
    folderId: options.folderId,
    createdAt: started,
    updatedAt: now,
    durationMs: Math.round(result.durationMs),
    sampleRate: result.sampleRate,
    channels: result.channels,
    kind,
    mimeType,
    fileName: `${id}.${ext}`,
    size: blob.size,
    peaks: result.peaks,
    favorite: false,
    notes: "",
    clipCount: result.clipCount,
    maxPeakDb: Math.round(result.maxPeakDb * 10) / 10,
  };
  const eq = normalizeEq(options.eq);
  if (eq) recording.eq = eq;
  return { recording, blob };
}
