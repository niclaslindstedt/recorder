// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The persistence pipeline: raw JSON in, a validated `AppData` out, and back.
// Every read — from IndexedDB, from a backend, from a restored backup — goes
// through `parseDoc`, so no other module has to trust the bytes it was
// handed.
//
// The framework owns the migration *runner* (`createMigrator`); this module
// owns the step table and the shape validation. A schema change means
// bumping `DOC_VERSION` in `types.ts` and appending one step here — never
// editing an existing step. A purely additive optional field needs no step:
// absent is a thing the validation below can read.

import {
  createMigrator,
  type Versioned,
} from "@niclaslindstedt/oss-framework/storage";

import { normalizeEq } from "./eq.ts";
import {
  DOC_VERSION,
  emptyDoc,
  type AppData,
  type Folder,
  type Recording,
  type RecordingKind,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const EPOCH = new Date(0).toISOString();

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stampOf(value: unknown): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : EPOCH;
}

function tombstone(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

/** The longest a title or a note is kept: a document is not a place for a
 *  novel, and a stray paste should not become one. */
export const TITLE_MAX = 200;
export const NOTES_MAX = 2000;

/** A file name a record may point at: the id and an extension, nothing that
 *  could climb out of the folder the files are kept in. */
export function isFileName(value: string): boolean {
  return /^[a-z0-9]{1,32}\.[a-z0-9]{1,5}$/.test(value);
}

function parseFolder(id: string, value: unknown): Folder | null {
  if (!isRecord(value)) return null;
  const name = str(value.name).slice(0, TITLE_MAX);
  const deletedAt = tombstone(value.deletedAt);
  if (!name && !deletedAt) return null;
  return {
    id,
    name,
    parentId: typeof value.parentId === "string" ? value.parentId : null,
    order: num(value.order, 0),
    updatedAt: stampOf(value.updatedAt),
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function parsePeaks(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const raw of value.slice(0, 2000)) {
    const n = Number(raw);
    out.push(Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
  }
  return out;
}

function parseKind(value: unknown): RecordingKind {
  return value === "lossless" ? "lossless" : "compact";
}

function parseRecording(id: string, value: unknown): Recording | null {
  if (!isRecord(value)) return null;
  const fileName = str(value.fileName);
  if (!isFileName(fileName)) return null;
  const deletedAt = tombstone(value.deletedAt);
  const eq = normalizeEq(value.eq);
  return {
    id,
    title: str(value.title).slice(0, TITLE_MAX),
    folderId: typeof value.folderId === "string" ? value.folderId : null,
    createdAt: stampOf(value.createdAt),
    updatedAt: stampOf(value.updatedAt),
    durationMs: Math.max(0, num(value.durationMs)),
    sampleRate: Math.max(0, num(value.sampleRate)),
    channels: Math.max(1, Math.round(num(value.channels, 1))),
    kind: parseKind(value.kind),
    mimeType: str(value.mimeType),
    fileName,
    size: Math.max(0, num(value.size)),
    peaks: parsePeaks(value.peaks),
    favorite: value.favorite === true,
    notes: str(value.notes).slice(0, NOTES_MAX),
    clipCount: Math.max(0, Math.round(num(value.clipCount))),
    maxPeakDb: num(value.maxPeakDb, -60),
    ...(eq ? { eq } : {}),
    ...(deletedAt ? { deletedAt } : {}),
  };
}

/** Coerce anything into a document, dropping what cannot be read and
 *  keeping everything that can. A folder a recording points at that does
 *  not exist is not an error: the recording shows at the top level. */
export function normalizeDoc(value: unknown): AppData {
  if (!isRecord(value)) return emptyDoc();
  const folders: AppData["folders"] = {};
  if (isRecord(value.folders)) {
    for (const [id, raw] of Object.entries(value.folders)) {
      const folder = parseFolder(id, raw);
      if (folder) folders[id] = folder;
    }
  }
  const recordings: AppData["recordings"] = {};
  if (isRecord(value.recordings)) {
    for (const [id, raw] of Object.entries(value.recordings)) {
      const recording = parseRecording(id, raw);
      if (recording) recordings[id] = recording;
    }
  }
  return { version: DOC_VERSION, folders, recordings };
}

// The step table. Version 1 is the first; the first change appends `2`.
const migrator = createMigrator({
  migrations: {},
  latestVersion: DOC_VERSION,
});

/** Stored bytes → a document. Throws on bytes that are not JSON at all;
 *  anything else is read as far as it goes. */
export function parseDoc(text: string): AppData {
  const raw = JSON.parse(text) as unknown;
  if (!isRecord(raw)) return emptyDoc();
  const versioned: Versioned = {
    ...raw,
    version: typeof raw.version === "number" ? raw.version : DOC_VERSION,
  };
  const { data } = migrator.migrate(versioned);
  return normalizeDoc(data);
}

/** A document → the bytes stored and synced. Keys are sorted so two devices
 *  holding the same document write the same text, which is what lets the
 *  sync engine tell "nothing changed" from "changed". */
export function serializeDoc(data: AppData): string {
  const sorted = (obj: Record<string, unknown>) =>
    Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, obj[k]]),
    );
  return JSON.stringify({
    version: DOC_VERSION,
    folders: sorted(data.folders),
    recordings: sorted(data.recordings),
  });
}
