// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import {
  DEFAULT_FLAC_LEVEL,
  DEFAULT_WAV_DEPTH,
  clampFlacLevel,
  clampWavDepth,
  type FlacLevel,
  type WavDepth,
} from "@niclaslindstedt/oss-framework/audio";
import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";

import type { RecordingKind } from "./types.ts";

// The app's own (non-document) settings: the theme, how a take is kept, what
// an export defaults to, and the developer knobs. Per device on purpose —
// which format your laptop exports in is not a fact about a recording — and
// persisted to localStorage so a reload keeps your choices. Everything else
// lives in the document (`types.ts`) or in the sync engine's own keys.

/** The theme choice. Deliberately three values and no more — one light, one
 *  dark, and "follow the device". */
export type ThemeChoice = "light" | "dark" | "system";

/** The formats an export offers. The MP3 encoder rides an optional package
 *  fetched on first use (`export.ts`). */
export type ExportFormat = "wav" | "flac" | "mp3";
export const EXPORT_FORMATS: ExportFormat[] = ["wav", "flac", "mp3"];

/** The bitrates offered for a compact take and for an MP3, kbit/s. */
export const BITRATES = [64, 96, 128, 192, 256, 320] as const;
export type Bitrate = (typeof BITRATES)[number];

/** How far the skip buttons move, seconds. */
export const SKIP_SECONDS = [5, 10, 15, 30] as const;
export type SkipSeconds = (typeof SKIP_SECONDS)[number];

/** The sample rates an export may be resampled to. `0` keeps the take's. */
export const EXPORT_RATES = [0, 22050, 44100, 48000] as const;
export type ExportRate = (typeof EXPORT_RATES)[number];

export type AppSettings = {
  theme: ThemeChoice;
  /** How a take is kept: the browser's encoder, or the samples themselves. */
  recordingKind: RecordingKind;
  /** The encoder's target for a compact take. */
  recordingBitrate: Bitrate;
  /** Whether the device's voice processing (echo cancelling, noise
   *  suppression, automatic gain) is asked for. Off records what the
   *  microphone hears. */
  voiceProcessing: boolean;
  /** Whether the spectrum is drawn while recording. */
  showSpectrum: boolean;
  /** How many seconds the skip buttons move. */
  skipSeconds: SkipSeconds;
  /** What the export form starts on. */
  exportFormat: ExportFormat;
  exportWavDepth: WavDepth;
  exportFlacLevel: FlacLevel;
  exportMp3Bitrate: Bitrate;
  exportRate: ExportRate;
  /** Fold a stereo take to mono on export. A voice memo is mono in all but
   *  name, and the file halves for it. */
  exportMono: boolean;
  /** Surface the developer affordances in Settings. */
  devMode: boolean;
  /** Mirror console output into the in-app log buffer. */
  captureLogs: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  recordingKind: "compact",
  recordingBitrate: 128,
  voiceProcessing: false,
  showSpectrum: true,
  skipSeconds: 15,
  exportFormat: "mp3",
  exportWavDepth: DEFAULT_WAV_DEPTH,
  exportFlacLevel: DEFAULT_FLAC_LEVEL,
  exportMp3Bitrate: 128,
  exportRate: 0,
  exportMono: true,
  devMode: false,
  captureLogs: false,
};

const STORAGE_KEY = "recorder:settings";

function oneOf<T extends readonly unknown[]>(
  table: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  const n =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return table.includes(n) ? (n as T[number]) : fallback;
}

/** Stored bytes → settings, every field clamped. Exported for the tests. */
export function parseSettings(raw: string): AppSettings {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_SETTINGS;
  }
  const m = { ...DEFAULT_SETTINGS, ...(parsed as object) } as Record<
    keyof AppSettings,
    unknown
  >;
  return {
    theme: m.theme === "light" || m.theme === "dark" ? m.theme : "system",
    recordingKind: m.recordingKind === "lossless" ? "lossless" : "compact",
    recordingBitrate: oneOf(
      BITRATES,
      m.recordingBitrate,
      DEFAULT_SETTINGS.recordingBitrate,
    ),
    voiceProcessing: m.voiceProcessing === true,
    showSpectrum: m.showSpectrum !== false,
    skipSeconds: oneOf(
      SKIP_SECONDS,
      m.skipSeconds,
      DEFAULT_SETTINGS.skipSeconds,
    ),
    exportFormat: oneOf(
      EXPORT_FORMATS,
      m.exportFormat,
      DEFAULT_SETTINGS.exportFormat,
    ),
    exportWavDepth: clampWavDepth(m.exportWavDepth),
    exportFlacLevel: clampFlacLevel(m.exportFlacLevel),
    exportMp3Bitrate: oneOf(
      BITRATES,
      m.exportMp3Bitrate,
      DEFAULT_SETTINGS.exportMp3Bitrate,
    ),
    exportRate: oneOf(EXPORT_RATES, m.exportRate, DEFAULT_SETTINGS.exportRate),
    exportMono: m.exportMono !== false,
    devMode: m.devMode === true,
    captureLogs: m.captureLogs === true,
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useLocalStorageState<AppSettings>(
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    {
      parse: parseSettings,
    },
  );

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [setSettings],
  );

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [setSettings]);

  return { settings, update, reset, setSettings };
}
