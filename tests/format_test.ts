// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  formatContainer,
  formatDay,
  formatDuration,
  formatRate,
  formatTimer,
} from "../src/app/format.ts";

describe("durations", () => {
  it("prints m:ss and h:mm:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_599_400)).toBe("59:59");
    expect(formatDuration(3_600_000)).toBe("1:00:00");
    expect(formatDuration(-5)).toBe("0:00");
  });

  it("ticks the timer in tenths", () => {
    expect(formatTimer(0)).toBe("0:00.0");
    expect(formatTimer(12_345)).toBe("0:12.3");
    expect(formatTimer(61_999)).toBe("1:01.9");
  });
});

describe("formatDay", () => {
  const labels = { today: "Today", yesterday: "Yesterday" };
  const now = new Date(2026, 2, 10, 15, 0);

  it("says today and yesterday, then the weekday, then the date", () => {
    expect(
      formatDay(new Date(2026, 2, 10, 9).toISOString(), now, "en-US", labels),
    ).toBe("Today");
    expect(
      formatDay(new Date(2026, 2, 9, 23).toISOString(), now, "en-US", labels),
    ).toBe("Yesterday");
    expect(
      formatDay(new Date(2026, 2, 6).toISOString(), now, "en-US", labels),
    ).toBe("Friday");
    expect(
      formatDay(new Date(2026, 1, 1).toISOString(), now, "en-US", labels),
    ).toBe("Feb 1");
    expect(
      formatDay(new Date(2025, 11, 24).toISOString(), now, "en-US", labels),
    ).toBe("Dec 24, 2025");
  });
});

describe("names", () => {
  it("names a container and a rate", () => {
    expect(formatContainer("audio/webm;codecs=opus")).toBe("Opus");
    expect(formatContainer("audio/mp4")).toBe("AAC");
    expect(formatContainer("audio/flac")).toBe("FLAC");
    expect(formatContainer("")).toBe("—");
    expect(formatRate(48000)).toBe("48 kHz");
    expect(formatRate(44100)).toBe("44.1 kHz");
    expect(formatRate(0)).toBe("—");
  });
});
