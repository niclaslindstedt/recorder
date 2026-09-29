// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The scan-qr bridge (`native/src/scanQrBridge.ts`) against the framework's
// `scanQrCode`, which is the page's half of the same contract, and the
// pairing sheet's scan (`scanPairing` in `src/app/selfHosted.ts`) through it.
//
// Every failure on this seam is silent: a descriptor the framework does not
// read leaves the pairing sheet without its Scan button, and a result it does
// not recognise leaves a scan waiting forever. So the injected script is RUN
// against a stand-in for the WebView's window, the request the framework
// posts is checked the way `App.tsx` checks it, and the answer goes back
// through the script the shell injects.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SCAN_QR_MESSAGE,
  SCAN_QR_RESULT_EVENT,
  ScanQrError,
  canScanQrCode,
  scanQrCode,
  type ScanQrMessage,
} from "@niclaslindstedt/oss-framework/qr";
import { formatStoragePayload } from "@niclaslindstedt/oss-framework/storage";

import {
  SCAN_QR_DESCRIPTOR,
  SCAN_QR_RESULT_EVENT as SHELL_RESULT_EVENT,
  SCAN_QR_TYPE,
  SCAN_QR_VERSION,
  isFromOrigin,
  isScanQrRequest,
  refusal,
  scanLabel,
  scanQrResultScript,
  type ScanQrAnswer,
} from "../native/src/scanQrBridge.ts";
import { SAVE_FILE_DESCRIPTOR } from "../native/src/saveFileBridge.ts";
import { en } from "../src/app/i18n/en.ts";
import {
  checkPairing,
  pairingHintKey,
  scanPairing,
  scanProblemKey,
} from "../src/app/selfHosted.ts";

type Win = EventTarget & Record<string, unknown>;

/** Run an injected script the way the WebView would, against the stubbed
 *  global `window`. */
function inject(script: string): void {
  new Function(script)();
}

/** The phone app's WebView: react-native-webview's bridge, which hands every
 *  scan request to `answer` the way `App.tsx` does — narrowed, then answered
 *  a turn later through the script the shell injects. `null` leaves it open. */
function stubShell(
  answer: (request: ScanQrMessage) => ScanQrAnswer | null,
  { descriptor = true } = {},
): { win: Win; posted: ScanQrMessage[] } {
  const posted: ScanQrMessage[] = [];
  const win = new EventTarget() as Win;
  win.ReactNativeWebView = {
    postMessage: (data: string) => {
      const parsed: unknown = JSON.parse(data);
      if (!isScanQrRequest(parsed)) return;
      posted.push(parsed as ScanQrMessage);
      const reply = answer(parsed as ScanQrMessage);
      if (reply) setTimeout(() => inject(scanQrResultScript(parsed.id, reply)));
    },
  };
  vi.stubGlobal("window", win);
  if (descriptor) inject(SCAN_QR_DESCRIPTOR);
  return { win, posted };
}

const SERVER = "https://home.example.org";
const serverCode = formatStoragePayload({
  kind: "pair",
  server: SERVER,
  code: "A".repeat(43),
  name: "home",
});
const invite = formatStoragePayload({
  kind: "invite",
  server: SERVER,
  secret: new Uint8Array(32).fill(9),
  role: "viewer",
});
const labels = {
  hint: "Point the camera at the pairing code",
  cancel: "Cancel",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the contract's names", () => {
  it("are the framework's", () => {
    expect(SCAN_QR_TYPE).toBe(SCAN_QR_MESSAGE);
    expect(SHELL_RESULT_EVENT).toBe(SCAN_QR_RESULT_EVENT);
    expect(SCAN_QR_VERSION).toBe(1);
  });
});

