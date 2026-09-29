// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  addFolder,
  canNest,
  countIn,
  deleteFolder,
  folderPath,
  folderTree,
  moveFolder,
  patchRecording,
  purgeRecording,
  recordingsIn,
  reorderFolders,
  restoreRecording,
  trashRecording,
} from "../src/app/folders.ts";
import {
  liveRecordings,
  purgeAfter,
  trashedRecordings,
  wantedFiles,
} from "../src/app/types.ts";
import { ctx, doc, folder, recording } from "./fixtures/helpers.ts";

describe("the folder tree", () => {
  it("nests, orders and flattens", () => {
    const c = ctx();
    let d = doc();
    const work = addFolder(d, "Work", null, c);
    d = work.data;
    const home = addFolder(d, "Home", null, c);
    d = home.data;
    const meetings = addFolder(d, "Meetings", work.folder.id, c);
    d = meetings.data;
    expect(folderTree(d).map((n) => [n.folder.name, n.depth])).toEqual([
      ["Work", 0],
      ["Meetings", 1],
      ["Home", 0],
    ]);
    d = reorderFolders(d, null, [home.folder.id, work.folder.id], c);
    expect(folderTree(d).map((n) => n.folder.name)).toEqual([
      "Home",
      "Work",
      "Meetings",
    ]);
    expect(folderPath(d, meetings.folder.id).map((f) => f.name)).toEqual([
      "Work",
      "Meetings",
    ]);
  });

  it("refuses to move a folder into itself or under itself", () => {
    const c = ctx();
    let d = doc();
    const a = addFolder(d, "A", null, c);
    d = a.data;
    const b = addFolder(d, "B", a.folder.id, c);
    d = b.data;
    expect(canNest(d, a.folder.id, b.folder.id)).toBe(false);
    expect(canNest(d, a.folder.id, a.folder.id)).toBe(false);
    expect(canNest(d, b.folder.id, null)).toBe(true);
    expect(moveFolder(d, a.folder.id, b.folder.id, c)).toBe(d);
    const moved = moveFolder(d, b.folder.id, null, c);
    expect(moved.folders[b.folder.id]?.parentId).toBeNull();
  });

  it("deleting a folder lifts what was in it to its parent", () => {
    const c = ctx();
    const work = folder({ id: "work" });
    const sub = folder({ id: "sub", name: "Sub", parentId: "work" });
    const r = recording({ id: "r1", folderId: "sub" });
    let d = doc([r], [work, sub]);
    expect(countIn(d, "work")).toBe(1);
    d = deleteFolder(d, "sub", c);
    expect(d.folders.sub?.deletedAt).toBeTruthy();
    expect(d.recordings.r1?.folderId).toBe("work");
    expect(recordingsIn(d, "work").map((x) => x.id)).toEqual(["r1"]);
    d = deleteFolder(d, "work", c);
    expect(d.recordings.r1?.folderId).toBeNull();
    expect(recordingsIn(d, null).map((x) => x.id)).toEqual(["r1"]);
  });

  it("shows a recording whose folder is gone at the top level", () => {
    const d = doc([recording({ id: "r1", folderId: "missing" })]);
    expect(recordingsIn(d, null).map((x) => x.id)).toEqual(["r1"]);
    expect(folderPath(d, "missing")).toEqual([]);
  });
});

describe("the trash", () => {
  const now = new Date("2026-04-01T12:00:00.000Z");

  it("keeps a deleted recording for thirty days, then wants its file gone", () => {
    const c = ctx("2026-04-01T11:00:00.000Z");
    let d = doc([recording({ id: "r1" }), recording({ id: "r2" })]);
    d = trashRecording(d, "r1", c);
    expect(liveRecordings(d).map((r) => r.id)).toEqual(["r2"]);
    expect(trashedRecordings(d, now).map((r) => r.id)).toEqual(["r1"]);
    expect(wantedFiles(d, now).sort()).toEqual(["r1.webm", "r2.webm"]);
    const later = new Date(now.getTime() + 31 * 86_400_000);
    expect(trashedRecordings(d, later)).toEqual([]);
    expect(wantedFiles(d, later)).toEqual(["r2.webm"]);
    // Still a tombstone, so another device learns of the deletion…
    expect(purgeAfter(d, later).recordings.r1).toBeTruthy();
    // …until the tombstone itself ages out.
    const long = new Date(now.getTime() + 125 * 86_400_000);
    expect(purgeAfter(d, long).recordings.r1).toBeUndefined();
    expect(purgeAfter(d, long).recordings.r2).toBeTruthy();
  });

  it("restores, and purges for good", () => {
    const c = ctx("2026-04-01T11:00:00.000Z");
    let d = doc([recording({ id: "r1" })]);
    d = trashRecording(d, "r1", c);
    d = restoreRecording(d, "r1", c);
    expect(d.recordings.r1?.deletedAt).toBeUndefined();
    expect(liveRecordings(d)).toHaveLength(1);
    d = purgeRecording(d, "r1", c);
    expect(trashedRecordings(d, now)).toEqual([]);
    expect(wantedFiles(d, now)).toEqual([]);
    expect(d.recordings.r1).toBeTruthy();
  });

  it("patches a recording and stamps the edit", () => {
    const c = ctx("2026-04-01T11:00:00.000Z");
    let d = doc([recording({ id: "r1" })]);
    d = patchRecording(d, "r1", { title: "  Renamed ", favorite: true }, c);
    expect(d.recordings.r1?.title).toBe("Renamed");
    expect(d.recordings.r1?.favorite).toBe(true);
    expect(d.recordings.r1?.updatedAt).toBe("2026-04-01T11:01:00.000Z");
    expect(patchRecording(d, "nope", { title: "x" }, c)).toBe(d);
  });
});
