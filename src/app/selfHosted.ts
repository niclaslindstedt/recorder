// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The self-hosted backend: a storage server the reader runs themselves — at
// home or on a host of their choosing — that holds only ciphertext.
//
// What this module owns is the part a cloud with OAuth does not have: the
// device is *paired* to the server with a one-time code (a QR from the
// server's admin console, or from another of the reader's devices), and its
// keys live in the device's key vault — IndexedDB holding non-extractable
// keys in a browser, the platform keystore in a native wrapper — never in
// localStorage and never on the server. Everything downstream is the
// framework's: `ns.adapter()` is an ordinary `StorageAdapter` over one file,
// `recorder-<space>.json`, so the engine's debounce, revision check, conflict and merge
// are the same code path Dropbox and iCloud take.
//
// Kept free of Preact so the decisions — which pairing a link carries, what
// the device is called, which namespace holds this app's document — are
// tested in the node environment like the rest of the domain
// (`tests/selfHosted_test.ts`). The hook that drives it is
// `useSelfHosted.ts`.

import {
  ScanQrError,
  type ScanQrLabels,
} from "@niclaslindstedt/oss-framework/qr";
import {
  createSelfHostedClient,
  defaultKeyVault,
  parseStoragePayload,
  scanStorageCode,
  StorageNotFoundError,
  StoragePayloadError,
  type KeyVault,
  type SelfHostedClient,
  type StorageNamespace,
} from "@niclaslindstedt/oss-framework/storage";

/** The app id this app's namespaces are created and listed under. */
export const SELF_HOSTED_APP = "recorder";

/** What the namespace is called — encrypted on the device, so the server
 *  never learns even this. */
export const NAMESPACE_NAME = "Recorder";

/** Which namespace holds the document, remembered per device. Not a secret:
 *  an id alone opens nothing without the keys in the vault. */
export const NAMESPACE_KEY = "recorder:sync:selfhosted";

/** The URL fragment a pairing QR carries when it is an app link:
 *  `https://<this app>/#oss=<code>`. A phone's camera opens the app with it. */
const APP_LINK_MARK = "#oss=";

/** The parts of the framework's client this app speaks — so a test can hand
 *  in a fake with the same shape and nothing else. */
export type RecorderClient = Pick<
  SelfHostedClient,
  | "state"
  | "session"
  | "restore"
  | "pair"
  | "accountHasKeys"
  | "createAccountKeys"
  | "recover"
  | "refreshKeys"
  | "safetyCode"
  | "waitForApproval"
  | "namespaces"
  | "namespace"
  | "createNamespace"
  | "addDevicePayload"
  | "pendingDevices"
  | "approveDevice"
  | "regenerateRecoveryKey"
  | "signOut"
>;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createRecorderClient(
  vault: KeyVault = defaultKeyVault(SELF_HOSTED_APP),
): SelfHostedClient {
  return createSelfHostedClient({ app: SELF_HOSTED_APP, vault });
}

/** A pasted or scanned code, checked before a byte goes to a server. */
export type PairingCheck =
  | { ok: true; server: string; serverName: string | null; fromDevice: boolean }
  | { ok: false; reason: "empty" | "invite" | "invalid"; message?: string };

/** Read a pairing code the reader pasted or scanned: a bare
 *  `oss-storage://pair?…` or an app link carrying one. An *invite* to someone
 *  else's shared space is refused here — joining one is not what this form
 *  does, and saying so beats a cryptic failure after the network call. */
export function checkPairing(text: string): PairingCheck {
  const input = text.trim();
  if (!input) return { ok: false, reason: "empty" };
  try {
    const p = parseStoragePayload(input);
    if (p.kind === "invite") return { ok: false, reason: "invite" };
    return {
      ok: true,
      server: p.server,
      serverName: p.name ?? null,
      // A code another device made carries the account key; the device is
      // ready the moment it pairs, with nothing more to ask.
      fromDevice: p.secret !== undefined,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "invalid",
      message: err instanceof StoragePayloadError ? err.message : undefined,
    };
  }
}

/** How a tap on Scan ended. `code` is the text as read — the string a paste
 *  gives — and goes down the same path; the rest say what to tell the reader. */
export type ScanOutcome =
  | { kind: "code"; code: string }
  | { kind: "cancelled" }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "invite" }
  | { kind: "invalid"; message?: string };

/** Scan a pairing code with the phone app's camera (the framework's scanner,
 *  offered only where `canScanQrCode()` is true) and say how it went. The
 *  scanned code is a one-time secret: it is returned, never logged or kept. */
