// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reconciling two copies of the document — this device's and a backend's.
//
// Folders and recordings are keyed by id and each carries `updatedAt`, so
// two copies merge record by record with the later edit winning. Nobody is
// asked which side to keep: a recording taken on the phone and a title
// corrected on the laptop both survive.
//
// A deletion is a tombstone (`deletedAt`, the record kept), and a tombstone
// is an edit like any other — it carries the `updatedAt` of the deletion —
// so it wins over an older copy of the record and the recording stays
// deleted on every device. An edit made *after* the deletion on a device
// that had not heard of it wins the other way, which is the right answer:
// the reader touched it last. See `docs/sync.md`.
//
// Pure and total: same inputs, same output, no clock, no storage.

import { DOC_VERSION, type AppData } from "./types.ts";

function newer<T extends { updatedAt: string }>(a: T, b: T): T {
  return b.updatedAt > a.updatedAt ? b : a;
}

function mergeRecords<T extends { updatedAt: string }>(
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = { ...local };
  for (const [key, value] of Object.entries(remote)) {
    const mine = out[key];
    out[key] = mine ? newer(mine, value) : value;
  }
  return out;
}

/** Merge two documents record by record, last edit winning. */
export function mergeDocs(local: AppData, remote: AppData): AppData {
  return {
    version: DOC_VERSION,
    folders: mergeRecords(local.folders, remote.folders),
    recordings: mergeRecords(local.recordings, remote.recordings),
  };
}
