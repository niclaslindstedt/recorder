// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createIdbStore } from "@niclaslindstedt/oss-framework/storage";

import {
  addFolder,
  deleteFolder,
  moveFolder,
  patchRecording,
  setRecordingEq,
  purgeRecording,
  renameFolder,
  reorderFolders,
  restoreRecording,
  saveRecording,
  trashRecording,
  type Ctx,
} from "./folders.ts";
import type { Eq } from "./eq.ts";
import { liveCtx } from "./ids.ts";
import { parseDoc, serializeDoc } from "./migrations.ts";
import {
  emptyDoc,
  purgeAfter,
  type AppData,
  type Folder,
  type Recording,
} from "./types.ts";
import * as output from "../output.ts";

// The document store: one document per space, held in state and written
// through to IndexedDB, and the edits the app can make. The framework's
// "store stays in the app" seam — it owns the storage adapters and the UI
// kit, this hook owns where the document lives and what an edit means.
//
// IndexedDB rather than localStorage, because the recordings' bytes live
// there too (`blobStore.ts`) and a document should not be evicted before
// the files it names. The read is asynchronous, so the store starts on an
// empty document with `loaded` false and never writes until the read has
// landed — a slow read must not be overwritten by the empty document that
// preceded it.
//
// The local copy is always the working copy. Sync (`useSyncEngine.ts`)
// reads and writes *around* this hook rather than through it, so losing the
// network never costs an edit.

export const DOC_DB_NAME = "recorder:documents";

/** The document storage seam: a test or the demo takes over storage here. */
export type DocBackend = {
  readonly id: string;
  load(slug: string): Promise<AppData>;
  save(slug: string, doc: AppData): Promise<void>;
  drop(slug: string): Promise<void>;
};

type Row = { text: string; savedAt: string };

/** The real backend: one row per space in IndexedDB, the text run through
 *  the migration pipeline on the way in and out. A document this build
 *  cannot read — most often one a newer build wrote, read by a stale
 *  build mid-update — is left alone and quarantined beside itself. */
export function createIdbDocBackend(): DocBackend {
  const rows = createIdbStore<Row>({
    dbName: DOC_DB_NAME,
    storeName: "documents",
    strict: true,
  });
  return {
    id: "idb",
    async load(slug) {
      let row: Row | null;
      try {
        row = await rows.get(slug);
      } catch (err) {
        output.error(
          `Couldn't open the recordings saved on this device — ${message(err)}.`,
        );
        return emptyDoc();
      }
      if (!row) return emptyDoc();
      try {
        return parseDoc(row.text);
      } catch (err) {
        output.error(
          `Couldn't read the recordings saved on this device — ${message(err)}. The stored copy is left untouched and should reappear once the app finishes updating.`,
        );
        try {
          await rows.set(`${slug}:unreadable`, row);
        } catch {
          // No room to quarantine — the live row is still intact.
        }
        throw err;
      }
    },
    async save(slug, doc) {
      await rows.set(slug, {
        text: serializeDoc(doc),
        savedAt: new Date().toISOString(),
      });
    },
    async drop(slug) {
      await rows.delete(slug);
    },
  };
}

