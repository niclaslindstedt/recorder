// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The way out: a recording as a file somebody else can open.
//
// The take is decoded to samples through the browser, folded and resampled
// as the form asked, and encoded by the framework — WAV and FLAC in the
// bundle, MP3 through an encoder fetched on first use so nobody who never
// exports one downloads it. The framework's `saveFile` gets it out: a
// download on the web, the share sheet in the phone app.
//
// `exportFileName` and `exportPlan` are pure and tested; `exportRecording`
// is the one that touches the browser.

import {
  MIME_FLAC,
  MIME_WAV,
  decodeAudio,
  encodeFlac,
  encodeWav,
  resample,
  toMono,
  type FlacLevel,
  type Pcm,
  type WavDepth,
} from "@niclaslindstedt/oss-framework/audio";
import {
  saveFile,
  type SaveFileOutcome,
} from "@niclaslindstedt/oss-framework/files";

import type { Bitrate, ExportFormat, ExportRate } from "./useAppSettings.ts";
import type { Recording } from "./types.ts";

export type ExportOptions = {
  format: ExportFormat;
  wavDepth: WavDepth;
  flacLevel: FlacLevel;
  mp3Bitrate: Bitrate;
  /** `0` keeps the take's own rate. */
  rate: ExportRate;
  mono: boolean;
};

export const EXPORT_EXTENSION: Record<ExportFormat, string> = {
  wav: "wav",
  flac: "flac",
  mp3: "mp3",
};

/** The file's name: the title, made safe for a file system, and the
 *  format's extension. A title that leaves nothing safe falls back to the
 *  recording's id. */
export function exportFileName(
  recording: Pick<Recording, "title" | "id">,
  format: ExportFormat,
): string {
  const safe = recording.title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 _-]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return `${safe || recording.id}.${EXPORT_EXTENSION[format]}`;
}

/** What the samples go through before the encoder: the channel count and
 *  the rate the file ends up with. */
export function exportPlan(
  take: Pick<Recording, "sampleRate" | "channels">,
  options: Pick<ExportOptions, "format" | "rate" | "mono">,
): { channels: number; sampleRate: number } {
  const channels = options.mono ? 1 : Math.max(1, take.channels);
  let sampleRate = options.rate || take.sampleRate;
  // MP3 knows nine rates; anything else lands on the nearest.
  if (options.format === "mp3") sampleRate = nearestMp3Rate(sampleRate);
  return { channels, sampleRate };
}

const MP3_RATES = [
  8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000,
];

function nearestMp3Rate(rate: number): number {
  let best = MP3_RATES[0]!;
  for (const r of MP3_RATES)
    if (Math.abs(r - rate) < Math.abs(best - rate)) best = r;
  return best;
}

/** Samples → the file's bytes, per format. */
export async function encodeExport(
  pcm: Pcm,
  options: ExportOptions,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const plan = exportPlan(
    { sampleRate: pcm.sampleRate, channels: pcm.channels.length },
    options,
  );
  let shaped = plan.channels === 1 ? toMono(pcm) : pcm;
  shaped = resample(shaped, plan.sampleRate);
  switch (options.format) {
    case "wav":
      return { bytes: encodeWav(shaped, options.wavDepth), mimeType: MIME_WAV };
    case "flac":
      return {
        bytes: encodeFlac(shaped, { level: options.flacLevel }),
        mimeType: MIME_FLAC,
      };
    case "mp3": {
      const { encodeMp3, MIME_MP3 } =
        await import("@niclaslindstedt/oss-framework/audio/mp3");
      return {
        bytes: encodeMp3(shaped, options.mp3Bitrate),
        mimeType: MIME_MP3,
      };
    }
  }
}

/** Export one recording: decode its bytes, encode them as asked and hand
 *  the file out. Rejects when the take cannot be decoded or the phone could
 *  not share it. */
export async function exportRecording(
  recording: Recording,
  blob: Blob,
  options: ExportOptions,
): Promise<SaveFileOutcome> {
  const pcm = await decodeAudio(blob);
  const { bytes, mimeType } = await encodeExport(pcm, options);
  return saveFile({
    blob: new Blob([bytes as BlobPart], { type: mimeType }),
    filename: exportFileName(recording, options.format),
    mimeType,
  });
}

/** Share the take as it is — no decoding, the container the browser wrote. */
export function shareOriginal(
  recording: Recording,
  blob: Blob,
): Promise<SaveFileOutcome> {
  const ext = recording.fileName.split(".").pop() ?? "bin";
  const base = exportFileName(recording, "wav").replace(/\.wav$/, "");
  return saveFile({
    blob,
    filename: `${base}.${ext}`,
    mimeType: recording.mimeType,
  });
}
