// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Microphone sheet's lists and its remembered choices (`devices.ts`).

import { describe, expect, it } from "vitest";

import {
  choiceOf,
  parseChoice,
  parseDevices,
  resolveChoice,
  webDevices,
  type MediaDeviceLike,
} from "../src/app/devices.ts";
import { DEFAULT_SETTINGS, parseSettings } from "../src/app/useAppSettings.ts";

const unnamed = (n: number) => `Microphone ${n}`;

const mic = (deviceId: string, label: string): MediaDeviceLike => ({
  deviceId,
  kind: "audioinput",
  label,
});

describe("webDevices", () => {
  it("lists a laptop's inputs as Chrome hands them over", () => {
    // Chrome lists the system's default and its communications device first,
    // each a second name for a device that follows under its own id.
    const list = webDevices(
      [
        mic("default", "Default - MacBook Pro Microphone (Built-in)"),
        mic("communications", "Communications - AirPods Pro"),
        mic("a1", "MacBook Pro Microphone (Built-in)"),
        mic("b2", "AirPods Pro"),
        { deviceId: "c3", kind: "audiooutput", label: "MacBook Pro Speakers" },
        { deviceId: "v1", kind: "videoinput", label: "FaceTime HD Camera" },
      ],
      "audioinput",
      unnamed,
    );
    expect(list.named).toBe(true);
    expect(list.devices).toEqual([
      { id: "a1", name: "MacBook Pro Microphone (Built-in)" },
      { id: "b2", name: "AirPods Pro" },
    ]);
  });

  it("lists nothing to choose before the microphone has been allowed", () => {
    // Before permission Chrome hands over one entry per kind, with neither
    // an id nor a label: there is nothing to choose but Automatic.
    const list = webDevices(
      [
        { deviceId: "", kind: "audioinput", label: "" },
        { deviceId: "", kind: "audiooutput", label: "" },
      ],
      "audioinput",
      unnamed,
    );
    expect(list).toEqual({ devices: [], named: false });
  });

  it("numbers a device the browser will not name", () => {
    const list = webDevices(
      [mic("x", ""), mic("y", "  "), mic("x", "")],
      "audioinput",
      unnamed,
    );
    expect(list.named).toBe(false);
    expect(list.devices).toEqual([
      { id: "x", name: "Microphone 1" },
      { id: "y", name: "Microphone 2" },
    ]);
  });

  it("reads outputs the same way", () => {
    const list = webDevices(
      [
        { deviceId: "default", kind: "audiooutput", label: "Default" },
        { deviceId: "o1", kind: "audiooutput", label: "Headphones" },
      ],
      "audiooutput",
      (n) => `Output ${n}`,
    );
    expect(list.devices).toEqual([{ id: "o1", name: "Headphones" }]);
  });
});

describe("resolveChoice", () => {
  const devices = [
    { id: "a1", name: "iPhone Microphone" },
    { id: "b2", name: "AirPods Pro" },
  ];

  it("is Automatic for no choice", () => {
    expect(resolveChoice(null, devices)).toBeNull();
  });

  it("finds a device by its id", () => {
    expect(resolveChoice({ id: "b2", name: "Old name" }, devices)).toEqual(
      devices[1],
    );
  });

  it("finds a device that came back under another id by its name", () => {
    // Safari hands out new ids; a headset that reconnected may come back
    // under another one. Its name is what the reader chose.
    expect(resolveChoice({ id: "gone", name: "AirPods Pro" }, devices)).toEqual(
      devices[1],
    );
  });

  it("does not guess between two devices with the same name", () => {
    const twins = [
      { id: "u1", name: "USB Audio" },
      { id: "u2", name: "USB Audio" },
    ];
    expect(resolveChoice({ id: "u3", name: "USB Audio" }, twins)).toBeNull();
  });

  it("is nothing — Automatic, for now — when the device is away", () => {
    expect(resolveChoice({ id: "z9", name: "Lapel mic" }, devices)).toBeNull();
  });
});

describe("choices kept and read back", () => {
  it("keeps a device as its id and name", () => {
    expect(choiceOf({ id: "b2", name: "AirPods Pro" })).toEqual({
      id: "b2",
      name: "AirPods Pro",
    });
    expect(choiceOf(null)).toBeNull();
  });

  it("reads anything that is not a choice as Automatic", () => {
    expect(parseChoice({ id: "a1", name: "Mic" })).toEqual({
      id: "a1",
      name: "Mic",
    });
    expect(parseChoice(null)).toBeNull();
    expect(parseChoice("a1")).toBeNull();
    expect(parseChoice({ id: "", name: "Mic" })).toBeNull();
    expect(parseChoice({ id: "a1" })).toBeNull();
    expect(parseChoice({ id: "x".repeat(513), name: "Mic" })).toBeNull();
  });

  it("starts on Automatic both ways, and keeps a choice across a reload", () => {
    expect(DEFAULT_SETTINGS.inputDevice).toBeNull();
    expect(DEFAULT_SETTINGS.outputDevice).toBeNull();
    const kept = parseSettings(
      JSON.stringify({
        inputDevice: { id: "a1", name: "iPhone Microphone" },
        outputDevice: { id: "b2", name: "AirPods Pro" },
      }),
    );
    expect(kept.inputDevice).toEqual({ id: "a1", name: "iPhone Microphone" });
    expect(kept.outputDevice).toEqual({ id: "b2", name: "AirPods Pro" });
    expect(
      parseSettings(JSON.stringify({ inputDevice: 3, outputDevice: [] }))
        .inputDevice,
    ).toBeNull();
  });
});

describe("parseDevices", () => {
  it("keeps what is a device, once, and drops the rest", () => {
    expect(
      parseDevices([
        { id: "a", name: "One" },
        { id: "a", name: "One again" },
        { id: "b", name: "  " },
        { id: 3, name: "Not a device" },
        "c",
        null,
      ]),
    ).toEqual([
      { id: "a", name: "One" },
      { id: "b", name: "b" },
    ]);
    expect(parseDevices("nothing")).toEqual([]);
  });
});
