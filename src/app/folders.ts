// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The folder tree, read: which folders are under which, what a folder holds
// and how many, where a folder may be moved, and the edits as pure
// functions from a document to a new one. Ids and the `updatedAt` stamp
// come in through `ctx`, so nothing here touches chance or the clock.

import { normalizeEq, sameEq, type Eq } from "./eq.ts";
import {
  liveFolders,
  liveRecordings,
  type AppData,
  type Folder,
  type Recording,
} from "./types.ts";

export type Ctx = { id: () => string; now: () => string };

/** The folders under each parent, ordered by `order` then name. `null` is
 *  the top level. */
export function childrenByParent(data: AppData): Map<string | null, Folder[]> {
  const out = new Map<string | null, Folder[]>();
  const live = liveFolders(data);
  const ids = new Set(live.map((f) => f.id));
  for (const folder of live) {
    // A folder whose parent is gone sits at the top rather than vanishing.
    const parent =
      folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    const list = out.get(parent) ?? [];
    list.push(folder);
    out.set(parent, list);
  }
  for (const list of out.values()) {
    list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }
  return out;
}

/** The tree flattened, depth first, each folder with its depth. */
export function folderTree(
  data: AppData,
): Array<{ folder: Folder; depth: number }> {
  const children = childrenByParent(data);
  const out: Array<{ folder: Folder; depth: number }> = [];
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const folder of children.get(parent) ?? []) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      out.push({ folder, depth });
      walk(folder.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}

