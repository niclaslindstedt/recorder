// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  dayKey,
  formatContainer,
  formatDay,
  formatDuration,
  formatRate,
  formatSpan,
  formatTimer,
  groupByDay,
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

describe("groupByDay", () => {
  const at = (d: number, h: number) => ({
    createdAt: new Date(2026, 2, d, h).toISOString(),
  });

  it("keys a local day, not a UTC one", () => {
    expect(dayKey(new Date(2026, 2, 10, 0, 5).toISOString())).toBe(
      "2026-03-10",
    );
    expect(dayKey(new Date(2026, 2, 10, 23, 55).toISOString())).toBe(
      "2026-03-10",
    );
  });

  it("runs a newest-first list into one group per day", () => {
    const list = [at(10, 15), at(10, 9), at(9, 23), at(6, 12), at(6, 8)];
    const groups = groupByDay(list);
    expect(groups.map((g) => g.key)).toEqual([
      "2026-03-10",
      "2026-03-09",
      "2026-03-06",
    ]);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1, 2]);
  });

  it("has no group for an empty list", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("formatSpan", () => {
  const units = { hours: "h", minutes: "min" };
  const min = 60_000;

  it("says minutes under an hour, never zero", () => {
    expect(formatSpan(45 * min, units)).toBe("45 min");
    expect(formatSpan(10_000, units)).toBe("1 min");
    expect(formatSpan(-5, units)).toBe("1 min");
  });

  it("says hours and minutes under ten hours", () => {
    expect(formatSpan(200 * min, units)).toBe("3 h 20 min");
    expect(formatSpan(120 * min, units)).toBe("2 h");
  });

  it("rounds to hours past ten", () => {
    expect(formatSpan((23 * 60 + 41) * min, units)).toBe("23 h");
  });
});
