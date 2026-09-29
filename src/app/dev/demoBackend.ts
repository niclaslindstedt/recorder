// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The demo storage: an in-memory document backend and an in-memory blob
// store that *take over* both stores while the toggle is on — the same
// seams a test uses. Edits made during the session round-trip through them;
// nothing is ever written to IndexedDB.

import { createMemoryBlobStore, type BlobStore } from "../blobStore.ts";
import { liveRecordings, type AppData } from "../types.ts";
import { createMemoryDocBackend, type DocBackend } from "../useDocStore.ts";
import { buildDemoData, demoAudio } from "./demoData.ts";

/** A fresh demo, seeded with the moment it was opened: the document for
 *  every space (the same library, whichever space is open) and the files. */
export function createDemoBackend(): { docs: DocBackend; blobs: BlobStore } {
  const now = new Date();
  let seeded: AppData | null = null;
  const docs = createMemoryDocBackend(() => {
    seeded ??= buildDemoData(now);
    return seeded;
  });
  const blobs = createMemoryBlobStore();
  seeded ??= buildDemoData(now);
  for (const r of liveRecordings(seeded)) {
    void blobs.writeBytes(r.fileName, demoAudio(r), r.mimeType);
  }
  return { docs, blobs };
}
