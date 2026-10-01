// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  LISTEN_WINDOW_MS,
  SILENT_DB,
  pushReading,
  readAmbient,
  verdictFor,
  type Reading,
} from "../src/app/levels.ts";
import { targetRange } from "../src/app/target.ts";

const reading = (at: number, over: Partial<Reading> = {}): Reading => ({
  at,
  levelDb: -40,
  peakDb: -30,
  clipping: false,
  ...over,
});

/** A room: a hum at `floor` with a voice peaking at `peak` every second. */
function room(floor: number, peak: number, ms = 3000): Reading[] {
  let w: Reading[] = [];
  for (let at = 0; at <= ms; at += 50) {
    const speaking = at % 1000 < 300;
    w = pushReading(
      w,
      reading(at, {
        levelDb: speaking ? peak - 8 : floor,
        peakDb: speaking ? peak : floor + 3,
      }),
    );
  }
  return w;
}

describe("the listening window", () => {
  it("keeps only the last few seconds", () => {
    let w: Reading[] = [];
    for (let at = 0; at <= 10_000; at += 100) w = pushReading(w, reading(at));
    expect(w[0]!.at).toBe(10_000 - LISTEN_WINDOW_MS);
    expect(w[w.length - 1]!.at).toBe(10_000);
  });

  it("does not touch the window it is handed", () => {
    const w = [reading(0)];
    pushReading(w, reading(100));
    expect(w).toHaveLength(1);
  });

  it("has nothing to say before the first reading", () => {
    expect(readAmbient([])).toBeNull();
  });
});

describe("reading a room", () => {
  it("takes the noise floor from the pauses, not the words", () => {
    const a = readAmbient(room(-55, -10))!;
    expect(a.roomDb).toBe(-55);
    expect(a.peakDb).toBe(-10);
    expect(a.headroomDb).toBe(10);
  });

  it("calls a voice peaking at −10 a good level", () => {
    expect(readAmbient(room(-55, -10))!.verdict).toBe("good");
  });

  it("calls a distant voice too quiet", () => {
    expect(readAmbient(room(-60, -30))!.verdict).toBe("quiet");
  });

  it("warns before clipping, and says clipping once it has", () => {
    expect(readAmbient(room(-50, -4))!.verdict).toBe("loud");
    expect(readAmbient(room(-50, -1))!.verdict).toBe("hot");
    const clipped = pushReading(
      room(-50, -1),
      reading(3100, { clipping: true }),
    );
    expect(readAmbient(clipped)!.verdict).toBe("clipping");
  });

  it("forgets a clip once it leaves the window", () => {
    let w = pushReading([], reading(0, { clipping: true, peakDb: 0 }));
    for (let at = 100; at <= LISTEN_WINDOW_MS + 500; at += 100)
      w = pushReading(w, reading(at, { peakDb: -12, levelDb: -20 }));
    expect(readAmbient(w)!.verdict).toBe("good");
  });

  it("says silent when nothing reaches the meter", () => {
    expect(verdictFor(SILENT_DB, false)).toBe("silent");
    expect(verdictFor(-60, false)).toBe("silent");
    expect(verdictFor(-45, false)).toBe("quiet");
  });

  it("never reports negative headroom", () => {
    const w = [reading(0, { peakDb: 0.4, clipping: true })];
    expect(readAmbient(w)!.headroomDb).toBe(0);
  });
});

describe("the verdict against a target", () => {
  const voice = targetRange("voice", { lowDb: -18, highDb: -6 });
  const music = targetRange("music", voice);
  const ambience = targetRange("ambience", voice);

  it("reads Voice exactly as the meter's own zones", () => {
    for (const peak of [-45, -19, -18, -12, -6, -5, -4, -3, -1]) {
      expect(verdictFor(peak, false, voice)).toBe(verdictFor(peak, false));
    }
  });

  it("calls the same room too quiet for music and good for a voice", () => {
    const w = room(-55, -15);
    expect(readAmbient(w, voice)!.verdict).toBe("good");
    expect(readAmbient(w, music)!.verdict).toBe("quiet");
  });

  it("calls birdsong at −24 good for ambience, and a voice over it", () => {
    expect(readAmbient(room(-58, -24), ambience)!.verdict).toBe("good");
    expect(readAmbient(room(-55, -10), ambience)!.verdict).toBe("loud");
  });

  it("keeps hot and clipping the framework's, whatever the target", () => {
    const wide = targetRange("custom", { lowDb: -40, highDb: -3 });
    expect(verdictFor(-2, false, wide)).toBe("hot");
    expect(verdictFor(-20, true, wide)).toBe("clipping");
  });

  it("still says silent under any target's floor", () => {
    const lowest = targetRange("custom", { lowDb: -48, highDb: -30 });
    expect(verdictFor(SILENT_DB, false, lowest)).toBe("silent");
    expect(verdictFor(-49, false, lowest)).toBe("quiet");
    expect(verdictFor(-40, false, lowest)).toBe("good");
  });
});
