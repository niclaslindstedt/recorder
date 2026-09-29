// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The self-hosted backend's lifecycle, as the sync engine and the screens see
// it: restore this device's pairing from its key vault on start, open the
// namespace that holds `recorder-<space>.json`, and carry the one request the rest of the
// app makes of it — "show the connect sheet" — whether that came from the
// storage picker or from a pairing QR the phone's camera opened the app with.
//
// The decisions are `selfHosted.ts`'s; this file is the state around them.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AuthError,
  describeStorageError,
  isOfflineError,
  type StorageNamespace,
} from "@niclaslindstedt/oss-framework/storage";

import { logStore } from "./log.ts";
import {
  createRecorderClient,
  forgetNamespace,
  openRecorderNamespace,
  pairingFromUrl,
  withoutPairing,
  type RecorderClient,
} from "./selfHosted.ts";

const log = logStore.createLogger("selfhosted");

/** Where the device stands with its server.
 *
 *  `signed-out` — never paired, or unpaired: the connect sheet is the way in.
 *  `needs-keys` — paired, but the account's key has not reached this device
 *  yet (another device has to approve it, or the recovery key has to be
 *  typed). `ready` — keys and namespace in hand, syncing. `unreachable` —
 *  paired and keyed, but the server could not be reached to open the
 *  namespace; the local copy carries on and the engine retries. */
export type SelfHostedPhase =
  "loading" | "signed-out" | "needs-keys" | "ready" | "unreachable";

export type SelfHosted = {
  phase: SelfHostedPhase;
  namespace: StorageNamespace | null;
  client: RecorderClient;
  /** The server this device is paired with, for the settings screen. */
  server: { url: string; name: string | null } | null;
  /** The last failure worth showing, in words. */
  error: string | null;
  /** Open the namespace now that the device holds keys (after a pairing, a
   *  recovery or an approval), or again after the server was unreachable. */
  activate: () => Promise<void>;
  /** Sign this device out and erase its keys: it has to pair again. The
   *  hours on this device and the copy on the server are untouched. */
  unpair: () => Promise<void>;
  /** The connect sheet: open (with a code the camera handed over, if any). */
  connectRequest: { payload: string } | null;
  requestConnect: (payload?: string) => void;
  closeConnect: () => void;
};

export function useSelfHosted(): SelfHosted {
  // One client for the life of the page: it holds the session and the
  // decrypted namespace keys in memory, and its keys live in the vault.
  const clientRef = useRef<RecorderClient | null>(null);
  clientRef.current ??= createRecorderClient();
  const client = clientRef.current;

  const [phase, setPhase] = useState<SelfHostedPhase>("loading");
  const [namespace, setNamespace] = useState<StorageNamespace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectRequest, setConnectRequest] = useState<{
    payload: string;
  } | null>(null);

  const activate = useCallback(async (): Promise<void> => {
    // Paired but still waiting for keys (the sheet was closed while another
    // device had yet to approve): say so rather than try the namespace.
    if (client.state !== "ready") {
      setPhase(client.state);
      return;
    }
    try {
      const ns = await openRecorderNamespace(client, localStorage);
      setNamespace(ns);
      setPhase("ready");
      setError(null);
      log.info("namespace open");
    } catch (err) {
      setNamespace(null);
      if (isOfflineError(err)) {
        setPhase("unreachable");
        log.warn("server unreachable — working on this device's copy");
        return;
      }
      if (err instanceof AuthError) {
        // Revoked from another device or the admin console, or the account
        // was disabled: the pairing is gone, the reader must pair again.
        setPhase("signed-out");
      }
      const detail = describeStorageError(err);
      setError(detail);
      log.error(`opening the namespace failed — ${detail}`);
    }
  }, [client]);

  // Start: restore the pairing from the vault, and pick up a pairing code an
  // app link opened the page with — then wipe it from the address bar.
  useEffect(() => {
    const code = pairingFromUrl(window.location.href);
    if (code) {
      window.history.replaceState(
        null,
        "",
        withoutPairing(window.location.href),
      );
      setConnectRequest({ payload: code });
    }
    let live = true;
    void (async () => {
      try {
        const state = await client.restore();
        if (!live) return;
        if (state === "ready") await activate();
        else setPhase(state);
      } catch (err) {
        if (!live) return;
        setPhase("signed-out");
        setError(describeStorageError(err));
      }
    })();
    return () => {
      live = false;
    };
  }, [activate, client]);

  // Back online: try the server again rather than waiting to be asked.
  useEffect(() => {
    if (phase !== "unreachable") return;
    const retry = () => void activate();
    window.addEventListener("online", retry);
    const timer = setInterval(retry, 60_000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(timer);
    };
  }, [activate, phase]);

  const unpair = useCallback(async (): Promise<void> => {
    await client.signOut({ forget: true });
    forgetNamespace(localStorage);
    setNamespace(null);
    setPhase("signed-out");
    setError(null);
    log.info("unpaired this device");
  }, [client]);

  const requestConnect = useCallback(
    (payload = "") => setConnectRequest({ payload }),
    [],
  );
  const closeConnect = useCallback(() => setConnectRequest(null), []);

  const session = client.session;
  const serverUrl = session?.serverUrl ?? null;
  const serverName = session?.serverName ?? null;
  // One object per change, not per render: the engine's callbacks close over it.
  return useMemo(
    () => ({
      phase,
      namespace,
      client,
      server: serverUrl ? { url: serverUrl, name: serverName } : null,
      error,
      activate,
      unpair,
      connectRequest,
      requestConnect,
      closeConnect,
    }),
    [
      phase,
      namespace,
      client,
      serverUrl,
      serverName,
      error,
      activate,
      unpair,
      connectRequest,
      requestConnect,
      closeConnect,
    ],
  );
}
