// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AUDIO_ROUTES_EVENT,
  parseRoutes,
  useAudioHost,
  type HostRoutes,
} from "./audioHost.ts";
import {
  resolveChoice,
  webDevices,
  type AudioDevice,
  type DeviceChoice,
} from "./devices.ts";
import { useT } from "./i18n/index.ts";

// The microphone and the output, as chosen on the Microphone sheet, made
// real (docs/design.md, "The Microphone sheet").
//
// Each side is the host's when a host offers it (`audioHost.ts`) and the
// page's otherwise. The page's microphone is a `deviceId` handed to every
// capture — a take, Listening, the monitor — and its output is `setSinkId`
// on every element and audio context that plays, where the browser has it.
// A host's side is a call to the host, made when the choice changes and
// again around every opening of the microphone, since that is the moment
// a system re-decides its routes.
//
// Automatic touches nothing. A device that has never had a choice made on
// it is never told anything, so the app routes exactly as it did before
// there was a sheet; a choice made and then taken back is handed back to
// the system once.
//
// Nothing here opens the microphone. The browser names its devices only
// once the microphone has been allowed, so the lists are read again after
// Listen or Record opens it (`refresh`), and when the browser or the host
// says a device came or went.

export type AudioRouting = {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  /** Whether the inputs carry their names — the browser's do only once the
   *  microphone has been allowed. */
  named: boolean;
  /** The chosen devices, when they are here. */
  input: AudioDevice | null;
  output: AudioDevice | null;
  /** Where the sound comes from and goes to now, where a host says. */
  inputNow: string | null;
  outputNow: string | null;
  /** The input for the page's own capture: `undefined` for Automatic, or
   *  where the host routes the microphone. */
  deviceId: string | undefined;
  /** The output for the page's own players and contexts (`""` is the
   *  default), or `null` where the page does not route it. */
  sinkId: string | null;
  /** Make the routes what was chosen. Call it before the microphone opens
   *  and once it has: a host is told again, and a browser that has not yet
   *  named its microphones is asked to (the microphone, for a moment — only
   *  ever from a press on Listen or Record). */
  prepare: () => Promise<void>;
  /** Read the lists again. `interactive` — the reader opened the sheet —
   *  lets a host ask for what it needs to list them; never at launch. */
  refresh: (interactive?: boolean) => void;
  /** The system's own output picker, where the host has one. */
  showPicker: (() => void) | null;
};

const NONE: AudioRouting = {
  inputs: [],
  outputs: [],
  named: false,
  input: null,
  output: null,
  inputNow: null,
  outputNow: null,
  deviceId: undefined,
  sinkId: null,
  prepare: () => Promise.resolve(),
  refresh: () => {},
  showPicker: null,
};

/** The routing, for the players and the Record screen. Outside a provider
 *  it routes nothing, which is how the app behaved before it could. */
export const AudioRoutingContext = createContext<AudioRouting>(NONE);
export const useRouting = () => useContext(AudioRoutingContext);

type Sinkable = { setSinkId?: (sinkId: string) => Promise<void> };

/** Whether the page can send an element's sound to a chosen output. */
export function canRouteOutput(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    typeof (HTMLMediaElement.prototype as Sinkable).setSinkId === "function"
  );
}

/** Send what an element or an audio context plays to an output (`""` the
 *  default). Where the browser cannot, or the device is gone, it plays
 *  where it was. */
export function routeOutput(
  target: HTMLMediaElement | BaseAudioContext,
  sinkId: string | null,
): void {
  if (sinkId === null) return;
  const set = (target as unknown as Sinkable).setSinkId;
  if (typeof set !== "function") return;
  try {
    void set.call(target, sinkId).catch(() => {});
  } catch {
    // An older engine's synchronous refusal: it plays where it was.
  }
}

const EMPTY: AudioDevice[] = [];

type WebLists = {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  named: boolean;
};

/** Which id was last handed to the host, per side; `undefined` until one
 *  has been, so Automatic on a fresh device sends nothing. */
type Applied = {
  input: string | null | undefined;
  output: string | null | undefined;
};

