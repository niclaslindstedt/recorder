// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// How a take is kept, as a person chooses it: four presets over the two
// settings the capture reads (`recordingKind`, `recordingBitrate`), and
// what each costs a minute. Pure — the Quality sheet and the Record
// screen's button both draw from here, so the name on the button and the
// row ticked in the sheet can never disagree.

import type { RecordingKind } from "./types.ts";
import type { Bitrate } from "./useAppSettings.ts";

export type QualityId = "memo" | "standard" | "high" | "lossless";

export type QualityPreset = {
  id: QualityId;
  kind: RecordingKind;
  /** The encoder's target for a compact preset; ignored for lossless. */
  bitrate: Bitrate;
};

/** In order of size. Memo, Standard and High are the device's own encoder
 *  at three rates; Lossless is the samples, as FLAC. */
export const QUALITY_PRESETS: readonly QualityPreset[] = [
  { id: "memo", kind: "compact", bitrate: 64 },
  { id: "standard", kind: "compact", bitrate: 128 },
  { id: "high", kind: "compact", bitrate: 256 },
  { id: "lossless", kind: "lossless", bitrate: 128 },
];

/** The preset the settings amount to, or `null` for a compact bitrate no
 *  preset offers (96, 192, 320) — the sheet's fine-tune row. */
export function presetFor(settings: {
  recordingKind: RecordingKind;
  recordingBitrate: Bitrate;
}): QualityId | null {
  if (settings.recordingKind === "lossless") return "lossless";
  const hit = QUALITY_PRESETS.find(
    (p) => p.kind === "compact" && p.bitrate === settings.recordingBitrate,
  );
  return hit?.id ?? null;
}

/** What a lossless take is assumed to be when sizing it: a phone's
 *  microphone at 48 kHz, one channel, 16-bit FLAC. */
const LOSSLESS_RATE = 48_000;
const LOSSLESS_BYTES_PER_SAMPLE = 2;
/** What FLAC typically leaves of 16-bit PCM for speech and a room. */
export const FLAC_RATIO = 0.6;

/** Roughly how many bytes a minute of this quality takes. A compact take is
 *  its bitrate, near enough; a lossless one is an estimate — FLAC's size
 *  depends on the sound. */
export function bytesPerMinute(kind: RecordingKind, bitrate: number): number {
  if (kind === "lossless")
    return Math.round(
      LOSSLESS_RATE * LOSSLESS_BYTES_PER_SAMPLE * 60 * FLAC_RATIO,
    );
  return Math.round((bitrate * 1000 * 60) / 8);
}

/** How many bytes a second of this quality takes — the size of a take so
 *  far is this times its length. */
export function bytesPerSecond(kind: RecordingKind, bitrate: number): number {
  return bytesPerMinute(kind, bitrate) / 60;
}

/** How long this device could keep recording at this quality into the room
 *  the browser says is left, ms. `null` when the browser does not say. */
export function recordingTimeLeft(
  freeBytes: number | null,
  kind: RecordingKind,
  bitrate: number,
): number | null {
  if (freeBytes === null || !Number.isFinite(freeBytes) || freeBytes < 0)
    return null;
  return (freeBytes / bytesPerSecond(kind, bitrate)) * 1000;
}
