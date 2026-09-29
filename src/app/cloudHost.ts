// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEAM: where the app asks its host whether it can offer a document store
// of its own.
//
// A browser cannot reach a device's iCloud container — there is no such API —
// so on the website this seam is simply never filled and iCloud is absent from
// the storage picker entirely. The app-store build's WebView host fills it in
// (`native/src/icloudBridge.ts`), and so could any other host that one day
// wanted to.
//
// Nothing here asks whether the app is running natively, on which platform, or
// in which build — it asks whether a DOCUMENT-STORE HOST is present, which is
// a question about capability and not about identity. A second host offering
// the same seven methods would light the same backend up with no change here.
//
// What the app keeps either way is the DOMAIN. A host moves bytes: a file in,
// a file out. What is in them and how two devices' edits reconcile are
// `migrations.ts` and `merge.ts`'s, exactly as they are for Dropbox — which is
// why the host is adapted into the framework's `FileStore` and `ByteFileStore`
// below and then never spoken to again.

import { useCallback, useEffect, useState } from "react";

import {
  AuthError,
  createFileStoreAdapter,
  type ByteFileStore,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";
import { bytesToBase64 } from "@niclaslindstedt/oss-framework/files";

import { logStore } from "./log.ts";

export type CloudHostStatus = "ready" | "signed-out" | "unavailable";

export type CloudHostEntry = { path: string; rev?: string };

/** What a host's method resolves to. A failure is DATA rather than a
 *  rejection because a host may live on the other side of a message channel,
 *  where an exception cannot cross. `kind` is what this module turns back
 *  into the right framework error. */
export type CloudHostResult =
  | { ok: true; value: unknown }
  | { ok: false; kind: "auth" | "offline" | "error"; message: string };

/** What a host has to provide to light a backend up: the four the
 *  framework's `FileStore` speaks, the two that carry a recording's bytes as
 *  base64 (the only lossless way through a string channel), and a `status`
 *  the picker reads before it offers the backend at all. */
export type CloudHost = {
  readonly version: 1;
  readonly provider: string;
  status(): Promise<CloudHostResult>;
  list(): Promise<CloudHostResult>;
  read(path: string): Promise<CloudHostResult>;
  write(path: string, text: string): Promise<CloudHostResult>;
  readBytes(path: string): Promise<CloudHostResult>;
  writeBytes(path: string, base64: string): Promise<CloudHostResult>;
  remove(path: string): Promise<CloudHostResult>;
};

/** Must match `HOST_EVENT` in `native/src/icloudBridge.ts`. */
export const CLOUD_HOST_EVENT = "recorder:cloud-host";

/** Must match `HOST_PROPERTY` in `native/src/icloudBridge.ts` — a mismatch
 *  is not an error, it is a backend that never appears in the picker. */
export const CLOUD_HOST_PROPERTY = "__recorderCloudHost";

export const ICLOUD_PROVIDER = "icloud";

export const CLOUD_HOST_METHODS = [
  "status",
  "list",
  "read",
  "write",
  "readBytes",
  "writeBytes",
  "remove",
] as const;

type HostWindow = Window & { [CLOUD_HOST_PROPERTY]?: unknown };

/** The installed host, or null. Validates the shape rather than trusting it:
 *  the value arrives from code outside this bundle. */
export function getCloudHost(): CloudHost | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as HostWindow)[CLOUD_HOST_PROPERTY];
  if (typeof candidate !== "object" || candidate === null) return null;
  const host = candidate as Partial<CloudHost>;
  if (host.version !== 1) return null;
  if (host.provider !== ICLOUD_PROVIDER) return null;
  for (const method of CLOUD_HOST_METHODS) {
    if (typeof host[method] !== "function") return null;
  }
  return host as CloudHost;
}

export function parseHostStatus(result: unknown): CloudHostStatus {
  if (typeof result !== "object" || result === null) return "unavailable";
  const envelope = result as Partial<CloudHostResult>;
  if (envelope.ok !== true) return "unavailable";
  const value = (envelope as { value?: unknown }).value;
  return value === "ready" || value === "signed-out" ? value : "unavailable";
}

