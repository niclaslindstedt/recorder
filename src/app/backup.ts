// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Export and restore of a space's index — the document, without the audio.
// A backup is exactly the document the app stores, so a file taken out of
// here can be read with any text editor and put back with the same code
// path a sync pull uses. The recordings' bytes are not in it: they are on
// the backend the space syncs to, or exported one at a time.

import { dayKeyOf } from "@niclaslindstedt/oss-framework/calendar";
import {
  MIME_JSON,
  saveFile,
  type SaveFileOutcome,
} from "@niclaslindstedt/oss-framework/files";

import { normalizeDoc, serializeDoc } from "./migrations.ts";
import type { AppData } from "./types.ts";

/** The exported file's name — the space and the date, so a folder of
 *  backups sorts itself. */
export function backupFileName(
  slug: string,
  today = dayKeyOf(new Date()),
): string {
  return `recorder-${slug}-index-${today}.json`;
}

/** Save the document to a file the reader picks a home for. */
export function saveBackup(
  data: AppData,
  slug: string,
): Promise<SaveFileOutcome> {
  const pretty = JSON.stringify(JSON.parse(serializeDoc(data)), null, 2);
  return saveFile({
    text: pretty,
    filename: backupFileName(slug),
    mimeType: MIME_JSON,
  });
}

/** Read a picked file as a document. Throws when the bytes aren't JSON;
 *  a shape problem is not an error — `normalizeDoc` keeps what it can. */
export async function readBackupFile(file: File): Promise<AppData> {
  const text = await file.text();
  return normalizeDoc(JSON.parse(text) as unknown);
}