/** A folder and every folder under it. */
export function subtreeIds(data: AppData, id: string): Set<string> {
  const children = childrenByParent(data);
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const at = stack.pop()!;
    for (const child of children.get(at) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}

/** Whether `id` may be moved under `parentId`: not into itself or a folder
 *  under it. */
export function canNest(
  data: AppData,
  id: string,
  parentId: string | null,
): boolean {
  if (parentId === null) return true;
  if (!data.folders[parentId] || data.folders[parentId].deletedAt) return false;
  return !subtreeIds(data, id).has(parentId);
}

/** The recordings filed in one folder, newest first — the folder itself,
 *  not what is under it. `null` is the top level, where a recording whose
 *  folder is gone also shows. */
export function recordingsIn(
  data: AppData,
  folderId: string | null,
): Recording[] {
  const ids = new Set(liveFolders(data).map((f) => f.id));
  return liveRecordings(data).filter((r) => {
    const at = r.folderId && ids.has(r.folderId) ? r.folderId : null;
    return at === folderId;
  });
}

/** How many recordings are in a folder and everything under it. */
export function countIn(data: AppData, folderId: string): number {
  const ids = subtreeIds(data, folderId);
  return liveRecordings(data).filter((r) => r.folderId && ids.has(r.folderId))
    .length;
}

/** The names from the top down to a folder, for a heading. */
export function folderPath(data: AppData, folderId: string | null): Folder[] {
  const out: Folder[] = [];
  const seen = new Set<string>();
  let at = folderId;
  while (at && !seen.has(at)) {
    seen.add(at);
    const folder = data.folders[at];
    if (!folder || folder.deletedAt) break;
    out.unshift(folder);
    at = folder.parentId;
  }
  return out;
}

// --- the edits ------------------------------------------------------------------

/** Make a folder under `parentId`, last among its siblings. */
export function addFolder(
  data: AppData,
  name: string,
  parentId: string | null,
  ctx: Ctx,
): { data: AppData; folder: Folder } {
  const siblings = childrenByParent(data).get(parentId) ?? [];
  const folder: Folder = {
    id: ctx.id(),
    name: name.trim(),
    parentId,
    order: (siblings[siblings.length - 1]?.order ?? -1) + 1,
    updatedAt: ctx.now(),
  };
  return {
    data: { ...data, folders: { ...data.folders, [folder.id]: folder } },
    folder,
  };
}

export function renameFolder(
  data: AppData,
  id: string,
  name: string,
  ctx: Ctx,
): AppData {
  const folder = data.folders[id];
  if (!folder || folder.name === name.trim()) return data;
  return {
    ...data,
    folders: {
      ...data.folders,
      [id]: { ...folder, name: name.trim(), updatedAt: ctx.now() },
    },
  };
}

/** Move a folder under another (or to the top). Refused where it would
 *  nest inside itself. */
export function moveFolder(
  data: AppData,
  id: string,
  parentId: string | null,
  ctx: Ctx,
): AppData {
  const folder = data.folders[id];
  if (!folder || folder.parentId === parentId || !canNest(data, id, parentId))
    return data;
  const siblings = childrenByParent(data).get(parentId) ?? [];
  return {
    ...data,
    folders: {
      ...data.folders,
      [id]: {
        ...folder,
        parentId,
        order: (siblings[siblings.length - 1]?.order ?? -1) + 1,
        updatedAt: ctx.now(),
      },
    },
  };
}

/** Arrange a parent's folders in the given order. Ids not under that parent
 *  are ignored; folders left out keep their place after the named ones. */
export function reorderFolders(
  data: AppData,
  parentId: string | null,
  orderedIds: string[],
  ctx: Ctx,
): AppData {
  const siblings = childrenByParent(data).get(parentId) ?? [];
  const known = new Set(siblings.map((f) => f.id));
  const named = orderedIds.filter((id) => known.has(id));
  const rest = siblings.map((f) => f.id).filter((id) => !named.includes(id));
  const folders = { ...data.folders };
  const now = ctx.now();
  [...named, ...rest].forEach((id, order) => {
    const folder = folders[id];
    if (folder && folder.order !== order)
      folders[id] = { ...folder, order, updatedAt: now };
  });
  return { ...data, folders };
}

/** Delete a folder: what is under it — folders and recordings — moves up to
 *  its parent. Nothing is recorded over; a folder is a label. */
export function deleteFolder(data: AppData, id: string, ctx: Ctx): AppData {
  const folder = data.folders[id];
  if (!folder || folder.deletedAt) return data;
  const now = ctx.now();
  const folders = {
    ...data.folders,
    [id]: { ...folder, deletedAt: now, updatedAt: now },
  };
  for (const child of Object.values(data.folders)) {
    if (child.parentId === id && !child.deletedAt) {
      folders[child.id] = {
        ...child,
        parentId: folder.parentId,
        updatedAt: now,
      };
    }
  }
  const recordings = { ...data.recordings };
  for (const r of Object.values(data.recordings)) {
    if (r.folderId === id && !r.deletedAt) {
      recordings[r.id] = { ...r, folderId: folder.parentId, updatedAt: now };
    }
  }
  return { ...data, folders, recordings };
}

// --- recordings ------------------------------------------------------------------

export function saveRecording(data: AppData, recording: Recording): AppData {
  return {
    ...data,
    recordings: { ...data.recordings, [recording.id]: recording },
  };
}

export function patchRecording(
  data: AppData,
  id: string,
  patch: Partial<Pick<Recording, "title" | "folderId" | "favorite" | "notes">>,
  ctx: Ctx,
): AppData {
  const r = data.recordings[id];
  if (!r) return data;
  const next: Recording = { ...r, ...patch, updatedAt: ctx.now() };
  if (typeof patch.title === "string") next.title = patch.title.trim();
  return saveRecording(data, next);
}

/** Set the EQ a recording is heard and exported through; `null` (or a flat
 *  one) takes it off. The bytes are not touched. */
export function setRecordingEq(
  data: AppData,
  id: string,
  eq: Eq | null,
  ctx: Ctx,
): AppData {
  const r = data.recordings[id];
  if (!r) return data;
  const kept = normalizeEq(eq);
  if (sameEq(r.eq ?? null, kept)) return data;
  const next: Recording = { ...r, updatedAt: ctx.now() };
  if (kept) next.eq = kept;
  else delete next.eq;
  return saveRecording(data, next);
}

/** Put a recording in the trash. */
export function trashRecording(data: AppData, id: string, ctx: Ctx): AppData {
  const r = data.recordings[id];
  if (!r || r.deletedAt) return data;
  const now = ctx.now();
  return saveRecording(data, { ...r, deletedAt: now, updatedAt: now });
}

/** Take it back out. */
export function restoreRecording(data: AppData, id: string, ctx: Ctx): AppData {
  const r = data.recordings[id];
  if (!r || !r.deletedAt) return data;
  const rest = { ...r, updatedAt: ctx.now() };
  delete rest.deletedAt;
  return saveRecording(data, rest);
}

/** Delete it for good: the tombstone stays, dated so the file goes
 *  everywhere, but it leaves the trash at once. */
export function purgeRecording(data: AppData, id: string, ctx: Ctx): AppData {
  const r = data.recordings[id];
  if (!r) return data;
  // A date past the trash window: the file is unwanted from this moment.
  const long = new Date(Date.parse(ctx.now()) - 31 * 86_400_000).toISOString();
  return saveRecording(data, { ...r, deletedAt: long, updatedAt: ctx.now() });
}
