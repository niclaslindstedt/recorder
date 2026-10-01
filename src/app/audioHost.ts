// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEAM: where the app asks its host whether it can route the device's
// sound — which microphone a take records through, and which output plays
// — better than a page can.
//
// A page has the browser's own half of this: `enumerateDevices`, a
// `deviceId` for the microphone, and `setSinkId` for the output where the
// browser has it (not on an iPhone, where Safari plays wherever the system
// sends the sound). What no page can say is the thing a phone is asked most
// often: _record on the phone, listen on the Bluetooth headphones_. That is
// the system's audio session (iOS) or its audio manager (Android), and a
// host that owns one can offer it here (`native/src/audioRouteBridge.ts`).
//
// Like `cloudHost.ts`, this asks about a CAPABILITY, never an identity:
// nothing here knows which wrapper, platform or build it is in. A host
// answers for each side on its own — a list of inputs or `null`, a list of
// outputs or `null` — and a side it leaves `null` stays the page's (the
// browser's list, `deviceId`, `setSinkId`). A browser has no host, and the
// page does all of it.

import { useCallback, useEffect, useState } from "react";

import { parseDevices, type AudioDevice } from "./devices.ts";

/** What a host's method resolves to. A failure is DATA rather than a
 *  rejection, because a host may live on the other side of a message
 *  channel, where an exception cannot cross. */
export type AudioHostResult =
  { ok: true; value: unknown } | { ok: false; message: string };

export type AudioHost = {
  readonly version: 1;
  /** The routes as they are now — see {@link HostRoutes}. `interactive`
   *  says the reader is looking at the choices, so the host may ask the
   *  system for what it takes to list them; it is never set at launch. */
  routes(interactive?: boolean): Promise<AudioHostResult>;
  /** Record through this input from now on; `null` hands the choice back
   *  to the system. */
  setInput(id: string | null): Promise<AudioHostResult>;
  /** Play through this output from now on; `null` hands it back. */
  setOutput(id: string | null): Promise<AudioHostResult>;
  /** The system's own output picker, where it has one (AirPlay and every
   *  Bluetooth device on an iPhone, the output switcher on Android). */
  showPicker(): Promise<AudioHostResult>;
};

export type HostRoutes = {
  /** The inputs the host can choose between — or `null`, which leaves the
   *  microphone to the page's own `deviceId`. */
  inputs: AudioDevice[] | null;
  /** The outputs, likewise — `null` leaves them to `setSinkId`. */
  outputs: AudioDevice[] | null;
  /** Where the sound comes from and goes to right now, by name, for
   *  "Automatic — now AirPods". */
  inputNow: string | null;
  outputNow: string | null;
  /** Whether `showPicker` opens anything. */
  picker: boolean;
};

/** Must match `HOST_PROPERTY` in `native/src/audioRouteBridge.ts` — a
 *  mismatch is not an error, it is a choice that never appears. */
export const AUDIO_HOST_PROPERTY = "__recorderAudioHost";

/** The host announcing itself, after the page has loaded. Must match
 *  `HOST_EVENT` in `native/src/audioRouteBridge.ts`. */
export const AUDIO_HOST_EVENT = "recorder:audio-host";

/** The routes changing under the page — a headset connected or gone. Must
 *  match `ROUTES_EVENT` in `native/src/audioRouteBridge.ts`. */
export const AUDIO_ROUTES_EVENT = "recorder:audio-routes";

export const AUDIO_HOST_METHODS = [
  "routes",
  "setInput",
  "setOutput",
  "showPicker",
] as const;

/** The output ids a host uses for the device's own loudspeaker and
 *  earpiece, which the page names in its own words rather than the
 *  host's (an Android phone calls its speaker by the phone's model). */
export const SPEAKER_ID = "speaker";
export const EARPIECE_ID = "earpiece";

type HostWindow = Window & { [AUDIO_HOST_PROPERTY]?: unknown };

/** The installed host, or null. Validates the shape rather than trusting
 *  it: the value arrives from code outside this bundle. */
export function getAudioHost(): AudioHost | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as HostWindow)[AUDIO_HOST_PROPERTY];
  if (typeof candidate !== "object" || candidate === null) return null;
  const host = candidate as Partial<AudioHost>;
  if (host.version !== 1) return null;
  for (const method of AUDIO_HOST_METHODS) {
    if (typeof host[method] !== "function") return null;
  }
  return host as AudioHost;
}

function name(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim().slice(0, 200)
    : null;
}

/** One `routes()` answer, checked — or `null` for a failure or anything
 *  that is not routes, which leaves both sides to the page. The loudspeaker
 *  and the earpiece take the names `own` gives them. */
export function parseRoutes(
  result: unknown,
  own: { speaker: string; earpiece: string },
): HostRoutes | null {
  if (typeof result !== "object" || result === null) return null;
  const envelope = result as { ok?: unknown; value?: unknown };
  if (envelope.ok !== true) return null;
  const value = envelope.value;
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  return {
    inputs: Array.isArray(v.inputs) ? parseDevices(v.inputs) : null,
    outputs: Array.isArray(v.outputs)
      ? parseDevices(v.outputs).map((d) =>
          d.id === SPEAKER_ID
            ? { ...d, name: own.speaker }
            : d.id === EARPIECE_ID
              ? { ...d, name: own.earpiece }
              : d,
        )
      : null,
    inputNow: name(v.inputNow),
    outputNow: name(v.outputNow),
    picker: v.picker === true,
  };
}

/** The host, as state — null until one is installed. Read once on mount
 *  and again when one announces itself, which covers it landing either
 *  side of the first render. */
export function useAudioHost(): AudioHost | null {
  const [host, setHost] = useState<AudioHost | null>(null);
  const probe = useCallback(() => setHost(getAudioHost()), []);
  useEffect(() => {
    window.addEventListener(AUDIO_HOST_EVENT, probe);
    probe();
    return () => window.removeEventListener(AUDIO_HOST_EVENT, probe);
  }, [probe]);
  return host;
}