export async function scanPairing(labels: ScanQrLabels): Promise<ScanOutcome> {
  try {
    const code = await scanStorageCode({ labels });
    return code === null ? { kind: "cancelled" } : { kind: "code", code };
  } catch (err) {
    if (err instanceof ScanQrError) {
      return { kind: err.reason === "denied" ? "denied" : "unavailable" };
    }
    if (err instanceof StoragePayloadError) {
      // An invite to a shared space is a storage code too, of the other kind:
      // the framework says so in its message (pinned by the tests).
      return err.message.startsWith("that is an invite")
        ? { kind: "invite" }
        : { kind: "invalid", message: err.message };
    }
    return { kind: "unavailable" };
  }
}

/** What the pairing sheet says when a scan brought no code back. Denied
 *  points to Settings, or to pasting — the paste field is always there. */
export function scanProblemKey(
  outcome: Exclude<ScanOutcome, { kind: "code" | "cancelled" }>,
):
  | "selfHosted.scanDenied"
  | "selfHosted.scanUnavailable"
  | "selfHosted.codeInvite"
  | "selfHosted.scanInvalid" {
  switch (outcome.kind) {
    case "denied":
      return "selfHosted.scanDenied";
    case "unavailable":
      return "selfHosted.scanUnavailable";
    case "invite":
      return "selfHosted.codeInvite";
    case "invalid":
      return "selfHosted.scanInvalid";
  }
}

/** How the pairing sheet tells the reader to hand it a code. The phone app
 *  scans in the app (its Scan button): the phone's own camera would open the
 *  code's link in the browser, not here. Everywhere else — the website, the
 *  desktop app — the code is scanned with a phone's camera or pasted. */
export function pairingHintKey(
  canScan: boolean,
): "selfHosted.codeHintScan" | "selfHosted.codeHint" {
  return canScan ? "selfHosted.codeHintScan" : "selfHosted.codeHint";
}

/** The pairing code an app link opened this page with, if any. */
export function pairingFromUrl(href: string): string | null {
  const at = href.indexOf(APP_LINK_MARK);
  if (at < 0) return null;
  const link = href.slice(at);
  return checkPairing(link).ok ? link : null;
}

/** The page's address with a pairing fragment removed, so the one-time code
 *  does not linger in the address bar, the history or a bookmark. */
export function withoutPairing(href: string): string {
  const at = href.indexOf(APP_LINK_MARK);
  return at < 0 ? href : href.slice(0, at);
}

/** What a new device calls itself in the server's device list, until the
 *  reader types something better. Read from the user agent's platform, never
 *  more than that. */
export function defaultDeviceName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  const what = /iphone/.test(ua)
    ? "iPhone"
    : /ipad/.test(ua)
      ? "iPad"
      : /android/.test(ua)
        ? "Android"
        : /mac os x|macintosh/.test(ua)
          ? "Mac"
          : /windows/.test(ua)
            ? "Windows"
            : /linux/.test(ua)
              ? "Linux"
              : "Browser";
  return `Recorder on ${what}`;
}

function readNamespaceId(storage: Store): string | null {
  try {
    const raw = storage.getItem(NAMESPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { namespaceId?: unknown };
    return typeof parsed.namespaceId === "string" ? parsed.namespaceId : null;
  } catch {
    return null;
  }
}

/** The namespace holding this app's document: the one this device used
 *  before; else the account's first `recorder` namespace (another device made
 *  it); else a new one. Remembered for the next start. */
export async function openRecorderNamespace(
  client: Pick<RecorderClient, "namespace" | "namespaces" | "createNamespace">,
  storage: Store,
): Promise<StorageNamespace> {
  const remembered = readNamespaceId(storage);
  let ns: StorageNamespace | null = null;
  if (remembered) {
    try {
      ns = await client.namespace(remembered);
    } catch (err) {
      // Deleted, or this account was removed from it: look again rather
      // than failing forever on a stale id. Anything else (offline) is real.
      if (!(err instanceof StorageNotFoundError)) throw err;
    }
  }
  if (!ns) {
    const [first] = await client.namespaces(SELF_HOSTED_APP);
    ns = first
      ? await client.namespace(first.id)
      : await client.createNamespace({ name: NAMESPACE_NAME });
  }
  storage.setItem(NAMESPACE_KEY, JSON.stringify({ namespaceId: ns.id }));
  return ns;
}

export function forgetNamespace(storage: Store): void {
  storage.removeItem(NAMESPACE_KEY);
}
