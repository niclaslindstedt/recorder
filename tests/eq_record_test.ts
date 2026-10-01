// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The EQ as a fact about a recording: what a take starts with, how one is
// set and taken off, that it survives storage and a sync, and that an
// export is encoded through it.
import { describe, expect, it } from "vitest";

import { decodeWav } from "@niclaslindstedt/oss-framework/audio";

import { FLAT_EQ, withGain, withPreset } from "../src/app/eq.ts";
import { encodeExport } from "../src/app/export.ts";
import { setRecordingEq } from "../src/app/folders.ts";
import { mergeDocs } from "../src/app/merge.ts";
import { parseDoc, serializeDoc } from "../src/app/migrations.ts";
import { finishTake } from "../src/app/takes.ts";
import { DEFAULT_SETTINGS, parseSettings } from "../src/app/useAppSettings.ts";
import { ctx, doc, recording } from "./fixtures/helpers.ts";

const podcast = { ...withPreset(null, "podcast"), lowCut: true };

const take = {
  mode: "encoded" as const,
  blob: new Blob([new Uint8Array(10)], { type: "audio/webm" }),
  mimeType: "audio/webm",
  pcm: null,
  durationMs: 1000,
  sampleRate: 48000,
  channels: 1,
  peaks: [],
  clipCount: 0,
  maxPeakDb: -10,
};

describe("a take's EQ", () => {
  it("starts with the Record screen's EQ, and with none when that is flat", () => {
    const eqd = finishTake(take, {
      title: "a",
      folderId: null,
      ctx: ctx(),
      eq: podcast,
    }).recording;
    expect(eqd.eq).toEqual(podcast);
    for (const eq of [null, undefined, FLAT_EQ]) {
      const plain = finishTake(take, {
        title: "b",
        folderId: null,
        ctx: ctx(),
        eq,
      }).recording;
      expect("eq" in plain).toBe(false);
    }
  });
});

describe("setting a recording's EQ", () => {
  it("sets it, stamps the record, and takes it off again", () => {
    const c = ctx("2026-04-02T08:00:00.000Z");
    const d0 = doc([recording({ id: "r" })]);
    const d1 = setRecordingEq(d0, "r", podcast, c);
    expect(d1.recordings.r!.eq).toEqual(podcast);
    expect(d1.recordings.r!.updatedAt).toBe("2026-04-02T08:01:00.000Z");
    const d2 = setRecordingEq(d1, "r", FLAT_EQ, c);
    expect("eq" in d2.recordings.r!).toBe(false);
    expect(d2.recordings.r!.updatedAt).toBe("2026-04-02T08:02:00.000Z");
  });

  it("changes nothing when the EQ is what it was", () => {
    const d = doc([recording({ id: "r", eq: podcast })]);
    expect(setRecordingEq(d, "r", { ...podcast }, ctx())).toBe(d);
    expect(setRecordingEq(d, "missing", podcast, ctx())).toBe(d);
    const flat = doc([recording({ id: "r" })]);
    expect(setRecordingEq(flat, "r", null, ctx())).toBe(flat);
  });

  it("survives storage, and drops what cannot be read", () => {
    const d = doc([recording({ id: "r", eq: podcast })]);
    expect(parseDoc(serializeDoc(d))).toEqual(d);
    const odd = parseDoc(
      JSON.stringify({
        version: 1,
        recordings: {
          r: { ...recording({ id: "r" }), eq: { gains: { bass: 99 } } },
          s: { ...recording({ id: "s", fileName: "s.webm" }), eq: "loud" },
        },
      }),
    );
    expect(odd.recordings.r!.eq).toEqual(withGain(FLAT_EQ, "bass", 12));
    expect("eq" in odd.recordings.s!).toBe(false);
  });

  it("goes with the later edit in a sync, taken off included", () => {
    const c = ctx("2026-04-02T08:00:00.000Z");
    const base = doc([recording({ id: "r", eq: podcast })]);
    const off = setRecordingEq(base, "r", null, c); // 08:01
    const renamed = doc([
      {
        ...base.recordings.r!,
        title: "Older",
        updatedAt: "2026-04-02T07:00:00.000Z",
      },
    ]);
    expect("eq" in mergeDocs(off, renamed).recordings.r!).toBe(false);
    expect("eq" in mergeDocs(renamed, off).recordings.r!).toBe(false);
  });
});

describe("the Record screen's EQ setting", () => {
  it("is flat until set, and keeps a valid one", () => {
    expect(DEFAULT_SETTINGS.recordEq).toBeNull();
    expect(
      parseSettings(JSON.stringify({ recordEq: podcast })).recordEq,
    ).toEqual(podcast);
    expect(
      parseSettings(JSON.stringify({ recordEq: FLAT_EQ })).recordEq,
    ).toBeNull();
    expect(parseSettings(JSON.stringify({ recordEq: 7 })).recordEq).toBeNull();
  });
});

describe("an export through the EQ", () => {
  it("is encoded from the samples the EQ makes", async () => {
    const rate = 48000;
    const n = rate / 2;
    const tone = new Float32Array(n);
    for (let i = 0; i < n; i++)
      tone[i] = 0.25 * Math.sin((2 * Math.PI * 1000 * i) / rate);
    const pcm = { sampleRate: rate, channels: [tone] };
    const options = {
      format: "wav" as const,
      wavDepth: 32 as const,
      flacLevel: 5 as const,
      mp3Bitrate: 128 as const,
      rate: 0 as const,
      mono: true,
    };
    const level = (bytes: Uint8Array) => {
      const s = decodeWav(bytes)!.channels[0]!;
      let sum = 0;
      for (let i = s.length / 2; i < s.length; i++) sum += s[i]! ** 2;
      return 10 * Math.log10(sum / (s.length / 2));
    };
    const dry = await encodeExport(pcm, options);
    const cut = await encodeExport(pcm, options, withGain(FLAT_EQ, "mids", -6));
    expect(level(cut.bytes) - level(dry.bytes)).toBeCloseTo(-6, 0);
    const none = await encodeExport(pcm, options, null);
    expect(none.bytes).toEqual(dry.bytes);
  });
});
