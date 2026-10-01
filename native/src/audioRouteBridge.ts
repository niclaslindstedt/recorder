// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIO-ROUTE BRIDGE: how the page chooses the phone's microphone and
// output through the system, which no page can reach.
//
// The case it exists for is a phone's most ordinary one: record on the
// phone's own microphone, listen on Bluetooth headphones. A page asks for a
// microphone by `deviceId` and an output by `setSinkId` (where the browser
// has it — WebKit does not), but which ports the system pairs is the audio
// session's (iOS) or the audio manager's (Android), and only the app holds
// those. So, like the iCloud bridge, this offers the page a CAPABILITY —
// `window.__recorderAudioHost` — and the page never learns what offered it
// (see `src/app/audioHost.ts` for the other half).
//
// One message channel each way, request and answer correlated by id:
//
//   • a script that defines the host, whose four methods post a request out
//     and return a promise;
//   • `isAudioRouteRequest`, which narrows an inbound message;
//   • `audioRouteResolveScript`, the one line that settles the promise; and
//   • `ROUTES_CHANGED_SCRIPT`, which tells the page a headset came or went.
//
// Exports STRINGS, ES5-ish and dependency-free: they run in the WebView,
// where nothing is transpiled.

import type { AudioRouteMethod, AudioRouteResult } from "./audioRouteWire";
import { escapeForScript } from "./scriptText";

export type { AudioRouteMethod, AudioRouteResult };

/** The message the page posts. Namespaced like the iCloud bridge's. */
export const AUDIO_ROUTE_REQUEST_TYPE = "recorder-native/audio-route-request";

export type AudioRouteRequest = {
  type: string;
  id: string;
  method: AudioRouteMethod;
  /** The input or output, for `setInput` / `setOutput`; `null` hands the
   *  choice back to the system. */
  target?: string | null;
  /** For `routes`: the reader is looking at the choices, so the system may
   *  be asked for what it takes to list them (Android's Bluetooth
   *  permission). Never set at launch. */
  interactive?: boolean;
};

/** Must match `AUDIO_HOST_PROPERTY` in `src/app/audioHost.ts`. */
const HOST_PROPERTY = "__recorderAudioHost";

/** Must match `AUDIO_HOST_EVENT` in `src/app/audioHost.ts`. */
const HOST_EVENT = "recorder:audio-host";

/** Must match `AUDIO_ROUTES_EVENT` in `src/app/audioHost.ts`. */
const ROUTES_EVENT = "recorder:audio-routes";

/** The callback an answer settles through. Nothing in `src/` reads it. */
const RESOLVE_PROPERTY = "__recorderAudioResolve";

/** The longest id a request may carry — a port's UID is far shorter. */
const MAX_TARGET = 512;

/**
 * The script that installs the host. Injected after the page has loaded,
 * guarded against a second injection, and announced with an event, since it
 * can land either side of the app's first render.
 */
export const AUDIO_ROUTE_SCRIPT = `(function () {
  if (window.${HOST_PROPERTY}) return;

  var pending = {};
  var next = 0;

  function call(method, target, interactive) {
    return new Promise(function (resolve) {
      var id = "a" + (next += 1);
      pending[id] = resolve;
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: ${JSON.stringify(AUDIO_ROUTE_REQUEST_TYPE)},
          id: id,
          method: method,
          target: target === undefined ? null : target,
          interactive: interactive === true
        }));
      } catch (e) {
        delete pending[id];
        // The bridge is gone: answer the way a host with nothing to offer
        // would, and the page routes on its own.
        resolve({ ok: false, message: "The audio bridge is unavailable." });
      }
    });
  }

  window.${RESOLVE_PROPERTY} = function (id, result) {
    var resolve = pending[id];
    if (!resolve) return;
    delete pending[id];
    resolve(result);
  };

  window.${HOST_PROPERTY} = {
    version: 1,
    routes: function (interactive) { return call("routes", null, interactive); },
    setInput: function (id) { return call("setInput", id); },
    setOutput: function (id) { return call("setOutput", id); },
    showPicker: function () { return call("showPicker"); }
  };

  try {
    window.dispatchEvent(new Event(${JSON.stringify(HOST_EVENT)}));
  } catch (e) {}
})(); true;`;

/** The script that tells the page the routes changed under it. */
export const ROUTES_CHANGED_SCRIPT = `(function () {
  try {
    window.dispatchEvent(new Event(${JSON.stringify(ROUTES_EVENT)}));
  } catch (e) {}
})(); true;`;

/** Narrow an arbitrary parsed `postMessage` body to a route request. */
export function isAudioRouteRequest(
  value: unknown,
): value is AudioRouteRequest {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<AudioRouteRequest>;
  if (message.type !== AUDIO_ROUTE_REQUEST_TYPE) return false;
  if (typeof message.id !== "string" || message.id === "") return false;
  if (
    message.interactive !== undefined &&
    typeof message.interactive !== "boolean"
  ) {
    return false;
  }
  if (message.method === "routes" || message.method === "showPicker") {
    return true;
  }
  if (message.method !== "setInput" && message.method !== "setOutput") {
    return false;
  }
  const target = message.target;
  return (
    target === null ||
    target === undefined ||
    (typeof target === "string" && target !== "" && target.length <= MAX_TARGET)
  );
}

/** The line of JavaScript that settles one pending call. The answer holds
 *  device names, which are text a person typed into a headset's settings,
 *  so it is parsed from a JSON string rather than spliced in as code. */
export function audioRouteResolveScript(
  id: string,
  result: AudioRouteResult,
): string {
  const payload = escapeForScript(JSON.stringify({ id, result }));
  return `(function () {
    try {
      var answer = JSON.parse(${payload});
      if (window.${RESOLVE_PROPERTY}) {
        window.${RESOLVE_PROPERTY}(answer.id, answer.result);
      }
    } catch (e) {}
  })(); true;`;
}
