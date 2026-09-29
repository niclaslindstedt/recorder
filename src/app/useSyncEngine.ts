// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  useEncryption,
  WrongPasswordError,
  type Encryption,
} from "@niclaslindstedt/oss-framework/encryption";
import {
  AuthError,
  ConflictError,
  RateLimitError,
  completeDropboxAuth,
  connectDropboxAuthSession,
  connectDropboxLoopback,
  createDropboxAdapter,
  createDropboxFileStore,
  describeStorageError,
  getAuthSessionHost,
  hasPendingDropboxAuth,
  isAuthCancelled,
  isDesktopShellOrigin,
  isOfflineError,
  localCacheKey,
  reconcileFiles,
  scopedByteStore,
  startDropboxAuth,
  withLocalCache,
  type ByteFileStore,
  type DropboxAuthResult,
  type ReconcileResult,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";
import type {
  ConnectionProbeResult,
  SaveStatus,
  SyncLocation,
} from "@niclaslindstedt/oss-framework/sync";

import type { BlobStore } from "./blobStore.ts";
import {
  createCloudHostAdapter,
  createCloudHostByteStore,
  getCloudHost,
  useCloudHost,
  type CloudHost,
} from "./cloudHost.ts";
import { logStore } from "./log.ts";
import { mergeDocs } from "./merge.ts";
import { parseDoc, serializeDoc } from "./migrations.ts";
import { wantedFiles } from "./types.ts";
import type { DocStore } from "./useDocStore.ts";
import { useSelfHosted, type SelfHosted } from "./useSelfHosted.ts";

// The app's sync engine — the state machine the framework's `SyncStatus`
// glyph and `SyncDetailsModal` command centre paint over. The local document
// (IndexedDB, written by `useDocStore`) is always the working copy; when a
// backend is connected the engine pushes the serialized document there
// (debounced on the store's edit counter) and pulls the backend's copy on
// mount and whenever the space changes.
//
// A space is one file on the backend — `recorder-<slug>.json` — and a folder
// beside it — `recorder-<slug>/` — holding the recordings' bytes under their
// file names. The document decides which files there are; after every push
// and pull the *sweep* (`reconcileFiles`) sends the files this device has
// and the backend lacks, fetches the ones the backend has and this device
// lacks, and removes the ones no record names any more — a deletion is a
// tombstone in the document (`merge.ts`), which is what lets the far side's
// file go. The folder is the space's own, so two spaces on one Dropbox never
// prune each other.
//
// Reconciliation is a per-record merge, not a "pick a side" prompt: two
// devices that recorded different things between syncs both keep them.
//
// Four backends. Dropbox and iCloud (offered by the app's host,
// `cloudHost.ts`) carry the document through the framework's optional
// encryption — a passphrase over the copy the provider holds, the recordings'
// files sealed under the same passphrase (`encryption.sealBytes`). The
// reader's own storage server (`useSelfHosted.ts`) seals everything itself
// before it leaves the device, so the app adds nothing there. "This device"
// connects nothing.

const syncLog = logStore.createLogger("sync");
const encryptionLog = logStore.createLogger("encryption");

export type SyncBackendId = "local" | "icloud" | "dropbox" | "selfhosted";

const BACKEND_KEY = "recorder:sync:backend";
const DROPBOX_TOKENS_KEY = "recorder:sync:dropbox";
const ENCRYPTION_KEY = "recorder:sync:encryption";

/** How long after the last edit a push is sent. */
const SAVE_DEBOUNCE_MS = 1200;

/** A space's document and folder on a backend. */
export function spaceFileName(slug: string): string {
  return `recorder-${slug}.json`;
}
export function spaceFolder(slug: string): string {
  return `recorder-${slug}`;
}

/** The spaces a backend's listing names: every `recorder-<slug>.json`. */
export function spacesFrom(paths: Iterable<string>): string[] {
  const out: string[] = [];
  for (const path of paths) {
    const m = /^recorder-([a-z0-9-]+)\.json$/.exec(path);
    if (m?.[1]) out.push(m[1]);
  }
  return out.sort();
}

export const DROPBOX_APP_KEY: string =
  (import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined) ?? "";

export const DROPBOX_APP_FOLDER: string =
  (import.meta.env.VITE_DROPBOX_APP_FOLDER as string | undefined)?.trim() ||
  "recorder";

export const PROVIDER_NAMES: Record<SyncBackendId, string> = {
  local: "This device",
  icloud: "iCloud Drive",
  dropbox: "Dropbox",
  selfhosted: "Your server",
};

/** Which backends this build can offer without asking anything of its host. */
export const AVAILABLE_BACKENDS: SyncBackendId[] = [
  "local",
  ...(DROPBOX_APP_KEY ? (["dropbox"] as const) : []),
  "selfhosted",
];

const ICLOUD_FOLDER = "iCloud Drive/Recorder";

type DropboxTokens = { accessToken: string; refreshToken: string | null };

function readBackend(): SyncBackendId {
  try {
    const raw = localStorage.getItem(BACKEND_KEY);
    return raw === "dropbox" || raw === "icloud" || raw === "selfhosted"
      ? raw
      : "local";
  } catch {
    return "local";
  }
}

function readDropboxTokens(): DropboxTokens | null {
  try {
    const raw = localStorage.getItem(DROPBOX_TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DropboxTokens;
    return typeof parsed.accessToken === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeDropboxTokens(tokens: DropboxTokens | null): void {
  if (tokens) localStorage.setItem(DROPBOX_TOKENS_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(DROPBOX_TOKENS_KEY);
}

function backendPath(
  backend: SyncBackendId,
  slug: string,
  server: SelfHosted["server"],
): string {
  const file = spaceFileName(slug);
  if (backend === "dropbox") return `Apps/${DROPBOX_APP_FOLDER}/${file}`;
  if (backend === "icloud") return `${ICLOUD_FOLDER}/${file}`;
  if (backend === "selfhosted")
    return server ? `${server.name ?? server.url}/${file}` : "";
  return "On this device only";
}

/** The files' progress, for the sync sheet. */
export type MediaSync = {
  running: boolean;
  /** Transfers finished of those planned, while running. */
  done: number;
  total: number;
  last: ReconcileResult | null;
  /** Bumped after every sweep, so a screen can re-read which files are here. */
  version: number;
  run: () => void;
};

export type SyncEngine = {
  backend: SyncBackendId;
  providerName: string;
  connected: boolean;
  status: SaveStatus;
  statusDetail: string | null;
  dirty: boolean;
  offline: boolean;
  location: SyncLocation;
  available: SyncBackendId[];
  connect: (backend: SyncBackendId) => Promise<void>;
  disconnect: () => void;
  saveNow: () => void;
  reload: () => Promise<void>;
  reconnect: () => Promise<void>;
  checkConnection: () => Promise<ConnectionProbeResult>;
  selfHosted: SelfHosted;
  adoptSelfHosted: () => void;
  /** The passphrase over the Dropbox and iCloud copies. */
  encryption: Encryption;
  /** Whether the backend takes a passphrase at all: not "this device", and
   *  not the reader's server, which seals everything itself. */
  encryptable: boolean;
  media: MediaSync;
  /** The spaces the backend holds — every device's — so one made elsewhere
   *  can be opened here. */
  listSpaces: () => Promise<string[]>;
};

export function useSyncEngine(
  store: DocStore,
  blobs: BlobStore,
  // Suspend every read and write against the backend: demo data has taken
  // over storage, and none of it may reach a connected account.
  paused = false,
): SyncEngine {
  const slug = store.slug;
  const [backend, setBackendState] = useState<SyncBackendId>(readBackend);
  const [dropboxTokens, setDropboxTokens] = useState<DropboxTokens | null>(
    readDropboxTokens,
  );
  const cloudHost: CloudHost | null = useCloudHost();
  const selfHosted = useSelfHosted();
  const selfHostedNs = selfHosted.namespace;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [dirty, setDirty] = useState(false);
  const baseRevision = useRef<string | undefined>(undefined);
  const [baselineReady, setBaselineReady] = useState(false);
  const pushedEdit = useRef(0);
  const dataRef = useRef(store.data);
  dataRef.current = store.data;

  // The document adapter and the byte store for the space, per backend.
  const pair = useMemo((): {
    inner: StorageAdapter;
    files: ByteFileStore;
  } | null => {
    if (paused) return null;
    if (backend === "dropbox" && dropboxTokens) {
      const auth = {
        accessToken: dropboxTokens.accessToken,
        refreshToken: dropboxTokens.refreshToken,
        onAccessTokenRefreshed: (accessToken: string) => {
          const next = { ...dropboxTokens, accessToken };
          writeDropboxTokens(next);
          setDropboxTokens(next);
        },
      };
      const log = logStore.createLogger("dropbox");
      const cloud = createDropboxAdapter(auth, {
        appKey: DROPBOX_APP_KEY || undefined,
        fileName: spaceFileName(slug),
        logger: log,
      });
      return {
        inner: withLocalCache(cloud, {
          storage: localStorage,
          key: localCacheKey("dropbox", slug),
        }),
        files: scopedByteStore(
          createDropboxFileStore(auth, {
            appKey: DROPBOX_APP_KEY || undefined,
            logger: log,
          }),
          spaceFolder(slug),
        ),
      };
    }
    if (backend === "icloud" && cloudHost) {
      const cloud = createCloudHostAdapter(cloudHost, {
        label: PROVIDER_NAMES.icloud,
        fileName: spaceFileName(slug),
        saveDebounceMs: SAVE_DEBOUNCE_MS,
      });
      return {
        inner: withLocalCache(cloud, {
          storage: localStorage,
          key: localCacheKey("icloud", slug),
        }),
        files: scopedByteStore(
          createCloudHostByteStore(cloudHost),
          spaceFolder(slug),
        ),
      };
    }
    if (backend === "selfhosted" && selfHostedNs) {
      const cloud = selfHostedNs.adapter({
        fileName: spaceFileName(slug),
        saveDebounceMs: SAVE_DEBOUNCE_MS,
        label: PROVIDER_NAMES.selfhosted,
      });
      return {
        inner: withLocalCache(cloud, {
          storage: localStorage,
          key: localCacheKey("selfhosted", slug),
        }),
        files: selfHostedNs.fileStore({ root: spaceFolder(slug) }),
      };
    }
    return null;
  }, [backend, cloudHost, dropboxTokens, paused, selfHostedNs, slug]);

  // A copy a provider holds may be sealed under a passphrase. The server
  // seals everything itself, so it is left out; so is this device.
  const encryptable = backend === "dropbox" || backend === "icloud";
  const encryption = useEncryption({
    adapter: encryptable ? (pair?.inner ?? null) : null,
    policy: "optional",
    remember: "device",
    storageKey: `${ENCRYPTION_KEY}:${backend}`,
    logger: encryptionLog,
  });
  const adapter: StorageAdapter | null = encryptable
    ? encryption.adapter
    : (pair?.inner ?? null);
  const files: ByteFileStore | null = pair?.files ?? null;
  const connected =
    pair !== null ||
    (backend !== "local" &&
      !paused &&
      backend === "selfhosted" &&
      selfHosted.phase !== "signed-out");

  const reportFailure = useCallback((err: unknown, what: string): void => {
    if (err instanceof WrongPasswordError) {
      syncLog.warn(`${what}: the passphrase no longer opens the copy`);
      setStatus("idle");
      setStatusDetail(null);
      return;
    }
    const detail = describeStorageError(err);
    syncLog.error(`${what} failed — ${detail}`);
    setStatusDetail(detail);
    if (err instanceof AuthError) {
      setStatus("auth-error");
      return;
    }
    if (err instanceof RateLimitError) {
      setStatus("throttled");
      return;
    }
    if (isOfflineError(err)) {
      setOffline(true);
      setStatus("idle");
      return;
    }
    setStatus("error");
  }, []);

  // --- the files -------------------------------------------------------------

  const [media, setMedia] = useState<Omit<MediaSync, "run">>({
    running: false,
    done: 0,
    total: 0,
    last: null,
    version: 0,
  });
  const sweeping = useRef(false);
  const sweepAgain = useRef(false);
  const sealRef = useRef(encryption);
  sealRef.current = encryption;

  /** Keep the files in step with the document. `prune` only once the
   *  document the far side holds is this one — after a push — so a file a
   *  record there still names is not taken from under it. */
  const sweep = useCallback(
    async (prune: boolean): Promise<void> => {
      if (!files || paused) return;
      if (sweeping.current) {
        sweepAgain.current = true;
        return;
      }
      sweeping.current = true;
      setMedia((m) => ({ ...m, running: true, done: 0, total: 0 }));
      try {
        const enc = sealRef.current;
        const result = await reconcileFiles({
          local: blobs,
          remote: files,
          wanted: wantedFiles(dataRef.current, new Date()),
          prune,
          logger: syncLog,
          onProgress: (done, total) => setMedia((m) => ({ ...m, done, total })),
          transform:
            encryptable && enc.encrypted
              ? { up: (b) => enc.sealBytes(b), down: (b) => enc.openBytes(b) }
              : undefined,
        });
        if (
          result.pushed.length ||
          result.pulled.length ||
          result.pruned.length
        ) {
          syncLog.info(
            `files: ${result.pushed.length} sent, ${result.pulled.length} fetched, ${result.pruned.length} removed`,
          );
        }
        if (result.failed.length) {
          syncLog.warn(`files: ${result.failed.length} could not be moved`);
          if (result.failed.some((f) => f.error instanceof AuthError))
            setStatus("auth-error");
        }
        setMedia((m) => ({ ...m, last: result, version: m.version + 1 }));
      } finally {
        sweeping.current = false;
        setMedia((m) => ({ ...m, running: false }));
        if (sweepAgain.current) {
          sweepAgain.current = false;
          void sweep(prune);
        }
      }
    },
    [blobs, encryptable, files, paused],
  );

  // --- the document ---------------------------------------------------------

  const adoptRemote = useCallback(
    (text: string): boolean => {
      const remote = parseDoc(text);
      const merged = mergeDocs(dataRef.current, remote);
      const mergedText = serializeDoc(merged);
      if (mergedText !== serializeDoc(dataRef.current))
        store.replaceAll(merged);
      return mergedText !== serializeDoc(remote);
    },
    [store],
  );

  const push = useCallback(
    async (editAtSend: number): Promise<void> => {
      if (!adapter || paused) return;
      setStatus("saving");
      try {
        const snapshot = await adapter.save(
          serializeDoc(dataRef.current),
          baseRevision.current,
        );
        baseRevision.current = snapshot.revision;
        pushedEdit.current = editAtSend;
        setStatus("saved");
        setStatusDetail(null);
        setOffline(false);
        setDirty(false);
        syncLog.info("pushed document");
        void sweep(true);
      } catch (err) {
        if (err instanceof ConflictError) {
          syncLog.warn("conflict — merging the backend's copy");
          baseRevision.current = err.remote.revision;
          adoptRemote(err.remote.text);
          setStatus("idle");
          setStatusDetail(null);
          return;
        }
        reportFailure(err, "save");
      }
    },
    [adapter, adoptRemote, paused, reportFailure, sweep],
  );

  const pull = useCallback(async (): Promise<void> => {
    if (!adapter || paused) return;
    try {
      const snapshot = await adapter.load();
      baseRevision.current = snapshot?.revision;
      setOffline(Boolean(snapshot?.offline));
      if (snapshot) {
        const localAhead = adoptRemote(snapshot.text);
        if (localAhead) setDirty(true);
        syncLog.info("pulled document");
        // Fetch what the merged document names and send what is here; no
        // pruning until this document has been pushed.
        void sweep(false);
      } else {
        setDirty(true);
      }
      setStatusDetail(null);
    } catch (err) {
      reportFailure(err, "load");
    } finally {
      setBaselineReady(true);
    }
  }, [adapter, adoptRemote, paused, reportFailure, sweep]);

  const adoptDropbox = useCallback((result: DropboxAuthResult) => {
    const tokens: DropboxTokens = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? null,
    };
    writeDropboxTokens(tokens);
    setDropboxTokens(tokens);
    localStorage.setItem(BACKEND_KEY, "dropbox");
    setBackendState("dropbox");
    syncLog.info("dropbox: connected");
  }, []);

  // Complete a Dropbox OAuth redirect once on boot.
  useEffect(() => {
    if (!DROPBOX_APP_KEY || !hasPendingDropboxAuth()) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    void (async () => {
      try {
        adoptDropbox(await completeDropboxAuth(DROPBOX_APP_KEY, code));
      } catch (err) {
        syncLog.error(`dropbox: connect failed — ${describeStorageError(err)}`);
      } finally {
        window.history.replaceState(null, "", window.location.pathname);
      }
    })();
  }, [adoptDropbox]);

  // Baseline read whenever the active adapter changes — a connect, a
  // reconnect, a provider switch, a space switch — once the space's own
  // document has been read, so the merge has something to merge into.
  useEffect(() => {
    setBaselineReady(false);
    if (!adapter) {
      setStatus("idle");
      setStatusDetail(null);
      setDirty(false);
      setOffline(false);
      return;
    }
    if (paused || !store.loaded) return;
    void pull();
  }, [adapter, paused, pull, store.loaded]);

  // A backend that says when another device changed the document is pulled
  // right away rather than on the next open.
  useEffect(() => {
    if (!adapter?.watch || paused || !baselineReady) return;
    return adapter.watch(() => {
      syncLog.info("another device changed the document");
      void pull();
    });
  }, [adapter, paused, baselineReady, pull]);

  useEffect(() => {
    if (store.editCount === pushedEdit.current) return;
    setDirty(true);
  }, [store.editCount]);

  // Debounced auto-push, held while nothing is connected, before the
  // baseline read, or while a blocking fault stands in the way.
  useEffect(() => {
    if (!adapter || paused || !baselineReady || !dirty) return;
    if (status === "saving" || status === "auth-error") return;
    const editAtSend = store.editCount;
    const timer = setTimeout(() => void push(editAtSend), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [adapter, paused, baselineReady, dirty, status, store.editCount, push]);

  const adoptSelfHosted = useCallback((): void => {
    localStorage.setItem(BACKEND_KEY, "selfhosted");
    setBackendState("selfhosted");
    syncLog.info("selfhosted: connected");
  }, []);

  const connect = useCallback(
    async (next: SyncBackendId): Promise<void> => {
      if (next === "local") {
        localStorage.setItem(BACKEND_KEY, "local");
        setBackendState("local");
        return;
      }
      if (next === "icloud") {
        if (!getCloudHost()) throw new Error("iCloud is not available here");
        localStorage.setItem(BACKEND_KEY, "icloud");
        setBackendState("icloud");
        syncLog.info("icloud: connected");
        return;
      }
      if (next === "selfhosted") {
        if (selfHosted.phase === "ready" || selfHosted.phase === "unreachable")
          adoptSelfHosted();
        else selfHosted.requestConnect();
        return;
      }
      if (!DROPBOX_APP_KEY) throw new Error("Dropbox is not configured");
      const authSession = getAuthSessionHost();
      if (authSession) {
        try {
          adoptDropbox(
            await connectDropboxAuthSession(
              DROPBOX_APP_KEY,
              authSession,
              undefined,
              syncLog,
            ),
          );
        } catch (err) {
          if (!isAuthCancelled(err)) throw err;
          syncLog.info("dropbox: sign-in cancelled");
        }
        return;
      }
      if (isDesktopShellOrigin()) {
        adoptDropbox(
          await connectDropboxLoopback(DROPBOX_APP_KEY, undefined, syncLog),
        );
        return;
      }
      await startDropboxAuth(DROPBOX_APP_KEY, syncLog);
    },
    [adoptDropbox, adoptSelfHosted, selfHosted],
  );

  const disconnect = useCallback((): void => {
    // Only the credentials go: the recordings stay on this device, and the
    // copy already on the backend is left exactly where it is.
    writeDropboxTokens(null);
    localStorage.setItem(BACKEND_KEY, "local");
    setDropboxTokens(null);
    setBackendState("local");
    encryption.forget();
    syncLog.info("disconnected — your recordings stay on this device");
  }, [encryption]);

  const saveNow = useCallback((): void => {
    if (!adapter || !baselineReady) return;
    void push(store.editCount);
  }, [adapter, baselineReady, push, store.editCount]);

  const reload = useCallback(async (): Promise<void> => {
    await pull();
  }, [pull]);

  const reconnect = useCallback(async (): Promise<void> => {
    if (backend === "selfhosted") {
      if (selfHosted.phase === "signed-out") selfHosted.requestConnect();
      else await selfHosted.activate();
      return;
    }
    await connect(backend);
  }, [backend, connect, selfHosted]);

  const checkConnection =
    useCallback(async (): Promise<ConnectionProbeResult> => {
      if (!adapter?.probe) return offline ? "offline" : "online";
      try {
        const reachable = await adapter.probe();
        if (reachable) {
          setOffline(false);
          setStatusDetail(null);
          await pull();
          return "online";
        }
        setOffline(true);
        return "offline";
      } catch (err) {
        if (err instanceof AuthError) {
          setStatus("auth-error");
          setStatusDetail(describeStorageError(err));
          return "auth-error";
        }
        setOffline(true);
        return "offline";
      }
    }, [adapter, offline, pull]);

  const listSpaces = useCallback(async (): Promise<string[]> => {
    if (paused) return [];
    if (backend === "dropbox" && dropboxTokens) {
      const store = createDropboxFileStore(
        {
          accessToken: dropboxTokens.accessToken,
          refreshToken: dropboxTokens.refreshToken,
          onAccessTokenRefreshed: () => {},
        },
        { appKey: DROPBOX_APP_KEY || undefined },
      );
      return spacesFrom((await store.list()).map((e) => e.path));
    }
    if (backend === "icloud" && cloudHost) {
      return spacesFrom(
        (await createCloudHostByteStore(cloudHost).list()).map((e) => e.path),
      );
    }
    if (backend === "selfhosted" && selfHostedNs) {
      return spacesFrom(
        (await selfHostedNs.fileStore().list()).map((e) => e.path),
      );
    }
    return [];
  }, [backend, cloudHost, dropboxTokens, paused, selfHostedNs]);

  const run = useCallback(
    () => void sweep(!dirty && baselineReady),
    [sweep, dirty, baselineReady],
  );

  return {
    backend,
    providerName: PROVIDER_NAMES[backend],
    connected,
    status,
    statusDetail,
    dirty,
    offline:
      offline ||
      (backend === "selfhosted" && selfHosted.phase === "unreachable"),
    location: { path: backendPath(backend, slug, selfHosted.server) },
    available:
      cloudHost || backend === "icloud"
        ? ["local", "icloud", ...AVAILABLE_BACKENDS.slice(1)]
        : AVAILABLE_BACKENDS,
    connect,
    disconnect,
    saveNow,
    reload,
    reconnect,
    checkConnection,
    selfHosted,
    adoptSelfHosted,
    encryption,
    encryptable,
    media: { ...media, run },
    listSpaces,
  };
}
