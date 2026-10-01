// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { METER_ZONES } from "@niclaslindstedt/oss-framework/audio";
import { describe, expect, it } from "vitest";

import {
  TARGET_IDS,
  TARGET_MAX_DB,
  TARGET_MIN_DB,
  TARGET_MIN_SPAN_DB,
  TARGET_PRESETS,
  clampTarget,
  formatTargetDb,
  targetRange,
  targetTone,
} from "../src/app/target.ts";
import { DEFAULT_SETTINGS, parseSettings } from "../src/app/useAppSettings.ts";

const voice = { lowDb: -18, highDb: -6 };

describe("the presets", () => {
  it("start with voice, which is the meter's own good zone", () => {
    const good = METER_ZONES.find((z) => z.tone === "good")!;
    const loud = METER_ZONES.find((z) => z.tone === "loud")!;
    expect(TARGET_PRESETS[0]).toEqual({
      id: "voice",
      lowDb: good.floorDb,
      highDb: loud.floorDb,
    });
  });

  it("all sit inside the bounds a custom range has to keep", () => {
    for (const p of TARGET_PRESETS) {
      expect(clampTarget(p.lowDb, p.highDb)).toEqual({
        lowDb: p.lowDb,
        highDb: p.highDb,
      });
    }
  });

  it("never reach into the framework's hot zone", () => {
    const hot = METER_ZONES.find((z) => z.tone === "hot")!;
    for (const p of TARGET_PRESETS) expect(p.highDb).toBeLessThan(hot.floorDb);
    expect(TARGET_MAX_DB).toBe(hot.floorDb);
  });

  it("are listed with Custom last", () => {
    expect(TARGET_IDS).toEqual([
      "voice",
      "music",
      "live",
      "ambience",
      "custom",
    ]);
  });
});

describe("a custom range", () => {
  it("keeps a sensible one as it is", () => {
    expect(clampTarget(-24, -9)).toEqual({ lowDb: -24, highDb: -9 });
  });

  it("is whole decibels", () => {
    expect(clampTarget(-24.4, -8.6)).toEqual({ lowDb: -24, highDb: -9 });
  });

  it("never tops out above −3", () => {
    expect(clampTarget(-12, 0)).toEqual({ lowDb: -12, highDb: TARGET_MAX_DB });
  });

  it("never floors out under the bound", () => {
    expect(clampTarget(-80, -20)).toEqual({
      lowDb: TARGET_MIN_DB,
      highDb: -20,
    });
  });

  it("keeps the floor the minimum span under the ceiling, the ceiling winning", () => {
    expect(clampTarget(-6, -6)).toEqual({
      lowDb: -6 - TARGET_MIN_SPAN_DB,
      highDb: -6,
    });
    expect(clampTarget(-4, -12)).toEqual({ lowDb: -15, highDb: -12 });
  });

  it("can be as low as the bounds allow and still have a span", () => {
    expect(clampTarget(-90, -90)).toEqual({
      lowDb: TARGET_MIN_DB,
      highDb: TARGET_MIN_DB + TARGET_MIN_SPAN_DB,
    });
  });

  it("falls back to voice for nonsense", () => {
    expect(clampTarget(Number.NaN, Number.POSITIVE_INFINITY)).toEqual(voice);
  });
});

describe("the range a choice stands for", () => {
  it("is a preset's own, whatever the custom one is", () => {
    expect(targetRange("music", { lowDb: -40, highDb: -30 })).toEqual({
      lowDb: -12,
      highDb: -6,
    });
  });

  it("is the custom one, clamped, for Custom", () => {
    expect(targetRange("custom", { lowDb: -40, highDb: 2 })).toEqual({
      lowDb: -40,
      highDb: -3,
    });
  });
});

describe("where a peak lands", () => {
  it("reads under, in and over against the range", () => {
    expect(targetTone(-30, false, voice)).toBe("under");
    expect(targetTone(-18.1, false, voice)).toBe("under");
    expect(targetTone(-18, false, voice)).toBe("in");
    expect(targetTone(-10, false, voice)).toBe("in");
    expect(targetTone(-6, false, voice)).toBe("in");
    expect(targetTone(-5.9, false, voice)).toBe("over");
    expect(targetTone(-3.1, false, voice)).toBe("over");
  });

  it("is hot from −3 up, and on a clip, whatever the range says", () => {
    const wide = { lowDb: -40, highDb: -3 };
    expect(targetTone(-3, false, wide)).toBe("hot");
    expect(targetTone(0, false, wide)).toBe("hot");
    expect(targetTone(-12, true, wide)).toBe("hot");
  });

  it("calls silence under", () => {
    expect(targetTone(Number.NEGATIVE_INFINITY, false, voice)).toBe("under");
  });

  it("moves with the preset: ambience is in where a voice is too quiet", () => {
    const ambience = targetRange("ambience", voice);
    expect(targetTone(-24, false, voice)).toBe("under");
    expect(targetTone(-24, false, ambience)).toBe("in");
    expect(targetTone(-10, false, ambience)).toBe("over");
  });
});

describe("the edge's label", () => {
  it("prints whole decibels with a real minus", () => {
    expect(formatTargetDb(-18)).toBe("−18");
    expect(formatTargetDb(-5.6)).toBe("−6");
    expect(formatTargetDb(0)).toBe("0");
  });
});

describe("the stored setting", () => {
  it("defaults to voice, with the custom range on voice's", () => {
    expect(DEFAULT_SETTINGS.levelTarget).toBe("voice");
    expect(parseSettings("{}")).toMatchObject({
      levelTarget: "voice",
      targetLowDb: -18,
      targetHighDb: -6,
    });
  });

  it("keeps a known choice and its custom range", () => {
    expect(
      parseSettings(
        JSON.stringify({
          levelTarget: "custom",
          targetLowDb: -30,
          targetHighDb: -9,
        }),
      ),
    ).toMatchObject({
      levelTarget: "custom",
      targetLowDb: -30,
      targetHighDb: -9,
    });
  });

  it("drops an unknown choice, and clamps a stored range", () => {
    expect(
      parseSettings(
        JSON.stringify({
          levelTarget: "podcast",
          targetLowDb: -100,
          targetHighDb: 6,
        }),
      ),
    ).toMatchObject({
      levelTarget: "voice",
      targetLowDb: TARGET_MIN_DB,
      targetHighDb: TARGET_MAX_DB,
    });
  });

  it("treats a range that is not numbers as missing", () => {
    expect(
      parseSettings(JSON.stringify({ targetLowDb: "-30", targetHighDb: null })),
    ).toMatchObject({ targetLowDb: -18, targetHighDb: -6 });
  });
});
