// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { mergeDocs } from "../src/app/merge.ts";
import {
  isFileName,
  normalizeDoc,
  parseDoc,
  serializeDoc,
} from "../src/app/migrations.ts";
import { DOC_VERSION, emptyDoc } from "../src/app/types.ts";
import { doc, folder, recording } from "./fixtures/helpers.ts";

describe("parseDoc / serializeDoc", () => {
  it("round-trips a document, keys sorted", () => {
    const d = doc(
      [
        recording({ id: "zz" }),
        recording({ id: "aa", favorite: true, notes: "hi" }),
      ],
      [folder({ id: "f" })],
    );
    const text = serializeDoc(d);
    expect(text.indexOf('"aa"')).toBeLessThan(text.indexOf('"zz"'));
    expect(parseDoc(text)).toEqual(d);
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });

  it("reads an empty or foreign document as empty", () => {
    expect(parseDoc("{}")).toEqual(emptyDoc());
    expect(parseDoc("[]")).toEqual(emptyDoc());
    expect(() => parseDoc("not json")).toThrow();
    expect(normalizeDoc(null)).toEqual(emptyDoc());
  });

  it("drops what it cannot read and clamps the rest", () => {
    const d = normalizeDoc({
      version: DOC_VERSION,
      folders: { f1: { name: "Ok" }, f2: { name: "" }, f3: 7 },
      recordings: {
        r1: {
          fileName: "r1.webm",
          title: "x".repeat(300),
          peaks: [2, -1, "a"],
          channels: 0,
        },
        r2: { fileName: "../etc/passwd" },
        r3: {
          fileName: "r3.flac",
          kind: "lossless",
          deletedAt: "2026-01-01T00:00:00.000Z",
        },
        r4: "nope",
      },
    });
    expect(Object.keys(d.folders)).toEqual(["f1"]);
    expect(d.folders.f1).toMatchObject({
      name: "Ok",
      parentId: null,
      order: 0,
    });
    expect(Object.keys(d.recordings).sort()).toEqual(["r1", "r3"]);
    expect(d.recordings.r1?.title).toHaveLength(200);
    expect(d.recordings.r1?.peaks).toEqual([1, 0, 0]);
    expect(d.recordings.r1?.channels).toBe(1);
    expect(d.recordings.r1?.kind).toBe("compact");
    expect(d.recordings.r3?.kind).toBe("lossless");
    expect(d.recordings.r3?.deletedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("keeps a deleted folder's tombstone even without a name", () => {
    const d = normalizeDoc({
      folders: { f: { name: "", deletedAt: "2026-01-01T00:00:00.000Z" } },
    });
    expect(d.folders.f?.deletedAt).toBeTruthy();
  });

  it("pins the file name shape", () => {
    expect(isFileName("abc123.webm")).toBe(true);
    expect(isFileName("a.m4a")).toBe(true);
    expect(isFileName("A.webm")).toBe(false);
    expect(isFileName("a/b.webm")).toBe(false);
    expect(isFileName("a.webm.exe")).toBe(false);
    expect(isFileName("")).toBe(false);
  });
});

describe("mergeDocs", () => {
  it("keeps both sides' records and takes the later edit", () => {
    const mine = doc([
      recording({
        id: "a",
        title: "Mine",
        updatedAt: "2026-03-10T10:00:00.000Z",
      }),
      recording({ id: "b" }),
    ]);
    const theirs = doc(
      [
        recording({
          id: "a",
          title: "Theirs",
          updatedAt: "2026-03-10T11:00:00.000Z",
        }),
        recording({ id: "c" }),
      ],
      [folder({ id: "f" })],
    );
    const merged = mergeDocs(mine, theirs);
    expect(Object.keys(merged.recordings).sort()).toEqual(["a", "b", "c"]);
    expect(merged.recordings.a?.title).toBe("Theirs");
    expect(merged.folders.f).toBeTruthy();
  });

  it("lets a deletion win over an older copy, and a later edit win over a deletion", () => {
    const deleted = recording({
      id: "a",
      deletedAt: "2026-03-10T12:00:00.000Z",
      updatedAt: "2026-03-10T12:00:00.000Z",
    });
    const stale = recording({ id: "a", updatedAt: "2026-03-10T10:00:00.000Z" });
    expect(
      mergeDocs(doc([stale]), doc([deleted])).recordings.a?.deletedAt,
    ).toBeTruthy();
    expect(
      mergeDocs(doc([deleted]), doc([stale])).recordings.a?.deletedAt,
    ).toBeTruthy();
    const edited = recording({
      id: "a",
      title: "Kept",
      updatedAt: "2026-03-10T13:00:00.000Z",
    });
    expect(
      mergeDocs(doc([deleted]), doc([edited])).recordings.a?.deletedAt,
    ).toBeUndefined();
  });
});
