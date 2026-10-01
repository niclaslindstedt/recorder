// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT CROSSES THE AUDIO-ROUTE BRIDGE — the shapes, and nothing that can
// reach an audio session.
//
// Import-free for the same reason as `icloudWire.ts`: the root test suite
// imports `audioRouteBridge.ts`, and the root install has no `expo`. Only
// `audioRoute.ts` reaches for the native module.
//
// The shapes MIRROR `src/app/audioHost.ts`'s rather than importing them;
// `tests/native_audio_route_test.ts` keeps the two honest.

/** The four things the page may ask: the routes as they are, an input to
 *  record through, an output to play through, and the system's own output
 *  picker. */
export type AudioRouteMethod =
  "routes" | "setInput" | "setOutput" | "showPicker";

/** One input or output, as the page lists it. `id` is the platform's own
 *  (a port's UID on iOS, a device's type and address on Android) and means
 *  nothing outside this wrapper. */
export type AudioRouteDevice = { id: string; name: string };

/** Mirrors `HostRoutes` in `src/app/audioHost.ts`. A side the platform
 *  leaves to the page — Android's microphone, which the WebView already
 *  chooses by `deviceId` — is `null`. */
export type AudioRoutes = {
  inputs: AudioRouteDevice[] | null;
  outputs: AudioRouteDevice[] | null;
  inputNow: string | null;
  outputNow: string | null;
  picker: boolean;
};

/** What a call resolves to. A failure is DATA rather than a rejection: the
 *  only channel back into the page is an injected script, and an exception
 *  thrown there would never reach the promise. */
export type AudioRouteResult =
  { ok: true; value: AudioRoutes | null } | { ok: false; message: string };
