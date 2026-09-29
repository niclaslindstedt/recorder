// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where the recordings' bytes live on this device: IndexedDB, one entry per
// file, keyed by the space it belongs to and the file's name. The document
// (`useDocStore.ts`) says which files there are; this holds them.
//
// It speaks the framework's `ByteFileStore` contract, so the sync engine's
// reconcile can treat it as the local side of a pair without knowing it is a
// browser database — and the demo can swap in a store in memory.

import {
  createIdbStore,
  memoryByteStore,
  type ByteFileStore,
  type FileEntry,
} from "@niclaslindstedt/oss-framework/storage";

export const BLOB_DB_NAME = "recorder:files";

type Row = {
  slug: string;
  name: string;
  bytes: ArrayBuffer;
  type: string;
  size: number;
};

/** The blob store for a space. `readBlob` and `writeBlob` are the app's
 *  own way in — a `Blob` carries its type, which is what a player needs —
 *  and the `ByteFileStore` half is for the sync. */
export type BlobStore = ByteFileStore & {
  readBlob(name: string): Promise<Blob | null>;
  writeBlob(name: string, blob: Blob): Promise<void>;
  /** Every file's name and size, for the details a space shows. */
  sizes(): Promise<Map<string, number>>;
};

const key = (slug: string, name: string) => `${slug}\u0000${name}`;

/** The real store: one IndexedDB database for every space, rows keyed by
 *  space and name, and a `slug` index so a space lists only its own. */
export function createBlobStore(slug: string): BlobStore {
  const rows = createIdbStore<Row>({
    dbName: BLOB_DB_NAME,
    storeName: "files",
    version: 1,
    indexes: { slug: "slug" },
    // Strict: this is where the bytes *live*; a write that did not land is a
    // recording lost, and must be told rather than swallowed.
    strict: true,
  });
  const listRows = () => rows.getAllBy("slug", slug);
  return {
    async list(): Promise<FileEntry[]> {
      return (await listRows()).map((row) => ({
        path: row.name,
        rev: String(row.size),
      }));
    },
    async readBytes(name) {
      const row = await rows.get(key(slug, name));
      return row ? new Uint8Array(row.bytes) : null;
    },
    async writeBytes(name, bytes, mime) {
      const copy = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      await rows.set(key(slug, name), {
        slug,
        name,
        bytes: copy,
        type: mime ?? "",
        size: copy.byteLength,
      });
    },
    async remove(name) {
      await rows.delete(key(slug, name));
    },
    async readBlob(name) {
      const row = await rows.get(key(slug, name));
      return row
        ? new Blob([row.bytes], row.type ? { type: row.type } : undefined)
        : null;
    },
    async writeBlob(name, blob) {
      const bytes = await blob.arrayBuffer();
      await rows.set(key(slug, name), {
        slug,
        name,
        bytes,
        type: blob.type,
        size: bytes.byteLength,
      });
    },
    async sizes() {
      return new Map((await listRows()).map((row) => [row.name, row.size]));
    },
  };
}

/** A store that keeps nothing past the tab: the demo's, and a test's. */
export function createMemoryBlobStore(): BlobStore {
  const inner = memoryByteStore();
  const types = new Map<string, string>();
  return {
    ...inner,
    async writeBytes(name, bytes, mime) {
      if (mime) types.set(name, mime);
      await inner.writeBytes(name, bytes, mime);
    },
    async remove(name) {
      types.delete(name);
      await inner.remove(name);
    },
    async readBlob(name) {
      const bytes = await inner.readBytes(name);
      return bytes
        ? new Blob([bytes as BlobPart], { type: types.get(name) ?? "" })
        : null;
    },
    async writeBlob(name, blob) {
      types.set(name, blob.type);
      await inner.writeBytes(name, new Uint8Array(await blob.arrayBuffer()));
    },
    async sizes() {
      return new Map(
        Array.from(inner.files.entries()).map(([name, bytes]) => [
          name,
          bytes.length,
        ]),
      );
    },
  };
}
