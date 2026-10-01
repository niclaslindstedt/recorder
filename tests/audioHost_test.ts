// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The audio-route seam (`audioHost.ts`): what the app accepts as a host, and
// what it reads out of one.

import { describe, expect, it } from "vitest";

import {
  AUDIO_HOST_METHODS,
  AUDIO_HOST_PROPERTY,
  getAudioHost,
  parseRoutes,
} from "../src/app/audioHost.ts";

const OWN = { speaker: "Speaker", earpiece: "Earpiece" };

const ok = (value: unknown) => ({ ok: true, value });

function host(overrides: Record<string, unknown> = {}) {
  const answer = () => Promise.resolve(ok(null));
  return {
    version: 1,
    routes: answer,
    setInput: answer,
    setOutput: answer,
    showPicker: answer,
    ...overrides,
  };
}

function withWindow<T>(value: unknown, read: () => T): T {
  const globals = globalThis as { window?: unknown };
  const had = "window" in globals;
  const previous = globals.window;
  globals.window = { [AUDIO_HOST_PROPERTY]: value };
  try {
    return read();
  } finally {
    if (had) globals.window = previous;
    else delete globals.window;
  }
}

describe("getAudioHost", () => {
  it("accepts a host with every method", () => {
    expect(withWindow(host(), getAudioHost)).not.toBeNull();
  });

  it("is null in a browser, which has none", () => {
    expect(getAudioHost()).toBeNull();
    expect(withWindow(undefined, getAudioHost)).toBeNull();
  });

  it("refuses another version, or one missing a method", () => {
    expect(withWindow(host({ version: 2 }), getAudioHost)).toBeNull();
    for (const method of AUDIO_HOST_METHODS) {
      expect(
        withWindow(host({ [method]: undefined }), getAudioHost),
      ).toBeNull();
    }
  });
});

describe("parseRoutes", () => {
  it("reads an iPhone's routes: both sides the host's", () => {
    expect(
      parseRoutes(
        ok({
          inputs: [
            { id: "Built-In Microphone", name: "iPhone Microphone" },
            { id: "00:11:22-tsco", name: "AirPods Pro" },
          ],
          outputs: [
            { id: "00:11:22-tacl", name: "AirPods Pro" },
            { id: "speaker", name: "Speaker" },
          ],
          inputNow: "iPhone Microphone",
          outputNow: "AirPods Pro",
          picker: true,
        }),
        OWN,
      ),
    ).toEqual({
      inputs: [
        { id: "Built-In Microphone", name: "iPhone Microphone" },
        { id: "00:11:22-tsco", name: "AirPods Pro" },
      ],
      outputs: [
        { id: "00:11:22-tacl", name: "AirPods Pro" },
        { id: "speaker", name: "Speaker" },
      ],
      inputNow: "iPhone Microphone",
      outputNow: "AirPods Pro",
      picker: true,
    });
  });

  it("leaves Android's microphone to the page, and names its speaker", () => {
    // The WebView already chooses the microphone by `deviceId`; the host
    // only routes the output. An Android phone calls its own loudspeaker by
    // the phone's model, so the page says it in its own words.
    const routes = parseRoutes(
      ok({
        inputs: null,
        outputs: [
          { id: "speaker", name: "Pixel 8" },
          { id: "earpiece", name: "Pixel 8" },
          { id: "bt:AA:BB", name: "Pixel Buds Pro" },
        ],
        inputNow: null,
        outputNow: null,
        picker: true,
      }),
      OWN,
    );
    expect(routes?.inputs).toBeNull();
    expect(routes?.outputs).toEqual([
      { id: "speaker", name: "Speaker" },
      { id: "earpiece", name: "Earpiece" },
      { id: "bt:AA:BB", name: "Pixel Buds Pro" },
    ]);
  });

  it("is nothing for a failure or a stranger's answer", () => {
    expect(parseRoutes({ ok: false, message: "no" }, OWN)).toBeNull();
    expect(parseRoutes(ok(null), OWN)).toBeNull();
    expect(parseRoutes(ok("routes"), OWN)).toBeNull();
    expect(parseRoutes(null, OWN)).toBeNull();
  });

  it("reads what it cannot use as nothing to say", () => {
    expect(
      parseRoutes(ok({ inputs: "all", outputNow: 4, picker: "yes" }), OWN),
    ).toEqual({
      inputs: null,
      outputs: null,
      inputNow: null,
      outputNow: null,
      picker: false,
    });
  });
});
