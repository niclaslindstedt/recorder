// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The reader's own storage server is offered on the website and in the desktop
// app, and — the owner's decision, until it has been proven on the web — not
// at all in the phone app's store build (`VITE_EDITION=store`): not on the
// picker, not in the sentences over it or in the privacy note, not as a
// pairing sheet, and not as a stored choice an earlier install left behind,
// which reads as this device so the recordings carry on from the local copy.

import { afterEach, describe, expect, it, vi } from "vitest";

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  const sync = await import("../src/app/useSyncEngine.ts");
  const { en } = await import("../src/app/i18n/en.ts");
  return { sync, en };
}

/** A device's localStorage holding one stored backend choice. */
function storedBackend(value: string): void {
  const items = new Map([["recorder:sync:backend", value]]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, next: string) => void items.set(key, next),
    removeItem: (key: string) => void items.delete(key),
  });
}

/** Every sentence in a catalog, flattened. */
function sentences(catalog: object): string[] {
  return Object.values(catalog).flatMap((value: unknown) =>
    typeof value === "string"
      ? [value]
      : value && typeof value === "object"
        ? sentences(value)
        : [],
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the phone app's store build", () => {
  const STORE = { VITE_EDITION: "store" };

  it("offers no server on the picker", async () => {
    const { sync } = await load(STORE);
    expect(sync.AVAILABLE_BACKENDS).not.toContain("selfhosted");
    expect(sync.PROVIDER_NAMES.selfhosted).toBe("");
  });

  it("reads a server choice left by an earlier install as this device", async () => {
    const { sync } = await load(STORE);
    storedBackend("selfhosted");
    expect(sync.readBackend()).toBe("local");
  });

  it("carries no sentence about a server, its pairing or the camera", async () => {
    const { en } = await load(STORE);
    expect(en.selfHosted).toEqual({});
    for (const sentence of sentences(en)) {
      expect(sentence).not.toMatch(/storage server|your server|pairing/i);
      expect(sentence).not.toMatch(/camera/i);
    }
    expect(en.settings.syncHintICloud).toMatch(/iCloud/);
  });
});

describe("the website and the desktop app", () => {
  it("offer the server, and keep a choice of it", async () => {
    const { sync, en } = await load({});
    expect(sync.AVAILABLE_BACKENDS).toContain("selfhosted");
    expect(sync.PROVIDER_NAMES.selfhosted).toBe("Your server");
    expect(en.selfHosted.title).toBe("Connect to your server");
    expect(en.settings.syncHint).toMatch(/storage server/);
    storedBackend("selfhosted");
    expect(sync.readBackend()).toBe("selfhosted");
  });
});
