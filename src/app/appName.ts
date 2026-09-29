// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The name the app calls itself by.
//
// A store listing is a deployment of this project, and its name is
// configuration rather than source (`native/identifiers.js`): it arrives as
// `APP_DISPLAY_NAME` when an app build is made, and `vite.config.ts` hands it
// in as `__APP_NAME__`, so the watch, the bar and the sentences that name the
// app say what the icon under them says. The website, and a build nobody
// named, keep the project's own name.
//
// Read through `typeof` so a module that imports this outside a Vite build —
// the tests — gets the plain name rather than a ReferenceError.

/** The project's own name: the website's, and any build nobody named. */
export const PROJECT_NAME = "Recorder";

/** The name this build shows. */
export const APP_NAME: string =
  typeof __APP_NAME__ === "string" && __APP_NAME__.trim() !== ""
    ? __APP_NAME__.trim()
    : PROJECT_NAME;
