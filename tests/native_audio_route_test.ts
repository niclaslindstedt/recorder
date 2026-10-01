// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WRAPPER'S HALF OF THE AUDIO-ROUTE SEAM, pinned against the app's.
//
// `native/src/audioRouteBridge.ts` installs a host into the page and
// `src/app/audioHost.ts` looks for one. Between them sit three strings — the
// property, the announcement and the change event — and a mismatch in any of
// them fails SILENTLY: the Microphone sheet simply never offers the phone's
// own routes. So they are pinned here, from both sides, along with the
// import discipline that lets the root suite reach the bridge at all (see
// `native_icloud_test.ts`).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  AUDIO_HOST_EVENT,
  AUDIO_HOST_METHODS,
  AUDIO_HOST_PROPERTY,
  AUDIO_ROUTES_EVENT,
  EARPIECE_ID,
  SPEAKER_ID,
  getAudioHost,
  parseRoutes,
} from "../src/app/audioHost.ts";
import {
  AUDIO_ROUTE_REQUEST_TYPE,
  AUDIO_ROUTE_SCRIPT,
  ROUTES_CHANGED_SCRIPT,
  audioRouteResolveScript,
  isAudioRouteRequest,
} from "../native/src/audioRouteBridge.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

const OWN = { speaker: "Speaker", earpiece: "Earpiece" };

describe("the strings the two halves share", () => {
  it("installs the host where the app looks for it", () => {
    expect(AUDIO_ROUTE_SCRIPT).toContain(`window.${AUDIO_HOST_PROPERTY} =`);
  });

  it("announces itself, and the routes changing, with the app's events", () => {
    expect(AUDIO_ROUTE_SCRIPT).toContain(JSON.stringify(AUDIO_HOST_EVENT));
    expect(ROUTES_CHANGED_SCRIPT).toContain(JSON.stringify(AUDIO_ROUTES_EVENT));
  });

  it("offers every method the app requires of a host", () => {
    for (const method of AUDIO_HOST_METHODS) {
      expect(AUDIO_ROUTE_SCRIPT, `the script must define ${method}`).toContain(
        `${method}: function`,
      );
    }
  });

  it("uses the ids for the loudspeaker and earpiece the app names", () => {
    // Both modules list the phone's own loudspeaker under the id the page
    // puts its own word on.
    const swift = read("native/modules/audio-route/ios/AudioRouteModule.swift");
    const kotlin = read(
      "native/modules/audio-route/android/src/main/java/expo/modules/audioroute/AudioRouteModule.kt",
    );
    expect(swift).toContain(`private let SPEAKER = "${SPEAKER_ID}"`);
    expect(kotlin).toContain(`private const val SPEAKER = "${SPEAKER_ID}"`);
    expect(kotlin).toContain(`private const val EARPIECE = "${EARPIECE_ID}"`);
  });
});

describe("isAudioRouteRequest", () => {
  const base = { type: AUDIO_ROUTE_REQUEST_TYPE, id: "a1" };

  it("takes the calls that need nothing else", () => {
    expect(isAudioRouteRequest({ ...base, method: "routes" })).toBe(true);
    expect(
      isAudioRouteRequest({ ...base, method: "routes", interactive: true }),
    ).toBe(true);
    expect(isAudioRouteRequest({ ...base, method: "showPicker" })).toBe(true);
  });

  it("takes a port to prefer, or none to hand the choice back", () => {
    for (const method of ["setInput", "setOutput"]) {
      expect(isAudioRouteRequest({ ...base, method, target: "uid-1" })).toBe(
        true,
      );
      expect(isAudioRouteRequest({ ...base, method, target: null })).toBe(true);
      expect(isAudioRouteRequest({ ...base, method, target: "" })).toBe(false);
      expect(isAudioRouteRequest({ ...base, method, target: 7 })).toBe(false);
      expect(
        isAudioRouteRequest({ ...base, method, target: "x".repeat(513) }),
      ).toBe(false);
    }
  });

  it("refuses anything that is not one of ours", () => {
    expect(isAudioRouteRequest({ ...base, method: "record" })).toBe(false);
    expect(
      isAudioRouteRequest({ ...base, method: "routes", interactive: "yes" }),
    ).toBe(false);
    expect(
      isAudioRouteRequest({ type: "other", id: "a1", method: "routes" }),
    ).toBe(false);
    expect(isAudioRouteRequest({ ...base, id: "", method: "routes" })).toBe(
      false,
    );
    expect(isAudioRouteRequest(null)).toBe(false);
  });
});

/** Install the bridge's host on a stand-in `window` whose channel answers
 *  each request with `answer` — the round trip the wrapper makes. */
