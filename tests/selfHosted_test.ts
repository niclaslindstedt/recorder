// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The self-hosted backend's decisions (`src/app/selfHosted.ts`): which codes a
// device will pair with, how an app link hands one over and is then wiped
// from the address bar, what a device calls itself, and which namespace holds
// the document. The pairing itself and the encryption are the framework's,
// tested there against a real server.

import { describe, expect, it } from "vitest";

import {
  formatStoragePayload,
  StorageNotFoundError,
  type StorageNamespace,
} from "@niclaslindstedt/oss-framework/storage";

import {
  NAMESPACE_KEY,
  NAMESPACE_NAME,
  SELF_HOSTED_APP,
  checkPairing,
  defaultDeviceName,
  forgetNamespace,
  openRecorderNamespace,
  pairingFromUrl,
  withoutPairing,
} from "../src/app/selfHosted.ts";

const SERVER = "https://home.example.org";
const serverCode = formatStoragePayload({
  kind: "pair",
  server: SERVER,
  code: "A".repeat(43),
  name: "home",
});
const deviceCode = formatStoragePayload({
  kind: "pair",
  server: SERVER,
  secret: new Uint8Array(32).fill(7),
});
const invite = formatStoragePayload({
  kind: "invite",
  server: SERVER,
  secret: new Uint8Array(32).fill(9),
  role: "viewer",
});
const appLink = (code: string) =>
  formatStoragePayload(
    {
      kind: "pair",
      server: SERVER,
      code: new URL(
        code.replace("oss-storage://", "https://x/"),
      ).searchParams.get("c")!,
    },
    "https://time.example.org/",
  );

describe("checkPairing", () => {
  it("accepts a code the server made, naming the server", () => {
    expect(checkPairing(serverCode)).toEqual({
      ok: true,
      server: SERVER,
      serverName: "home",
      fromDevice: false,
    });
  });

  it("knows a code another device made — it carries the keys", () => {
    expect(checkPairing(deviceCode)).toMatchObject({
      ok: true,
      fromDevice: true,
    });
  });

  it("reads an app link as well as a bare code, around stray whitespace", () => {
    expect(checkPairing(`  ${appLink(serverCode)}\n`)).toMatchObject({
      ok: true,
      server: SERVER,
    });
  });

  it("refuses an invite to a shared space, and says so", () => {
    expect(checkPairing(invite)).toEqual({ ok: false, reason: "invite" });
  });

  it("refuses nothing and nonsense", () => {
    expect(checkPairing("   ")).toEqual({ ok: false, reason: "empty" });
    expect(checkPairing("https://example.org/")).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(
      checkPairing("oss-storage://pair?v=1&s=ftp%3A%2F%2Fx&c=abc"),
    ).toMatchObject({
      ok: false,
      reason: "invalid",
      message: expect.any(String),
    });
  });
});

describe("app links", () => {
  it("pick the pairing code out of the address the camera opened", () => {
    const href = appLink(serverCode);
    expect(pairingFromUrl(href)).toBe(href.slice(href.indexOf("#oss=")));
    expect(checkPairing(pairingFromUrl(href)!).ok).toBe(true);
  });

  it("ignore an address with no code, or a damaged one", () => {
    expect(pairingFromUrl("https://time.example.org/")).toBeNull();
    expect(pairingFromUrl("https://time.example.org/#oss=%%%")).toBeNull();
  });

  it("are wiped from the address once read", () => {
    const href = appLink(serverCode);
    expect(withoutPairing(href)).toBe("https://time.example.org/");
    expect(withoutPairing("https://time.example.org/#/settings")).toBe(
      "https://time.example.org/#/settings",
    );
  });
});

describe("defaultDeviceName", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      "Recorder on iPhone",
    ],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9)", "Recorder on Android"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)", "Recorder on Mac"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Recorder on Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64)", "Recorder on Linux"],
    ["", "Recorder on Browser"],
  ])("%s → %s", (ua, name) => {
    expect(defaultDeviceName(ua)).toBe(name);
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

/** A client with namespaces `existing`, recording what it was asked. */
function fakeClient(existing: string[], opts: { gone?: string[] } = {}) {
  const calls: string[] = [];
  const ns = (id: string) => ({ id }) as unknown as StorageNamespace;
  return {
    calls,
    async namespace(id: string) {
      calls.push(`open ${id}`);
      if (opts.gone?.includes(id)) throw new StorageNotFoundError("namespace");
      if (!existing.includes(id)) throw new Error("offline");
      return ns(id);
    },
    async namespaces(app?: string) {
      calls.push(`list ${app}`);
      return existing.map((id) => ({ id })) as never;
    },
    async createNamespace(meta: { name: string }) {
      calls.push(`create ${meta.name}`);
      return ns("ns_new");
    },
  };
}

describe("openRecorderNamespace", () => {
  it("creates the namespace on an account's first device, and remembers it", async () => {
    const storage = memoryStorage();
    const client = fakeClient([]);
    const ns = await openRecorderNamespace(client, storage);
    expect(ns.id).toBe("ns_new");
    expect(client.calls).toEqual([
      `list ${SELF_HOSTED_APP}`,
      `create ${NAMESPACE_NAME}`,
    ]);
    expect(JSON.parse(storage.data.get(NAMESPACE_KEY)!)).toEqual({
      namespaceId: "ns_new",
    });
  });

  it("joins the namespace another device made, rather than a second one", async () => {
    const client = fakeClient(["ns_a", "ns_b"]);
    expect((await openRecorderNamespace(client, memoryStorage())).id).toBe(
      "ns_a",
    );
    expect(client.calls).not.toContain(`create ${NAMESPACE_NAME}`);
  });

  it("reopens the remembered one without listing", async () => {
    const storage = memoryStorage({
      [NAMESPACE_KEY]: JSON.stringify({ namespaceId: "ns_b" }),
    });
    const client = fakeClient(["ns_a", "ns_b"]);
    expect((await openRecorderNamespace(client, storage)).id).toBe("ns_b");
    expect(client.calls).toEqual(["open ns_b"]);
  });

  it("looks again when the remembered one is gone", async () => {
    const storage = memoryStorage({
      [NAMESPACE_KEY]: JSON.stringify({ namespaceId: "ns_old" }),
    });
    const client = fakeClient(["ns_a"], { gone: ["ns_old"] });
    expect((await openRecorderNamespace(client, storage)).id).toBe("ns_a");
    expect(JSON.parse(storage.data.get(NAMESPACE_KEY)!).namespaceId).toBe(
      "ns_a",
    );
  });

  it("does not paper over being offline", async () => {
    const storage = memoryStorage({
      [NAMESPACE_KEY]: JSON.stringify({ namespaceId: "ns_far" }),
    });
    await expect(
      openRecorderNamespace(fakeClient([]), storage),
    ).rejects.toThrow("offline");
  });

  it("forgets", () => {
    const storage = memoryStorage({ [NAMESPACE_KEY]: "{}" });
    forgetNamespace(storage);
    expect(storage.data.has(NAMESPACE_KEY)).toBe(false);
  });
});
