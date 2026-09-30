// What varies besides the window: the theme, and the settings the app
// offers. Both reach the app the way a person's choices do — through the
// settings key it keeps in localStorage (`src/app/useAppSettings.ts`), seeded
// before the page loads. Nothing else is injected.

export const SETTINGS_KEY = "recorder:settings";

/** The theme choice (Settings → Appearance), and for "Device" which way the
 *  device leans. */
export const THEMES = {
  light: { label: "Light", settings: { theme: "light" }, colorScheme: "light" },
  dark: { label: "Dark", settings: { theme: "dark" }, colorScheme: "dark" },
  "system-light": {
    label: "Device (light)",
    settings: { theme: "system" },
    colorScheme: "light",
  },
  "system-dark": {
    label: "Device (dark)",
    settings: { theme: "system" },
    colorScheme: "dark",
  },
};

export const THEME_SETS = {
  default: ["light", "dark"],
  all: Object.keys(THEMES),
};

/** Settings presets, each a patch over the defaults — the knobs a frame can
 *  look different under. Add one here when a feature adds a setting. */
export const VARIANTS = {
  default: { label: "Defaults", settings: {} },
  lossless: {
    label: "Lossless takes",
    settings: { recordingKind: "lossless" },
  },
  "no-spectrum": { label: "Spectrum off", settings: { showSpectrum: false } },
  "voice-processing": {
    label: "Voice processing on",
    settings: { voiceProcessing: true },
  },
  "export-wav": {
    label: "Export defaults: WAV",
    settings: { exportFormat: "wav", exportMono: false },
  },
  "export-flac": {
    label: "Export defaults: FLAC 48 kHz",
    settings: { exportFormat: "flac", exportFlacLevel: 8, exportRate: 48000 },
  },
  dev: { label: "Developer mode", settings: { devMode: true } },
};

export const VARIANT_SETS = {
  default: ["default"],
  all: Object.keys(VARIANTS),
};

/** The init script that seeds a settings patch. It runs before any app
 *  module and again on every reload, merging its patch over whatever the key
 *  holds — so a later script (a screen's own `setting()`) wins, and a reload
 *  keeps it. */
export function seedSettings(patch) {
  return {
    script: (arg) => {
      const current = JSON.parse(localStorage.getItem(arg.key) ?? "{}");
      localStorage.setItem(
        arg.key,
        JSON.stringify({ ...current, ...arg.patch }),
      );
    },
    arg: { key: SETTINGS_KEY, patch },
  };
}
