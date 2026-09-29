// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's two themes, projected onto the framework's appearance shape.
// One light, one dark, and "follow the device": the framework ships a dozen
// palettes and this app deliberately exposes none of them.

import {
  DEFAULT_THEME_APPEARANCE,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";

import type { ThemeChoice } from "./useAppSettings.ts";

const PRESET = {
  light: "githubLight",
  dark: "githubDark",
  system: "system",
} as const;

export function appearanceFor(choice: ThemeChoice): ThemeAppearance {
  return {
    ...DEFAULT_THEME_APPEARANCE,
    theme: PRESET[choice],
    fontFamily: "sans",
    ui: { ...DEFAULT_THEME_APPEARANCE.ui, radius: "lg" },
  };
}
