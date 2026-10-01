// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Which microphone a take listens through, and where the sound comes out
// (docs/design.md, "The Microphone sheet").
//
// The lists arrive from the browser (`enumerateDevices`) or from a host that
// knows the device's routes better (`audioHost.ts`); this module only reads
// them and finds a remembered choice among them. Pure: nothing here opens a
// device or asks for one.
//
// A choice is kept as the id it had and the name it went by. Ids are not
// forever — a browser may hand out new ones, a headset that reconnects may
// come back under another — so a choice whose id is gone is found again by
// its name, when exactly one device answers to it. One that is not here at
// all is still kept: until it comes back, the device's own choice stands
// ("Automatic"), and the sheet says so.

export type AudioDevice = { id: string; name: string };

/** A remembered choice. `null` stands for Automatic — whatever the device
 *  itself picks, which is what the app did before there was a choice. */
export type DeviceChoice = { id: string; name: string };

/** The longest id and name a stored choice may carry. Longer is not a
 *  device's; it is something else in the slot. */
const MAX_ID = 512;
const MAX_NAME = 200;

/** The ids Chrome lists beside the real devices: the system's default and
 *  its communications device, each a second name for a device that is
 *  also listed under its own. Choosing one would be choosing "whatever the
 *  system says", which is Automatic. */
const ALIASES = new Set(["default", "communications"]);

/** What `enumerateDevices` hands back, as far as this module reads it. */
export type MediaDeviceLike = {
  deviceId: string;
  kind: string;
  label: string;
};

export type DeviceList = {
  devices: AudioDevice[];
  /** Whether the browser has told their names — it does once the
   *  microphone has been allowed, and lists nothing usable before. */
  named: boolean;
};

/** The browser's devices of one kind, as the sheet lists them: the aliases
 *  dropped, each id once, a device with no label given a numbered name. */
export function webDevices(
  infos: readonly MediaDeviceLike[],
  kind: "audioinput" | "audiooutput",
  unnamed: (n: number) => string,
): DeviceList {
  const devices: AudioDevice[] = [];
  const seen = new Set<string>();
  let named = false;
  for (const info of infos) {
    if (info.kind !== kind) continue;
    const label = info.label.trim();
    if (label) named = true;
    const id = info.deviceId;
    if (!id || ALIASES.has(id) || seen.has(id)) continue;
    seen.add(id);
    devices.push({ id, name: label || unnamed(devices.length + 1) });
  }
  return { devices, named };
}

/** The device a choice means now: the one with its id, or else the one
 *  device with its name. `null` when it is Automatic or not here. */
export function resolveChoice(
  choice: DeviceChoice | null,
  devices: readonly AudioDevice[],
): AudioDevice | null {
  if (!choice) return null;
  const byId = devices.find((d) => d.id === choice.id);
  if (byId) return byId;
  const byName = devices.filter((d) => d.name === choice.name);
  return byName.length === 1 ? byName[0]! : null;
}

/** A device as a choice to keep. */
export function choiceOf(device: AudioDevice | null): DeviceChoice | null {
  return device ? { id: device.id, name: device.name } : null;
}

/** A stored choice, or `null` (Automatic) for anything that is not one. */
export function parseChoice(value: unknown): DeviceChoice | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, name } = value as { id?: unknown; name?: unknown };
  if (typeof id !== "string" || id === "" || id.length > MAX_ID) return null;
  if (typeof name !== "string" || name.length > MAX_NAME) return null;
  return { id, name };
}

/** A list from somewhere outside this bundle (a host), checked: each entry
 *  an id and a name, each id once. Anything else is dropped. */
export function parseDevices(value: unknown): AudioDevice[] {
  if (!Array.isArray(value)) return [];
  const out: AudioDevice[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const device = parseChoice(raw);
    if (!device || seen.has(device.id)) continue;
    seen.add(device.id);
    out.push({ id: device.id, name: device.name.trim() || device.id });
  }
  return out;
}
