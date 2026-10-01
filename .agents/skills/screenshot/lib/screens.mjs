// The screens a shot can be of, and how each is reached — by doing what a
// person does in the real app: a tap on a tab, a tap on a row, a press of the
// one button. No DOM surgery, no state injected past the settings the app
// itself offers.
//
// Every shot starts on a fresh page of the demo build at the Record screen.
// `stage(page, h)` takes it from there and returns when the screen is drawn;
// wait for the state a tap makes (a dialog, a button's new name), never for a
// time, so a miss fails loudly instead of shooting the wrong frame.
//
// The helpers on `h`:
//   h.device   — the device row (`devices.mjs`), `h.device.shape` is
//                "phone" | "stand" | "desk"
//   h.tab(n)   — a destination: the bottom bar on a phone, the top bar's tab on
//                the desk (both are `<nav>`; the hidden one is not matched)
//   h.open(t)  — a recording's row in the list, by its title
//   h.setting(patch) — a settings patch, then a reload (the app reads it at boot)
//   h.settle(ms)     — a short wait for a layout to finish, after the state check
//
// The demo library's titles are in src/app/dev/demoData.ts.

/* global document */

const ROW = "Interview: Mira, part 1";

async function settings(page, h) {
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await page.getByRole("radio", { name: "Light", exact: true }).waitFor();
  await h.settle();
}

async function player(page, h) {
  await h.tab("Recordings");
  await h.open(ROW);
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Play", exact: true })
    .waitFor();
  await h.settle();
}

async function scope(page, h, name) {
  await h.tab("Recordings");
  await page.getByRole("button", { name: /^Showing / }).click();
  const sheet = page.getByRole("dialog").last();
  await sheet.getByRole("button", { name: "New folder" }).waitFor();
  if (name) {
    // A row's name is its label and its count.
    await sheet.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await sheet.waitFor({ state: "detached" });
  }
  await h.settle();
}

async function recording(page, h) {
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).waitFor();
  // The fake microphone plays a tone; give the meter and the shape a moment
  // to have something to show.
  await h.settle(1500);
}

export const SCREENS = {
  record: {
    label: "Record",
    async stage(page, h) {
      await h.settle();
    },
  },
  listening: {
    label: "Listening",
    async stage(page, h) {
      await page.getByRole("button", { name: "Listen", exact: true }).click();
      await page.getByText("Listening", { exact: true }).waitFor();
      // The fake microphone plays a tone; give the readings a moment.
      await h.settle(1500);
    },
  },
  quality: {
    label: "Quality sheet",
    async stage(page, h) {
      await page.getByRole("button", { name: /^Quality: / }).click();
      await page
        .getByRole("dialog")
        .last()
        .getByRole("radio", { name: /Standard/ })
        .waitFor();
      await h.settle();
    },
  },
  eq: {
    label: "EQ sheet (Record)",
    async stage(page, h) {
      await page.getByRole("button", { name: /^EQ: / }).click();
      await page
        .getByRole("dialog")
        .last()
        .getByRole("slider", { name: "Presence" })
        .waitFor();
      await h.settle();
    },
  },
  "eq-monitor": {
    label: "EQ sheet, monitoring",
    async stage(page, h) {
      await page.getByRole("button", { name: /^EQ: / }).click();
      const sheet = page.getByRole("dialog").last();
      await sheet.getByRole("radio", { name: "Podcast" }).click();
      await sheet.getByRole("button", { name: "Monitor" }).click();
      await sheet.getByText("Monitoring. Nothing is kept.").waitFor();
      await page.waitForTimeout(600);
      await h.settle();
    },
  },
  recording: {
    label: "Recording",
    stage: recording,
  },
  review: {
    label: "Take review",
    async stage(page, h) {
      await recording(page, h);
      await page.getByRole("button", { name: "Stop", exact: true }).click();
      await page.getByRole("button", { name: "Save", exact: true }).waitFor();
      await h.settle();
    },
  },
  library: {
    label: "Recordings",
    async stage(page, h) {
      await h.tab("Recordings");
      await page.getByRole("button", { name: "Standup, Monday" }).waitFor();
      await h.settle();
    },
  },
  "library-favorites": {
    label: "Favorites",
    stage: (page, h) => scope(page, h, "Favorites"),
  },
  "library-trash": {
    label: "Recently deleted",
    stage: (page, h) => scope(page, h, "Recently deleted"),
  },
  "library-search": {
    label: "Search",
    async stage(page, h) {
      await h.tab("Recordings");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("searchbox", { name: "Search" }).fill("Mira");
      await page
        .getByRole("dialog")
        .last()
        .getByRole("button", { name: /Interview: Mira, part 2/ })
        .waitFor();
      await h.settle();
    },
  },
  player: {
    label: "Player",
    stage: player,
  },
  export: {
    label: "Export sheet",
    async stage(page, h) {
      await player(page, h);
      await page.getByRole("button", { name: "Export…" }).click();
      await page
        .getByRole("dialog")
        .last()
        .getByRole("radio", { name: "WAV", exact: true })
        .waitFor();
      await h.settle();
    },
  },
  "player-eq": {
    label: "EQ sheet (player)",
    async stage(page, h) {
      await h.tab("Recordings");
      await h.open("Interview: Mira, part 1");
      await page.getByRole("button", { name: /^Equalizer: / }).click();
      await page
        .getByRole("dialog")
        .last()
        .getByRole("slider", { name: "Presence" })
        .waitFor();
      await h.settle();
    },
  },
  folders: {
    label: "Folder picker",
    stage: (page, h) => scope(page, h),
  },
  settings: {
    label: "Settings",
    stage: settings,
  },
  "settings-storage": {
    label: "Settings, storage",
    async stage(page, h) {
      await settings(page, h);
      const storage = page.getByText("This device", { exact: true });
      await storage.scrollIntoViewIfNeeded();
      await h.settle();
    },
  },
  spaces: {
    label: "Spaces",
    async stage(page, h) {
      await page.getByRole("button", { name: /^Space: / }).click();
      await page.getByRole("dialog").last().waitFor();
      await h.settle();
    },
  },
};

export const SCREEN_SETS = {
  default: ["record", "library", "player", "folders", "settings"],
  "library-flow": [
    "library",
    "library-favorites",
    "library-trash",
    "library-search",
    "player",
    "player-eq",
    "export",
  ],
  "record-flow": [
    "record",
    "listening",
    "quality",
    "eq",
    "recording",
    "review",
  ],
  all: Object.keys(SCREENS),
};

/** The helpers a stage function gets. */
export function helpers(page, device, { ready, seed }) {
  return {
    device,
    async tab(name) {
      await page
        .locator("nav")
        .getByRole("button", { name, exact: true })
        .click();
    },
    async open(title) {
      // A row's accessible name is its thumbnail's alt, the title, then the
      // details line — so the title is matched as a substring, not anchored.
      await page.getByRole("button", { name: title }).first().click();
      await page.getByRole("dialog").last().waitFor();
    },
    async setting(patch) {
      const { script, arg } = seed(patch);
      await page.addInitScript(script, arg);
      await page.reload();
      await ready(page);
    },
    async settle(ms = 250) {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(ms);
    },
  };
}

/** The demo has loaded and the Record screen is drawn. */
export async function ready(page) {
  await page.locator(".app-record").first().waitFor();
  await page.getByRole("button", { name: "Start recording" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** Nothing left in the frame that is only there because of the cursor. */
export async function release(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.move(0, 0);
}
