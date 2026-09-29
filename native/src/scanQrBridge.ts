// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCAN-QR BRIDGE: how the page reads a pairing code with the camera.
//
// Connecting this phone to the reader's own storage server takes a one-time
// pairing code, shown as a QR code by the server or by another of the
// reader's devices. The phone's own camera app would open that code's link in
// the browser — the website, not this app — so the wrapper offers the page a
// CAPABILITY instead, the framework's `scan-qr` contract (oss-framework's
// `docs/native-shell.md`): it advertises it in `window.__ossShell` before the
// page loads, the framework's `scanQrCode` then posts a request here when the
// reader taps Scan, `QrScanner.tsx` opens the camera, reads one code and
// closes, and the text goes back to the page — which checks it is a pairing
// code and takes it down the same path as a pasted one.
//
// The camera is asked for then, when the reader asked to scan, never at
// launch. No frame is kept: only the decoded text leaves the scanner.
//
// Same shape as the other bridges: the STRINGS and the pure narrowing live
// here, and nothing that reaches `expo` — not even a type — so the root test
// suite can run them against the framework's own `scanQrCode`
// (`tests/native_scan_qr_test.ts`); the camera lives in `QrScanner.tsx`.

/** The message the page posts. The FRAMEWORK's name (`SCAN_QR_MESSAGE` in
 *  `@niclaslindstedt/oss-framework/qr`), not this app's: a drift is not an
 *  error, it is a Scan button that does nothing. The root test pins the two
 *  together. */
export const SCAN_QR_TYPE = "oss-framework/scan-qr";

/** The window event that settles the page's promise (`SCAN_QR_RESULT_EVENT`). */
export const SCAN_QR_RESULT_EVENT = "oss-framework/scan-qr-result";

/** The one version of the message this shell speaks. */
export const SCAN_QR_VERSION = 1;

/** Injected before the page loads, so the framework finds the capability on
 *  its first read. Merges into a descriptor another contract may already have
 *  put there, and adds the name once however often it runs. */
export const SCAN_QR_DESCRIPTOR = `(function () {
  var shell = window.__ossShell;
  if (!shell || typeof shell !== "object") shell = { version: 1, capabilities: [] };
  if (!Array.isArray(shell.capabilities)) shell.capabilities = [];
  if (shell.capabilities.indexOf("scan-qr") < 0) shell.capabilities.push("scan-qr");
  window.__ossShell = shell;
})(); true;`;

export type ScanQrLabels = { hint?: string; cancel?: string };

export type ScanQrRequest = {
  type: string;
  version: number;
  id: string;
  labels?: ScanQrLabels;
};

export type ScanQrAnswer =
  | { ok: true; text: string | null }
  | { ok: false; reason: "denied" | "unavailable"; error?: string };

/** Whether a message from the page is a scan request. The version is checked
 *  by the caller, which answers one it does not know. */
export function isScanQrRequest(value: unknown): value is ScanQrRequest {
  const m = value as Partial<ScanQrRequest> | null;
  return (
    typeof m === "object" &&
    m !== null &&
    m.type === SCAN_QR_TYPE &&
    typeof m.version === "number" &&
    typeof m.id === "string" &&
    m.id.length > 0 &&
    m.id.length <= 64
  );
}

/** Whether a message came from the page this wrapper serves. Only the bundled
 *  page may open the camera — never a page some link navigated the WebView
 *  to. */
export function isFromOrigin(url: string | undefined, origin: string): boolean {
  if (typeof url !== "string" || origin === "") return false;
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  return url === origin || url.startsWith(base);
}

/** The answer to a request the shell will not open a scanner for: a version
 *  it does not speak, or a second scan while one is open. */
export function refusal(
  request: ScanQrRequest,
  scanOpen: boolean,
): ScanQrAnswer | null {
  if (request.version !== SCAN_QR_VERSION) {
    return { ok: false, reason: "unavailable", error: "Unsupported version." };
  }
  if (scanOpen) {
    return {
      ok: false,
      reason: "unavailable",
      error: "A scan is already open.",
    };
  }
  return null;
}

/** A label the page sent, or the shell's own. */
export function scanLabel(
  request: ScanQrRequest,
  key: keyof ScanQrLabels,
  fallback: string,
): string {
  const value = request.labels?.[key];
  return typeof value === "string" && value.trim() !== ""
    ? value.slice(0, 200)
    : fallback;
}

/** The script that settles the page's promise. The text is a one-time secret:
 *  it goes into this script and nowhere else — never a log. */
export function scanQrResultScript(id: string, answer: ScanQrAnswer): string {
  const detail = JSON.stringify({ id, ...answer })
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/<\/(script)/gi, "<\\/$1");
  return `window.dispatchEvent(new CustomEvent(${JSON.stringify(
    SCAN_QR_RESULT_EVENT,
  )}, { detail: ${detail} })); true;`;
}
