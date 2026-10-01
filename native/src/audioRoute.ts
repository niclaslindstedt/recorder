// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ANSWERING THE PAGE'S ROUTE REQUESTS — the native half of the page's
// microphone and output choice (see `audioRouteBridge.ts`).
//
// It moves no sound and keeps no choice: the page remembers what was chosen
// and says it again whenever it opens the microphone, and the module only
// prefers a port. Every answer leaves as DATA, never as a rejection — the
// only way back into the page is an injected script.

import type { AudioRouteRequest } from "./audioRouteBridge";
import type { AudioRouteResult } from "./audioRouteWire";
import { AudioRoute } from "../modules/audio-route";

/** Answer one request. Resolves, always. */
export async function answerAudioRouteRequest(
  request: AudioRouteRequest,
): Promise<AudioRouteResult> {
  // A build without the module: no routes to offer, and the page — finding
  // none — keeps both sides to itself.
  if (!AudioRoute) {
    return { ok: false, message: "This build has no audio routes." };
  }
  try {
    switch (request.method) {
      case "routes":
        return {
          ok: true,
          value: await AudioRoute.routes(request.interactive === true),
        };
      case "setInput":
        await AudioRoute.setInput(request.target ?? null);
        return { ok: true, value: null };
      case "setOutput":
        await AudioRoute.setOutput(request.target ?? null);
        return { ok: true, value: null };
      case "showPicker":
        return (await AudioRoute.showPicker())
          ? { ok: true, value: null }
          : { ok: false, message: "This device has no output picker." };
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Call `listener` whenever the routes change, until the returned function
 *  is called. A build without the module never calls it. */
export function onRoutesChanged(listener: () => void): () => void {
  if (!AudioRoute) return () => {};
  const subscription = AudioRoute.addListener("onRoutesChanged", listener);
  return () => subscription.remove();
}
