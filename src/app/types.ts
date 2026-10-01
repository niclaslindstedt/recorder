// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The document: what a space's recordings are, and the folders they are
// filed in. One document per space (`useNamespaces.ts`), held in IndexedDB
// beside the recordings' own bytes (`blobStore.ts`), synced as one file.
//
// Every record carries `updatedAt`, which is what the merge reads
// (`merge.ts`): two devices that recorded different things between syncs
// both keep them. A deletion is a *tombstone* rather than an absence —
// `deletedAt` set, the record kept — because the recording's file has to be
// removed everywhere the record reaches, and an absence cannot say so.
// "Recently deleted" is the tombstones younger than `TRASH_DAYS`; older ones
// lose their file and, later, the record itself (`purgeAfter`).

import type { Eq } from "./eq.ts";

/** The document's schema version. Bump it and append a step in
 *  `migrations.ts` for a change an old document cannot be read across. */
export const DOC_VERSION = 1;

/** How long a deleted recording can be brought back. */
export const TRASH_DAYS = 30;

/** How long a tombstone is kept after that, so a device that was away can
 *  still learn of the deletion rather than bring the recording back. */
export const TOMBSTONE_DAYS = 90;

/** A folder. Folders nest; `parentId` null is the top level. `order` is
 *  the position among its siblings, so the list can be arranged by hand. */
export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  updatedAt: string;
  deletedAt?: string | null;
};

/** How the bytes were kept: the browser's own encoder (`compact`), or the
 *  samples themselves, losslessly (`lossless`). What the export form and the
 *  details line say about a recording's quality. */
export type RecordingKind = "compact" | "lossless";

/** One recording. The bytes live in the blob store under `fileName`; what
 *  is here is what the list, the player and the sync need without them. */
export type Recording = {
  id: string;
  title: string;
  /** The folder it is filed in; null is the top level. */
  folderId: string | null;
  /** When the take started, ISO, local wall-clock in UTC. */
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  kind: RecordingKind;
  /** The container the bytes are in. */
  mimeType: string;
  /** The file the bytes are stored and synced as: `<id>.<ext>`. */
  fileName: string;
  /** The file's size, bytes. */
  size: number;
  /** The waveform thumbnail, 0…1 per bucket. */
  peaks: number[];
  favorite: boolean;
  /** A note the reader typed about it. */
  notes: string;
  /** How many frames clipped while it was taken, and the loudest peak —
   *  facts about the take, shown on its details. */
  clipCount: number;
  maxPeakDb: number;
  /** The equalizer it is heard and exported through (`eq.ts`). Absent is
   *  flat. Never written into the bytes: the take stays as it was heard. */
  eq?: Eq;
  deletedAt?: string | null;
};

export type AppData = {
  version: number;
  folders: Record<string, Folder>;
  recordings: Record<string, Recording>;
};

export function emptyDoc(): AppData {
  return { version: DOC_VERSION, folders: {}, recordings: {} };
}

/** The recordings that are not deleted, newest first. */
export function liveRecordings(data: AppData): Recording[] {
  return Object.values(data.recordings)
    .filter((r) => !r.deletedAt)
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    );
}

/** The recordings in the trash: deleted within `TRASH_DAYS` of `now`. */
export function trashedRecordings(data: AppData, now: Date): Recording[] {
  const floor = new Date(now.getTime() - TRASH_DAYS * 86_400_000).toISOString();
  return Object.values(data.recordings)
    .filter((r) => r.deletedAt && r.deletedAt >= floor)
    .sort((a, b) => (a.deletedAt! < b.deletedAt! ? 1 : -1));
}

/** The folders that are not deleted. */
export function liveFolders(data: AppData): Folder[] {
  return Object.values(data.folders).filter((f) => !f.deletedAt);
}

/** The files the document names — what the sync keeps in step, and what
 *  the blob store keeps. A deleted recording's file is not wanted once it
 *  has left the trash. */
export function wantedFiles(data: AppData, now: Date): string[] {
  const floor = new Date(now.getTime() - TRASH_DAYS * 86_400_000).toISOString();
  return Object.values(data.recordings)
    .filter((r) => !r.deletedAt || r.deletedAt >= floor)
    .map((r) => r.fileName);
}

/** Drop the tombstones old enough that no device is expected to still hold
 *  the recording. Pure: returns the same document when there is nothing to
 *  drop. */
export function purgeAfter(data: AppData, now: Date): AppData {
  const floor = new Date(
    now.getTime() - (TRASH_DAYS + TOMBSTONE_DAYS) * 86_400_000,
  ).toISOString();
  let changed = false;
  const recordings: AppData["recordings"] = {};
  for (const [id, r] of Object.entries(data.recordings)) {
    if (r.deletedAt && r.deletedAt < floor) changed = true;
    else recordings[id] = r;
  }
  const folders: AppData["folders"] = {};
  for (const [id, f] of Object.entries(data.folders)) {
    if (f.deletedAt && f.deletedAt < floor) changed = true;
    else folders[id] = f;
  }
  return changed ? { ...data, recordings, folders } : data;
}
