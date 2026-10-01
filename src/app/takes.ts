// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A take, finished: what the microphone handed back, turned into the record
// the document keeps and the bytes the blob store keeps.
//
// Two kinds. A *compact* take is the browser's own container (Opus in WebM,
// AAC in MP4), kept as it came. A *lossless* take is the samples themselves,
// encoded to FLAC here — half the size of WAV and every bit of the sound.
// Pure apart from the encoding, which is pure too: the clock and the id come
// in through `ctx`.
//
// A take made with the sound trigger on (`gate.ts`) is captured as samples
// whatever its kind, because the browser's encoder cannot be handed back
// the stretches worth keeping. `gateCapture` keeps them; a lossless take
// stays samples for `finishTake`, and a compact one is encoded here to MP3
// at the take's bitrate, by the encoder the export fetches on first use.

import {
  MIME_FLAC,
  encodeFlac,
  extensionForMime,
  peaksOf,
  resample,
  type CaptureResult,
  type FlacLevel,
} from "@niclaslindstedt/oss-framework/audio";

import { normalizeEq, type Eq } from "./eq.ts";
import type { Ctx } from "./folders.ts";
import {
  applyGate,
  gateTake,
  gateTimesIn,
  readGated,
  type GateQuiet,
} from "./gate.ts";
import type { Recording, RecordingKind } from "./types.ts";

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

/** The sound trigger, as a take is gated by it (`useAppSettings.ts`). */
export type Trigger = {
  thresholdDb: number;
  preMs: number;
  holdMs: number;
  quiet: GateQuiet;
};

/** How many buckets a take's thumbnail has, at most — the capture's own
 *  default — and how much sound one stands for, at least: a twentieth of a
 *  second, as the capture's running thumbnail starts. */
const THUMBNAIL = 200;
const BUCKETS_PER_SECOND = 20;

/** A take captured as samples, with only what the trigger kept — or `null`
 *  when nothing ever reached it, and there is nothing to keep. A compact
 *  take comes back encoded (MP3, at `bitrate` kbit/s); a lossless one as
 *  samples, for `finishTake` to make FLAC of. Its length, thumbnail, peak
 *  and clips are re-read from what was kept. */
export async function gateCapture(
  result: CaptureResult,
  trigger: Trigger,
  keep: { kind: RecordingKind; bitrate: number },
): Promise<CaptureResult | null> {
  const pcm = result.pcm;
  if (!pcm) return result;
  const stretches = gateTake(pcm, gateTimesIn(pcm.sampleRate, trigger));
  if (stretches.length === 0) return null;
  const gated = applyGate(pcm, stretches, trigger.quiet);
  const length = gated.channels[0]?.length ?? 0;
  const buckets = Math.min(
    THUMBNAIL,
    Math.ceil((length * BUCKETS_PER_SECOND) / pcm.sampleRate),
  );
  const kept: CaptureResult = {
    ...result,
    mode: "pcm",
    blob: new Blob([]),
    mimeType: "",
    pcm: gated,
    durationMs: (length / pcm.sampleRate) * 1000,
    peaks: peaksOf(gated, buckets),
    ...readGated(gated),
  };
  if (keep.kind === "lossless") return kept;
  const { MIME_MP3, clampMp3Bitrate, encodeMp3, nearestMp3SampleRate } =
    await import("@niclaslindstedt/oss-framework/audio/mp3");
  const rate = nearestMp3SampleRate(gated.sampleRate);
  const shaped = rate === gated.sampleRate ? gated : resample(gated, rate);
  const bytes = encodeMp3(shaped, clampMp3Bitrate(keep.bitrate));
  return {
    ...kept,
    mode: "encoded",
    blob: new Blob([bytes as BlobPart], { type: MIME_MP3 }),
    mimeType: MIME_MP3,
    pcm: null,
    sampleRate: rate,
    channels: Math.min(2, Math.max(1, result.channels)),
  };
}
