// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  DARK_THEMES,
  LIGHT_THEMES,
} from "@niclaslindstedt/oss-framework/theme";

import {
  DARK_LOOKS,
  LIGHT_LOOKS,
  appearanceFor,
  colorsFor,
  presetFor,
  sideFor,
} from "../src/app/look.ts";
import { en } from "../src/app/i18n/en.ts";
import { DEFAULT_SETTINGS, parseSettings } from "../src/app/useAppSettings.ts";

describe("the looks", () => {
  it("offers every palette the framework ships, each once", () => {
    const dark = DARK_LOOKS.map((l) =>
      presetFor({ theme: "dark", lookLight: "studio", lookDark: l }, false),
    );
    const light = LIGHT_LOOKS.map((l) =>
      presetFor({ theme: "light", lookLight: l, lookDark: "studio" }, true),
    );
    expect([...dark].sort()).toEqual([...DARK_THEMES].sort());
    expect([...light].sort()).toEqual([...LIGHT_THEMES].sort());
  });

  it("names and describes every look in words, not in palettes", () => {
    for (const l of DARK_LOOKS) {
      expect(en.look.dark[l].name).toBeTruthy();
      expect(en.look.dark[l].mood).toBeTruthy();
    }
    for (const l of LIGHT_LOOKS) {
      expect(en.look.light[l].name).toBeTruthy();
      expect(en.look.light[l].mood).toBeTruthy();
    }
    const names = JSON.stringify(en.look);
    for (const programmer of [
      "GitHub",
      "Dracula",
      "Solarized",
      "Nord",
      "Gruvbox",
      "Catppuccin",
      "Tokyo",
      "Pine",
    ])
      expect(names).not.toContain(programmer);
  });

  it("follows the device between the day look and the night look", () => {
    const choice = {
      theme: "system" as const,
      lookLight: "paper" as const,
      lookDark: "vinyl" as const,
    };
    expect(sideFor("system", true)).toBe("dark");
    expect(sideFor("system", false)).toBe("light");
    expect(sideFor("light", true)).toBe("light");
    expect(appearanceFor(choice, true).theme).toBe("gruvbox");
    expect(appearanceFor(choice, false).theme).toBe("solarizedLight");
    expect(appearanceFor({ ...choice, theme: "dark" }, false).theme).toBe(
      "gruvbox",
    );
  });

  it("has a readable label on the accent in every look", () => {
    // The Play and Save buttons: the page's ground on the accent.
    const lum = (hex: string) => {
      const h = hex.replace("#", "");
      const c = [0, 2, 4]
        .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const contrast = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const l of DARK_LOOKS) {
      const c = colorsFor("dark", l);
      expect(contrast(c.accent, c.pageBg)).toBeGreaterThan(3);
    }
    for (const l of LIGHT_LOOKS) {
      const c = colorsFor("light", l);
      expect(contrast(c.accent, c.pageBg)).toBeGreaterThan(3);
    }
  });

  it("keeps a stored look, and puts an unknown one back to Studio", () => {
    expect(
      parseSettings(JSON.stringify({ lookLight: "dawn", lookDark: "neon" })),
    ).toMatchObject({ lookLight: "dawn", lookDark: "neon" });
    expect(
      parseSettings(
        JSON.stringify({ lookLight: "githubLight", lookDark: "dracula" }),
      ),
    ).toMatchObject({ lookLight: "studio", lookDark: "studio" });
    // A look the day side does not have is not taken for the night.
    expect(
      parseSettings(JSON.stringify({ lookLight: "vinyl" })).lookLight,
    ).toBe(DEFAULT_SETTINGS.lookLight);
  });
});