export function parseHostEntries(value: unknown): CloudHostEntry[] {
  if (!Array.isArray(value)) return [];
  const out: CloudHostEntry[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as { path?: unknown; rev?: unknown };
    if (typeof entry.path !== "string" || entry.path === "") continue;
    out.push(
      typeof entry.rev === "string"
        ? { path: entry.path, rev: entry.rev }
        : { path: entry.path },
    );
  }
  return out;
}

/** The host, as state — null until one is installed and has reported a
 *  store this build can use. Re-read when the page is shown again: signing
 *  into iCloud happens in the system's Settings, not in here. */
export function useCloudHost(): CloudHost | null {
  const [host, setHost] = useState<CloudHost | null>(null);

  const probe = useCallback(() => {
    const candidate = getCloudHost();
    if (!candidate) {
      setHost(null);
      return;
    }
    void candidate
      .status()
      .then((result) =>
        setHost(parseHostStatus(result) === "unavailable" ? null : candidate),
      )
      .catch(() => setHost(null));
  }, []);

  useEffect(() => {
    window.addEventListener(CLOUD_HOST_EVENT, probe);
    document.addEventListener("visibilitychange", probe);
    probe();
    return () => {
      window.removeEventListener(CLOUD_HOST_EVENT, probe);
      document.removeEventListener("visibilitychange", probe);
    };
  }, [probe]);

  return host;
}

/**
 * Unwrap one host answer, or throw the error the sync engine routes on:
 * `auth` → the framework's `AuthError` (Reconnect); `offline` → a
 * `TypeError`, which `isOfflineError` recognises and which keeps the local
 * copy in play; `error` → a plain `Error`, shown and stopped on.
 */
export function unwrap(result: CloudHostResult): unknown {
  if (typeof result !== "object" || result === null) {
    throw new Error("The document store answered with nothing readable.");
  }
  if (result.ok === true) return result.value;
  const message =
    typeof (result as { message?: unknown }).message === "string"
      ? result.message
      : "The document store failed without saying why.";
  if (result.kind === "auth") throw new AuthError(message);
  if (result.kind === "offline") throw new TypeError(message);
  throw new Error(message);
}

/** A host, as the storage adapter the sync engine already knows how to
 *  drive. No retry curve: a host's `offline` is iCloud saying the bytes are
 *  not here yet, which three more tries a second apart will not change. */
export function createCloudHostAdapter(
  host: CloudHost,
  options: { label: string; fileName: string; saveDebounceMs?: number },
): StorageAdapter {
  return createFileStoreAdapter(
    {
      list: async () => parseHostEntries(unwrap(await host.list())),
      read: async (path) => {
        const value = unwrap(await host.read(path));
        return typeof value === "string" ? value : null;
      },
      write: async (path, text) => {
        unwrap(await host.write(path, text));
      },
      remove: async (path) => {
        unwrap(await host.remove(path));
      },
    },
    {
      id: "folder",
      label: options.label,
      fileName: options.fileName,
      saveDebounceMs: options.saveDebounceMs,
      logger: logStore.createLogger("icloud"),
      retryDelaysMs: [],
    },
  );
}

/** A host, as the byte store the sync's reconcile drives for the
 *  recordings' files. Bytes cross the bridge as base64. */
export function createCloudHostByteStore(host: CloudHost): ByteFileStore {
  return {
    list: async () => parseHostEntries(unwrap(await host.list())),
    readBytes: async (path) => {
      const value = unwrap(await host.readBytes(path));
      return typeof value === "string" ? base64ToBytes(value) : null;
    },
    writeBytes: async (path, bytes) => {
      unwrap(await host.writeBytes(path, bytesToBase64(bytes)));
    },
    remove: async (path) => {
      unwrap(await host.remove(path));
    },
  };
}

/** The bytes a base64 string holds. `atob` is the browser's own and the
 *  only base64 a page has; a recording runs to megabytes, so the bytes are
 *  copied in a loop rather than spread into one call. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
