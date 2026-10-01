// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIO ROUTES, JavaScript side: which microphone the system records
// through and which output it plays through, over the platform's own audio
// session (iOS, `ios/AudioRouteModule.swift`) or audio manager (Android,
// `android/.../AudioRouteModule.kt`).
//
// It moves no sound and decides nothing about a recording. It lists ports,
// prefers one, and says when they change; the page asks for each through
// `src/audioRoute.ts`.
//
// Loaded OPTIONALLY, like the iCloud store: a build without the native side
// gets `null`, the page is offered no host, and it routes on its own.

import { requireOptionalNativeModule, type NativeModule } from "expo";

import type { AudioRoutes } from "../../src/audioRouteWire";

type Events = {
  /** A headset connected or gone, or the system moved the sound. */
  onRoutesChanged: () => void;
};

export declare class AudioRouteNativeModule extends NativeModule<Events> {
  /** The ports as they are now. Never changes them; `interactive` — the
   *  reader is looking — lets Android ask for the Bluetooth permission the
   *  WebView needs to list a headset. */
  routes(interactive: boolean): Promise<AudioRoutes>;
  /** Prefer this input from now on; `null` hands it back to the system. */
  setInput(id: string | null): Promise<void>;
  /** Prefer this output from now on; `null` hands it back. */
  setOutput(id: string | null): Promise<void>;
  /** Show the system's own output picker; `false` where there is none. */
  showPicker(): Promise<boolean>;
}

/** The native module, or `null` in a build without it. */
export const AudioRoute =
  requireOptionalNativeModule<AudioRouteNativeModule>("AudioRoute");

export default AudioRoute;
