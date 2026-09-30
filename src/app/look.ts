// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's looks, projected onto the framework's appearance shape.
//
// The framework ships a dozen palettes under the names they have among
// programmers — GitHub, Dracula, Solarized, Tokyo Night. The people this
// app is for are recording a song idea, an interview, a field sound, a
// voice line; so each palette here is renamed for what it feels like
// rather than where it came from, and the names are the app's own ids,
// stored in settings, never the framework's. A palette the framework later
// renames or drops only changes the table below.
//
// A reader picks a mode (light, dark, or follow the device) and a look for
// each side: one for the day and one for the night, so "follow the device"
// can be Paper by day and Vinyl by night.

import { useEffect, useState } from "react";

import {
  DEFAULT_THEME_APPEARANCE,
  PRESET_PALETTES,
  type CustomThemeColors,
  type ThemeAppearance,
  type ThemePreset,
} from "@niclaslindstedt/oss-framework/theme";

import type { ThemeChoice } from "./useAppSettings.ts";

type Palette = Exclude<ThemePreset, "system" | "custom">;

/** The night looks, in the order the picker shows them. */
export const DARK_LOOKS = [
  "studio",
  "vinyl",
  "neon",
  "velvet",
  "dusk",
  "fjord",
  "dreampop",
  "lagoon",
] as const;
export type DarkLook = (typeof DARK_LOOKS)[number];

/** The day looks. */
export const LIGHT_LOOKS = ["studio", "paper", "dawn", "watercolour"] as const;
export type LightLook = (typeof LIGHT_LOOKS)[number];

const DARK_PALETTE: Record<DarkLook, Palette> = {
  studio: "githubDark",
  vinyl: "gruvbox",
  neon: "tokyoNight",
  velvet: "dracula",
  dusk: "rosePine",
  fjord: "nord",
  dreampop: "catppuccin",
  lagoon: "solarizedDark",
};

const LIGHT_PALETTE: Record<LightLook, Palette> = {
  studio: "githubLight",
  paper: "solarizedLight",
  dawn: "rosePineDawn",
  watercolour: "catppuccinLatte",
};

export function isDarkLook(v: unknown): v is DarkLook {
  return (DARK_LOOKS as readonly unknown[]).includes(v);
}

export function isLightLook(v: unknown): v is LightLook {
  return (LIGHT_LOOKS as readonly unknown[]).includes(v);
}

/** A look's colours, for its swatch in the picker. */
export function colorsFor(
  side: "light" | "dark",
  look: LightLook | DarkLook,
): CustomThemeColors {
  return PRESET_PALETTES[
    side === "light"
      ? LIGHT_PALETTE[look as LightLook]
      : DARK_PALETTE[look as DarkLook]
  ];
}

export type LookChoice = {
  theme: ThemeChoice;
  lookLight: LightLook;
  lookDark: DarkLook;
};

/** Which side is showing: the mode, or the device's own when following it. */
export function sideFor(
  theme: ThemeChoice,
  prefersDark: boolean,
): "light" | "dark" {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}

/** The framework preset the page paints with. */
export function presetFor(choice: LookChoice, prefersDark: boolean): Palette {
  return sideFor(choice.theme, prefersDark) === "light"
    ? LIGHT_PALETTE[choice.lookLight]
    : DARK_PALETTE[choice.lookDark];
}

export function appearanceFor(
  choice: LookChoice,
  prefersDark: boolean,
): ThemeAppearance {
  return {
    ...DEFAULT_THEME_APPEARANCE,
    theme: presetFor(choice, prefersDark),
    fontFamily: "sans",
    ui: { ...DEFAULT_THEME_APPEARANCE.ui, radius: "lg" },
  };
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Whether the device is asking for dark, kept current as it changes. */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof matchMedia === "function" ? matchMedia(DARK_QUERY).matches : true,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(DARK_QUERY);
    const on = () => setDark(query.matches);
    on();
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, []);
  return dark;
}
