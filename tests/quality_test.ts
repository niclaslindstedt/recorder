// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  QUALITY_PRESETS,
  bytesPerMinute,
  bytesPerSecond,
  presetFor,
  qualityLevel,
  recordingTimeLeft,
} from "../src/app/quality.ts";

describe("quality presets", () => {
  it("names the settings a preset amounts to", () => {
    expect(presetFor({ recordingKind: "compact", recordingBitrate: 64 })).toBe(
      "memo",
    );
    expect(presetFor({ recordingKind: "compact", recordingBitrate: 128 })).toBe(
      "standard",
    );
    expect(presetFor({ recordingKind: "compact", recordingBitrate: 256 })).toBe(
      "high",
    );
  });

  it("calls any lossless take Lossless, whatever bitrate is remembered", () => {
    expect(
      presetFor({ recordingKind: "lossless", recordingBitrate: 320 }),
    ).toBe("lossless");
  });

  it("names none for a bitrate only the fine-tune row offers", () => {
    for (const bitrate of [96, 192, 320] as const)
      expect(
        presetFor({ recordingKind: "compact", recordingBitrate: bitrate }),
      ).toBeNull();
  });

  it("round-trips every preset through the settings it sets", () => {
    for (const p of QUALITY_PRESETS)
      expect(
        presetFor({ recordingKind: p.kind, recordingBitrate: p.bitrate }),
      ).toBe(p.id);
  });

  it("grows in size down the list", () => {
    const sizes = QUALITY_PRESETS.map((p) => bytesPerMinute(p.kind, p.bitrate));
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
  });

  it("sizes a compact minute by its bitrate", () => {
    expect(bytesPerMinute("compact", 128)).toBe(960_000);
    expect(bytesPerMinute("compact", 64)).toBe(480_000);
  });

  it("sizes a lossless minute as 48 kHz mono 16-bit FLAC", () => {
    const mb = bytesPerMinute("lossless", 0) / 1_000_000;
    expect(mb).toBeGreaterThan(3);
    expect(mb).toBeLessThan(4);
  });
});

describe("recording time left", () => {
  it("divides the room left by what a second takes", () => {
    expect(bytesPerSecond("compact", 128)).toBe(16_000);
    // A gigabyte at 128 kbit/s: about seventeen hours.
    const ms = recordingTimeLeft(1e9, "compact", 128)!;
    expect(ms / 3_600_000).toBeCloseTo(17.36, 1);
  });

  it("is far shorter for a lossless take", () => {
    const compact = recordingTimeLeft(1e9, "compact", 128)!;
    const lossless = recordingTimeLeft(1e9, "lossless", 128)!;
    expect(lossless).toBeLessThan(compact / 3);
  });

  it("says nothing when the browser does not", () => {
    expect(recordingTimeLeft(null, "compact", 128)).toBeNull();
    expect(recordingTimeLeft(Number.NaN, "compact", 128)).toBeNull();
    expect(recordingTimeLeft(-1, "compact", 128)).toBeNull();
  });
});

describe("qualityLevel", () => {
  it("fills one bar per preset step, all four for lossless", () => {
    expect(QUALITY_PRESETS.map((p) => qualityLevel(p.kind, p.bitrate))).toEqual(
      [1, 2, 3, 4],
    );
  });

  it("puts a custom bitrate on the step it reaches", () => {
    expect(qualityLevel("compact", 96)).toBe(1);
    expect(qualityLevel("compact", 192)).toBe(2);
    expect(qualityLevel("compact", 320)).toBe(3);
  });
});