/** A backend that keeps everything in memory: the demo's, and a test's. */
export function createMemoryDocBackend(
  seed?: (slug: string) => AppData,
): DocBackend {
  const docs = new Map<string, AppData>();
  return {
    id: "memory",
    async load(slug) {
      let doc = docs.get(slug);
      if (!doc) {
        doc = seed ? seed(slug) : emptyDoc();
        docs.set(slug, doc);
      }
      return doc;
    },
    async save(slug, doc) {
      docs.set(slug, doc);
    },
    async drop(slug) {
      docs.delete(slug);
    },
  };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type DocStore = {
  data: AppData;
  slug: string;
  /** True once this space's document has been read. */
  loaded: boolean;
  /** Monotonic counter bumped on every edit; the sync engine debounces on
   *  it rather than deep-comparing the document. */
  editCount: number;
  writeFailures: number;
  saveRecording: (recording: Recording) => void;
  patchRecording: (
    id: string,
    patch: Parameters<typeof patchRecording>[2],
  ) => void;
  /** The EQ a recording is heard and exported through; `null` is flat. */
  setRecordingEq: (id: string, eq: Eq | null) => void;
  trashRecording: (id: string) => void;
  restoreRecording: (id: string) => void;
  purgeRecording: (id: string) => void;
  addFolder: (name: string, parentId: string | null) => Folder;
  renameFolder: (id: string, name: string) => void;
  moveFolder: (id: string, parentId: string | null) => void;
  reorderFolders: (parentId: string | null, orderedIds: string[]) => void;
  deleteFolder: (id: string) => void;
  /** Replace the whole document — the sync's adopt path and a restore. */
  replaceAll: (doc: AppData) => void;
  /** Forget a space's document on this device. */
  dropSpace: (slug: string) => Promise<void>;
};

export function useDocStore(
  slug: string,
  backend: DocBackend,
  ctx: Ctx = liveCtx(),
): DocStore {
  const [state, setState] = useState<{
    slug: string;
    backend: DocBackend;
    data: AppData;
    loaded: boolean;
  }>({
    slug,
    backend,
    data: emptyDoc(),
    loaded: false,
  });
  const [editCount, setEditCount] = useState(0);
  const [writeFailures, setWriteFailures] = useState(0);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const pending = useRef(false);

  // A space or backend change reads the new document; nothing is written
  // until it has landed.
  useEffect(() => {
    let live = true;
    setState({ slug, backend, data: emptyDoc(), loaded: false });
    void backend
      .load(slug)
      .then((doc) => {
        if (!live) return;
        // Tombstones nobody needs any more go on the way in, so a document
        // never grows without bound; the change is written like any edit.
        const trimmed = purgeAfter(doc, new Date());
        setState({ slug, backend, data: trimmed, loaded: true });
        if (trimmed !== doc) pending.current = true;
      })
      .catch(() => {
        // Unreadable: stay unloaded, so nothing is written over it.
        if (live) setState({ slug, backend, data: emptyDoc(), loaded: false });
      });
    return () => {
      live = false;
    };
  }, [slug, backend]);

  // Write-through after every edit — and only after an edit: a load must
  // never write back what it read.
  useEffect(() => {
    if (!state.loaded || !pending.current) return;
    pending.current = false;
    const { backend: b, slug: s, data } = state;
    void b.save(s, data).catch((err: unknown) => {
      output.error(`Couldn't save to this device — ${message(err)}.`);
      setWriteFailures((n) => n + 1);
    });
  }, [state]);

  const edit = useCallback((fn: (data: AppData) => AppData) => {
    setState((prev) => {
      if (!prev.loaded) return prev;
      const next = fn(prev.data);
      if (next === prev.data) return prev;
      pending.current = true;
      return { ...prev, data: next };
    });
    setEditCount((n) => n + 1);
  }, []);

  const c = () => ctxRef.current;

  const api = useMemo<
    Omit<DocStore, "data" | "slug" | "loaded" | "editCount" | "writeFailures">
  >(
    () => ({
      saveRecording: (r) => edit((d) => saveRecording(d, r)),
      patchRecording: (id, patch) =>
        edit((d) => patchRecording(d, id, patch, c())),
      setRecordingEq: (id, eq) => edit((d) => setRecordingEq(d, id, eq, c())),
      trashRecording: (id) => edit((d) => trashRecording(d, id, c())),
      restoreRecording: (id) => edit((d) => restoreRecording(d, id, c())),
      purgeRecording: (id) => edit((d) => purgeRecording(d, id, c())),
      addFolder: (name, parentId) => {
        let made: Folder | null = null;
        edit((d) => {
          const out = addFolder(d, name, parentId, c());
          made = out.folder;
          return out.data;
        });
        // `edit` runs the updater synchronously under Preact; the folder is
        // in hand for the caller to open.
        return (
          made ?? { id: "", name, parentId, order: 0, updatedAt: c().now() }
        );
      },
      renameFolder: (id, name) => edit((d) => renameFolder(d, id, name, c())),
      moveFolder: (id, parentId) =>
        edit((d) => moveFolder(d, id, parentId, c())),
      reorderFolders: (parentId, ids) =>
        edit((d) => reorderFolders(d, parentId, ids, c())),
      deleteFolder: (id) => edit((d) => deleteFolder(d, id, c())),
      replaceAll: (doc) => edit(() => doc),
      dropSpace: (s) => backend.drop(s),
    }),
    [edit, backend],
  );

  return useMemo(
    () => ({
      data: state.data,
      slug: state.slug,
      loaded: state.loaded,
      editCount,
      writeFailures,
      ...api,
    }),
    [state, editCount, writeFailures, api],
  );
}
