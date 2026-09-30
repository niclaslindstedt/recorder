// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  estimateExportBytes,
  exportFileName,
  exportPlan,
} from "../src/app/export.ts";
import { defaultTitle, finishTake } from "../src/app/takes.ts";
import { DEFAULT_SETTINGS, parseSettings } from "../src/app/useAppSettings.ts";
import { ctx, recording } from "./fixtures/helpers.ts";

describe("exportFileName", () => {
  it("makes a safe name from the title", () => {
    expect(
      exportFileName(recording({ title: "Standup notes: Tuesday!" }), "mp3"),
    ).toBe("Standup_notes_Tuesday.mp3");
    expect(exportFileName(recording({ title: "Réunion café" }), "wav")).toBe(
      "Reunion_cafe.wav",
    );
    expect(
      exportFileName(recording({ id: "abc", title: "日本語" }), "flac"),
    ).toBe("abc.flac");
    expect(
      exportFileName(recording({ title: "x".repeat(200) }), "wav"),
    ).toHaveLength(84);
  });
});

describe("exportPlan", () => {
  it("folds to mono and keeps or moves the rate", () => {
    const take = { sampleRate: 48000, channels: 2 };
    expect(exportPlan(take, { format: "wav", rate: 0, mono: true })).toEqual({
      channels: 1,
      sampleRate: 48000,
    });
    expect(
      exportPlan(take, { format: "flac", rate: 22050, mono: false }),
    ).toEqual({
      channels: 2,
      sampleRate: 22050,
    });
    expect(
      exportPlan(
        { sampleRate: 47000, channels: 1 },
        { format: "mp3", rate: 0, mono: true },
      ),
    ).toEqual({
      channels: 1,
      sampleRate: 48000,
    });
  });
});

describe("finishTake", () => {
  const base = {
    mode: "encoded" as const,
    blob: new Blob([new Uint8Array(100)], { type: "audio/webm" }),
    mimeType: "audio/webm;codecs=opus",
    pcm: null,
    durationMs: 12_345.6,
    sampleRate: 48000,
    channels: 1,
    peaks: [0.2, 0.4],
    clipCount: 2,
    maxPeakDb: -1.234,
  };

  it("keeps a compact take as it came", () => {
    const c = ctx("2026-05-01T10:00:00.000Z");
    const { recording: r, blob } = finishTake(base, {
      title: "Note",
      folderId: "f",
      ctx: c,
    });
    expect(r).toMatchObject({
      id: "id1",
      title: "Note",
      folderId: "f",
      kind: "compact",
      mimeType: "audio/webm;codecs=opus",
      fileName: "id1.webm",
      durationMs: 12346,
      size: 100,
      clipCount: 2,
      maxPeakDb: -1.2,
      peaks: [0.2, 0.4],
    });
    expect(r.updatedAt).toBe("2026-05-01T10:01:00.000Z");
    expect(Date.parse(r.updatedAt) - Date.parse(r.createdAt)).toBeCloseTo(
      12_345.6,
      0,
    );
    expect(blob).toBe(base.blob);
  });

  it("encodes a lossless take to FLAC", () => {
    const c = ctx();
    const pcm = {
      sampleRate: 44100,
      channels: [new Float32Array(4410).fill(0.1)],
    };
    const { recording: r, blob } = finishTake(
      {
        ...base,
        mode: "pcm",
        blob: new Blob([]),
        mimeType: "",
        pcm,
        sampleRate: 44100,
      },
      { title: "Loss", folderId: null, ctx: c, flacLevel: 0 },
    );
    expect(r.kind).toBe("lossless");
    expect(r.mimeType).toBe("audio/flac");
    expect(r.fileName).toBe("id1.flac");
    expect(blob.type).toBe("audio/flac");
    expect(blob.size).toBeGreaterThan(40);
    expect(r.size).toBe(blob.size);
  });
});

describe("defaultTitle", () => {
  it("numbers past the names taken", () => {
    expect(defaultTitle("New recording", [])).toBe("New recording");
    expect(defaultTitle("New recording", ["New recording"])).toBe(
      "New recording 2",
    );
    expect(
      defaultTitle("New recording", ["New recording", "New recording 2"]),
    ).toBe("New recording 3");
  });
});

describe("parseSettings", () => {
  it("clamps every field", () => {
    expect(parseSettings("null")).toEqual(DEFAULT_SETTINGS);
    const s = parseSettings(
      JSON.stringify({
        theme: "dark",
        recordingKind: "lossless",
        recordingBitrate: 999,
        exportFormat: "ogg",
        exportWavDepth: 24,
        exportFlacLevel: 8,
        exportRate: 44100,
        skipSeconds: 7,
        exportMono: false,
      }),
    );
    expect(s).toMatchObject({
      theme: "dark",
      recordingKind: "lossless",
      recordingBitrate: 128,
      exportFormat: "mp3",
      exportWavDepth: 24,
      exportFlacLevel: 8,
      exportRate: 44100,
      skipSeconds: 15,
      exportMono: false,
    });
  });
});

describe("estimateExportBytes", () => {
  const take = { sampleRate: 48000, channels: 2, durationMs: 10_000 };
  const base = { rate: 0, mono: false, wavDepth: 16, mp3Bitrate: 128 } as const;

  it("sizes a WAV exactly, header included", () => {
    expect(estimateExportBytes(take, { ...base, format: "wav" })).toBe(
      44 + 480_000 * 2 * 2,
    );
    expect(
      estimateExportBytes(take, {
        ...base,
        format: "wav",
        mono: true,
        wavDepth: 24,
      }),
    ).toBe(44 + 480_000 * 3);
  });

  it("follows the rate the file will have", () => {
    expect(
      estimateExportBytes(take, {
        ...base,
        format: "wav",
        rate: 22050,
        mono: true,
      }),
    ).toBe(44 + 220_500 * 2);
  });

  it("sizes an MP3 by its bitrate", () => {
    expect(estimateExportBytes(take, { ...base, format: "mp3" })).toBe(160_000);
  });

  it("puts FLAC between MP3 and WAV", () => {
    const flac = estimateExportBytes(take, { ...base, format: "flac" });
    expect(flac).toBeLessThan(
      estimateExportBytes(take, { ...base, format: "wav" }),
    );
    expect(flac).toBeGreaterThan(
      estimateExportBytes(take, { ...base, format: "mp3" }),
    );
  });
});
