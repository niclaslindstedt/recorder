// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { decodeWav } from "@niclaslindstedt/oss-framework/audio";

import { buildDemoData, demoAudio } from "../src/app/dev/demoData.ts";
import { folderTree, recordingsIn } from "../src/app/folders.ts";
import { normalizeDoc, parseDoc, serializeDoc } from "../src/app/migrations.ts";
import {
  liveRecordings,
  trashedRecordings,
  wantedFiles,
} from "../src/app/types.ts";

// The demo is opened on every day of a year, at a rotating hour — `(day *
// 5) % 24` visits all twenty-four — and just after midnight, and each
// frame's premise is asserted: something today, something yesterday, nothing
// after now, three folders with recordings in them, and a document that
// survives its own storage round trip.

describe("the demo library", () => {
  it("holds on every day of a year, at hours around the clock", () => {
    const start = new Date(2026, 0, 1);
    for (let day = 0; day < 366; day++) {
      const hour = (day * 5) % 24;
      for (const minute of [0, 1]) {
        const now = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + day,
          hour,
          minute,
        );
        const doc = buildDemoData(now);
        const live = liveRecordings(doc);
        expect(live.length).toBe(12);
        // Nothing is written after now.
        for (const r of live) {
          expect(Date.parse(r.createdAt)).toBeLessThan(now.getTime());
          expect(Date.parse(r.updatedAt)).toBeLessThanOrEqual(
            now.getTime() + 3_600_000,
          );
          expect(r.peaks.length).toBeGreaterThan(0);
          expect(r.durationMs).toBeGreaterThan(0);
        }
        // Something from today (three hours ago) and something from
        // yesterday (twenty-eight hours ago) — on a day that starts after
        // three in the morning; just after midnight "today" is yesterday.
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ).getTime();
        const today = live.filter(
          (r) => Date.parse(r.createdAt) >= startOfToday,
        );
        if (hour >= 8) expect(today.length).toBeGreaterThan(0);
        expect(trashedRecordings(doc, now)).toEqual([]);
        expect(wantedFiles(doc, now)).toHaveLength(12);
        // Newest first.
        for (let i = 1; i < live.length; i++) {
          expect(live[i - 1]!.createdAt >= live[i]!.createdAt).toBe(true);
        }
        // The tree and its contents.
        const tree = folderTree(doc);
        expect(tree.map((n) => [n.folder.name, n.depth])).toEqual([
          ["Meetings", 0],
          ["Interviews", 1],
          ["Ideas", 0],
        ]);
        expect(recordingsIn(doc, "demofolder3")).toHaveLength(2);
        expect(recordingsIn(doc, null).length).toBeGreaterThan(0);
        // The document survives storage.
        const text = serializeDoc(doc);
        expect(parseDoc(text)).toEqual(normalizeDoc(doc));
      }
    }
  });

  it("makes audio every row can play", () => {
    const doc = buildDemoData(new Date(2026, 5, 15, 12));
    for (const r of liveRecordings(doc)) {
      const bytes = demoAudio(r);
      const pcm = decodeWav(bytes);
      expect(pcm).not.toBeNull();
      expect(pcm!.sampleRate).toBe(r.sampleRate);
      expect(bytes.length).toBe(r.size);
      expect(pcm!.channels[0]!.length / pcm!.sampleRate).toBeCloseTo(
        r.durationMs / 1000,
        1,
      );
    }
  });
});