export function useAudioRouting(
  inputChoice: DeviceChoice | null,
  outputChoice: DeviceChoice | null,
): AudioRouting {
  const t = useT();
  const host = useAudioHost();
  const [web, setWeb] = useState<WebLists>({
    inputs: EMPTY,
    outputs: EMPTY,
    named: false,
  });
  const [routes, setRoutes] = useState<HostRoutes | null>(null);

  const readWeb = useCallback(async () => {
    const media =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    await media
      ?.enumerateDevices?.()
      .then((infos) => {
        const inputs = webDevices(infos, "audioinput", (n) =>
          t("devices.unnamedInput", { n: String(n) }),
        );
        const outputs = webDevices(infos, "audiooutput", (n) =>
          t("devices.unnamedOutput", { n: String(n) }),
        );
        setWeb({
          inputs: inputs.devices,
          outputs: outputs.devices,
          named: inputs.named,
        });
      })
      .catch(() => {});
  }, [t]);

  const refresh = useCallback(
    (interactive = false) => {
      void readWeb();
      if (!host) {
        setRoutes(null);
        return;
      }
      const own = {
        speaker: t("devices.speaker"),
        earpiece: t("devices.earpiece"),
      };
      void host
        .routes(interactive)
        .then((result) => {
          setRoutes(parseRoutes(result, own));
          // A permission the host just asked for may have let the browser
          // see more.
          if (interactive) void readWeb();
        })
        .catch(() => setRoutes(null));
    },
    [host, readWeb, t],
  );

  useEffect(() => {
    const changed = () => refresh(false);
    changed();
    const media =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    media?.addEventListener?.("devicechange", changed);
    window.addEventListener(AUDIO_ROUTES_EVENT, changed);
    return () => {
      media?.removeEventListener?.("devicechange", changed);
      window.removeEventListener(AUDIO_ROUTES_EVENT, changed);
    };
  }, [refresh]);

  const hostInputs = routes?.inputs ?? null;
  const hostOutputs = routes?.outputs ?? null;
  const sinkable = canRouteOutput();
  const inputs = hostInputs ?? web.inputs;
  const outputs = hostOutputs ?? (sinkable ? web.outputs : EMPTY);
  const input = resolveChoice(inputChoice, inputs);
  const output = resolveChoice(outputChoice, outputs);

  // The host's sides: what to send, and what was sent.
  const applied = useRef<Applied>({ input: undefined, output: undefined });
  const wanted = useRef({ host, hostInputs, hostOutputs, input, output });
  wanted.current = { host, hostInputs, hostOutputs, input, output };
  const apply = useCallback(async (force: boolean) => {
    const w = wanted.current;
    if (!w.host) return;
    const sides = [
      ["input", w.hostInputs, w.input?.id ?? null, w.host.setInput],
      ["output", w.hostOutputs, w.output?.id ?? null, w.host.setOutput],
    ] as const;
    for (const [side, list, id, set] of sides) {
      if (!list) continue;
      const last = applied.current[side];
      const fresh = last === undefined && id === null;
      if (fresh || (id === last && !(force && id !== null))) continue;
      applied.current[side] = id;
      try {
        await set.call(w.host, id);
      } catch {
        // The host is gone; the system's routes stand.
      }
    }
  }, []);
  const inputId = input?.id ?? null;
  const outputId = output?.id ?? null;
  useEffect(() => {
    void apply(false);
  }, [apply, host, hostInputs, hostOutputs, inputId, outputId]);

  // A browser that does not keep the microphone's permission (Safari)
  // names its devices, and hands out their ids, only once the microphone
  // has opened — so a remembered microphone cannot be found before the
  // first Listen or Record. On that press, and only then, it is opened for
  // a moment to read the list, so the take records through the one chosen.
  const unnamedChoice =
    inputChoice !== null && !hostInputs && !web.named && input === null;
  const unnamedRef = useRef(unnamedChoice);
  unnamedRef.current = unnamedChoice;
  const prepare = useCallback(async () => {
    if (unnamedRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        for (const track of stream.getTracks()) track.stop();
        await readWeb();
        // Let the screen take the named list before it opens the
        // microphone for real.
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch {
        // Refused or absent: the capture that follows says which.
      }
    }
    await apply(true);
  }, [apply, readWeb]);
  const showPicker = useMemo(
    () =>
      host && routes?.picker
        ? () => {
            void host.showPicker().catch(() => {});
          }
        : null,
    [host, routes?.picker],
  );

  return useMemo(
    () => ({
      inputs,
      outputs,
      // A host may list nothing until the microphone has opened once.
      named: hostInputs ? hostInputs.length > 0 : web.named,
      input,
      output,
      inputNow: routes?.inputNow ?? null,
      outputNow: routes?.outputNow ?? null,
      deviceId: hostInputs ? undefined : (input?.id ?? undefined),
      sinkId: hostOutputs || !sinkable ? null : (output?.id ?? ""),
      prepare,
      refresh,
      showPicker,
    }),
    [
      inputs,
      outputs,
      hostInputs,
      hostOutputs,
      web.named,
      input,
      output,
      routes?.inputNow,
      routes?.outputNow,
      sinkable,
      prepare,
      refresh,
      showPicker,
    ],
  );
}