describe("the descriptor", () => {
  it("advertises scan-qr, which is what shows the Scan button", () => {
    const win = new EventTarget() as Win;
    win.ReactNativeWebView = { postMessage: () => {} };
    vi.stubGlobal("window", win);
    expect(canScanQrCode()).toBe(false);
    inject(SCAN_QR_DESCRIPTOR);
    expect(win.__ossShell).toEqual({ version: 1, capabilities: ["scan-qr"] });
    expect(canScanQrCode()).toBe(true);
  });

  it("sits beside save-file in the one descriptor, each name once", () => {
    const win = new EventTarget() as Win;
    win.ReactNativeWebView = { postMessage: () => {} };
    vi.stubGlobal("window", win);
    inject(SAVE_FILE_DESCRIPTOR);
    inject(SCAN_QR_DESCRIPTOR);
    inject(SCAN_QR_DESCRIPTOR);
    expect(win.__ossShell).toEqual({
      version: 1,
      capabilities: ["save-file", "scan-qr"],
    });
  });

  it("is absent in a browser tab, which keeps pasting", () => {
    vi.stubGlobal("window", new EventTarget());
    expect(canScanQrCode()).toBe(false);
  });
});

describe("the request", () => {
  it("the framework posts is one the shell accepts, labels and all", async () => {
    const { posted } = stubShell(() => ({ ok: true, text: "hello" }));
    await expect(scanQrCode({ labels })).resolves.toBe("hello");
    expect(posted).toHaveLength(1);
    const [request] = posted;
    expect(request.type).toBe(SCAN_QR_TYPE);
    expect(request.version).toBe(SCAN_QR_VERSION);
    expect(scanLabel(request, "hint", "x")).toBe(labels.hint);
    expect(scanLabel(request, "cancel", "x")).toBe("Cancel");
    expect(refusal(request, false)).toBeNull();
  });

  it("is narrowed: the wrong type, no id or an overlong id is not one", () => {
    const ok = { type: SCAN_QR_TYPE, version: 1, id: "sq1" };
    expect(isScanQrRequest(ok)).toBe(true);
    expect(isScanQrRequest({ ...ok, type: "oss-framework/save-file" })).toBe(
      false,
    );
    expect(isScanQrRequest({ ...ok, id: "" })).toBe(false);
    expect(isScanQrRequest({ ...ok, id: "x".repeat(65) })).toBe(false);
    expect(isScanQrRequest({ ...ok, version: "1" })).toBe(false);
    expect(isScanQrRequest(null)).toBe(false);
  });

  it("falls back to the shell's words when the page sends none", () => {
    const request = { type: SCAN_QR_TYPE, version: 1, id: "sq1" };
    expect(scanLabel(request, "hint", "Point the camera at the code")).toBe(
      "Point the camera at the code",
    );
    expect(
      scanLabel({ ...request, labels: { cancel: "  " } }, "cancel", "Cancel"),
    ).toBe("Cancel");
  });

  it("is refused for an unknown version, and while a scan is open", () => {
    const request = { type: SCAN_QR_TYPE, version: 2, id: "sq1" };
    expect(refusal(request, false)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    expect(refusal({ ...request, version: 1 }, true)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });

  it("opens the camera only from the page the wrapper serves", () => {
    const origin = "http://localhost:8251";
    expect(isFromOrigin("http://localhost:8251/", origin)).toBe(true);
    expect(isFromOrigin("http://localhost:8251/#/settings", origin)).toBe(true);
    expect(isFromOrigin("http://localhost:8251", origin)).toBe(true);
    expect(isFromOrigin("http://localhost:82510/", origin)).toBe(false);
    expect(isFromOrigin("https://example.org/", origin)).toBe(false);
    expect(isFromOrigin(undefined, origin)).toBe(false);
    expect(isFromOrigin("http://localhost:8251/", "")).toBe(false);
  });
});

describe("the answer", () => {
  it("settles the page's promise with the text, or null on a cancel", async () => {
    stubShell(() => ({ ok: true, text: serverCode }));
    await expect(scanQrCode()).resolves.toBe(serverCode);
    stubShell(() => ({ ok: true, text: null }));
    await expect(scanQrCode()).resolves.toBeNull();
  });

  it("carries a refusal the page can tell apart", async () => {
    stubShell(() => ({ ok: false, reason: "denied" }));
    const denied = await scanQrCode().catch((e: unknown) => e);
    expect(denied).toBeInstanceOf(ScanQrError);
    expect((denied as ScanQrError).reason).toBe("denied");
  });

  it("survives text that would break a naive script", async () => {
    const text = 'a"b\\c\u2028d\u2029e</script>f';
    stubShell(() => ({ ok: true, text }));
    await expect(scanQrCode()).resolves.toBe(text);
  });

  it("puts the scanned text in the answer script and nowhere else", () => {
    const log = vi.spyOn(console, "log");
    const script = scanQrResultScript("sq1", { ok: true, text: serverCode });
    expect(script).toContain(SCAN_QR_RESULT_EVENT);
    expect(log).not.toHaveBeenCalled();
  });
});

describe("the pairing sheet's scan", () => {
  it("hands back a pairing code, the string a paste gives", async () => {
    const { posted } = stubShell(() => ({
      ok: true,
      text: `  ${serverCode}\n`,
    }));
    const outcome = await scanPairing(labels);
    expect(outcome).toEqual({ kind: "code", code: serverCode });
    expect(posted[0].labels).toEqual(labels);
    if (outcome.kind === "code")
      expect(checkPairing(outcome.code).ok).toBe(true);
  });

  it("takes an app link that carries the code", async () => {
    const link = formatStoragePayload(
      { kind: "pair", server: SERVER, code: "B".repeat(43) },
      "https://recorder.example.org/",
    );
    stubShell(() => ({ ok: true, text: link }));
    await expect(scanPairing(labels)).resolves.toEqual({
      kind: "code",
      code: link,
    });
  });

  it("says cancelled when the reader closed the scanner", async () => {
    stubShell(() => ({ ok: true, text: null }));
    await expect(scanPairing(labels)).resolves.toEqual({ kind: "cancelled" });
  });

  it("says denied when the camera is off, so the sheet points to Settings", async () => {
    stubShell(() => ({ ok: false, reason: "denied" }));
    await expect(scanPairing(labels)).resolves.toEqual({ kind: "denied" });
  });

  it("says unavailable when the camera failed, or there is no scanner", async () => {
    stubShell(() => ({ ok: false, reason: "unavailable", error: "no camera" }));
    await expect(scanPairing(labels)).resolves.toEqual({ kind: "unavailable" });
    stubShell(() => null, { descriptor: false });
    await expect(scanPairing(labels)).resolves.toEqual({ kind: "unavailable" });
  });

  it("refuses an invite, and a QR code that is no storage code", async () => {
    stubShell(() => ({ ok: true, text: invite }));
    await expect(scanPairing(labels)).resolves.toEqual({ kind: "invite" });
    stubShell(() => ({ ok: true, text: "https://example.org/menu" }));
    await expect(scanPairing(labels)).resolves.toMatchObject({
      kind: "invalid",
    });
  });
});

describe("what the pairing sheet says", () => {
  const say = (key: string) =>
    en.selfHosted[key.replace("selfHosted.", "") as keyof typeof en.selfHosted];

  it("sends a reader who refused the camera to Settings, or to pasting", () => {
    const text = say(scanProblemKey({ kind: "denied" }));
    expect(text).toMatch(/Settings/);
    expect(text).toMatch(/paste/i);
  });

  it("has words for every way a scan brings no code", () => {
    for (const outcome of [
      { kind: "denied" },
      { kind: "unavailable" },
      { kind: "invite" },
      { kind: "invalid", message: "x" },
    ] as const) {
      expect(say(scanProblemKey(outcome))).toBeTruthy();
    }
  });

  it("tells the phone app to tap Scan, and the website to use a camera", () => {
    const phone = say(pairingHintKey(true));
    const web = say(pairingHintKey(false));
    expect(phone).toMatch(/tap Scan/);
    expect(phone).not.toMatch(/phone's camera/);
    expect(phone).toMatch(/paste/);
    expect(web).toMatch(/camera/);
    expect(web).not.toMatch(/tap Scan/);
  });
});