function installed(answer: (request: Record<string, unknown>) => unknown) {
  const stand: Record<string, unknown> = { dispatchEvent: () => true };
  const sent: Record<string, unknown>[] = [];
  stand.ReactNativeWebView = {
    postMessage: (text: string) => {
      const request = JSON.parse(text) as Record<string, unknown>;
      sent.push(request);
      queueMicrotask(() =>
        new Function(
          "window",
          "JSON",
          audioRouteResolveScript(
            request.id as string,
            answer(request) as never,
          ),
        )(stand, JSON),
      );
    },
  };
  new Function("window", "Promise", AUDIO_ROUTE_SCRIPT)(stand, Promise);
  return { stand, sent };
}

describe("the host the script installs", () => {
  it("is one the app accepts", () => {
    const { stand } = installed(() => ({ ok: true, value: null }));
    const globals = globalThis as { window?: unknown };
    const had = "window" in globals;
    const previous = globals.window;
    globals.window = stand;
    try {
      expect(getAudioHost()).not.toBeNull();
    } finally {
      if (had) globals.window = previous;
      else delete globals.window;
    }
  });

  it("carries the routes back as the app reads them", async () => {
    const { stand, sent } = installed(() => ({
      ok: true,
      value: {
        inputs: [{ id: "mic-1", name: "iPhone Microphone" }],
        outputs: [
          { id: "bt-1", name: "AirPods Pro" },
          { id: "speaker", name: "Speaker" },
        ],
        inputNow: "iPhone Microphone",
        outputNow: "AirPods Pro",
        picker: true,
      },
    }));
    const host = stand[AUDIO_HOST_PROPERTY] as {
      routes(interactive?: boolean): Promise<unknown>;
    };
    const routes = parseRoutes(await host.routes(true), OWN);
    expect(sent[0]).toMatchObject({ method: "routes", interactive: true });
    expect(routes).toEqual({
      inputs: [{ id: "mic-1", name: "iPhone Microphone" }],
      outputs: [
        { id: "bt-1", name: "AirPods Pro" },
        { id: "speaker", name: "Speaker" },
      ],
      inputNow: "iPhone Microphone",
      outputNow: "AirPods Pro",
      picker: true,
    });
  });

  it("sends a choice, and Automatic as null", async () => {
    const { stand, sent } = installed(() => ({ ok: true, value: null }));
    const host = stand[AUDIO_HOST_PROPERTY] as {
      setInput(id: string | null): Promise<unknown>;
      setOutput(id: string | null): Promise<unknown>;
    };
    await host.setInput("mic-1");
    await host.setOutput(null);
    expect(sent.map((r) => [r.method, r.target])).toEqual([
      ["setInput", "mic-1"],
      ["setOutput", null],
    ]);
    expect(sent.every((r) => isAudioRouteRequest(r))).toBe(true);
  });

  it("answers without a bridge rather than hanging", async () => {
    const stand = { dispatchEvent: () => true } as Record<string, unknown>;
    new Function("window", "Promise", AUDIO_ROUTE_SCRIPT)(stand, Promise);
    const host = stand[AUDIO_HOST_PROPERTY] as {
      routes(): Promise<unknown>;
    };
    // A failure, which leaves both sides to the page.
    expect(parseRoutes(await host.routes(), OWN)).toBeNull();
  });

  it("carries a device's name back as data, not as code", () => {
    let ran = 0;
    let result: unknown;
    const stand: Record<string, unknown> = {
      __recorderAudioResolve: (_id: string, answer: unknown) => {
        result = answer;
      },
      breakOut: () => {
        ran += 1;
      },
    };
    const name = '");window.breakOut();//\u2028 and on';
    const script = audioRouteResolveScript("a1", {
      ok: true,
      value: {
        inputs: [{ id: "x", name }],
        outputs: null,
        inputNow: null,
        outputNow: null,
        picker: false,
      },
    });
    new Function("window", "JSON", script)(stand, JSON);
    expect(ran).toBe(0);
    expect(parseRoutes(result, OWN)?.inputs).toEqual([{ id: "x", name }]);
  });
});

describe("what the root type-check may reach", () => {
  const forbidden = ["expo", "react-native", "expo-"];

  it("keeps the wire shapes free of every import", () => {
    expect(read("native/src/audioRouteWire.ts")).not.toMatch(/^\s*import\s/m);
  });

  it("keeps the bridge off the wrapper's own dependencies", () => {
    const source = read("native/src/audioRouteBridge.ts");
    for (const line of source.split("\n")) {
      if (!/^\s*import\s/.test(line)) continue;
      for (const name of forbidden) {
        expect(line).not.toContain(`"${name}`);
      }
    }
    expect(source).not.toContain('./audioRoute"');
  });
});
