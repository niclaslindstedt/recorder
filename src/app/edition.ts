// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Which build this is.
//
// The app is given away on the web and sold in the App Store. What differs
// between the two is decided at build time — `vite.config.ts` leaves the Open
// Graph tags, the `CNAME` and the `og.png` out of a store build, because an
// app from a store carries no link back to the website — and this module is
// where the answer is read from inside the app, should a screen ever need it.
// It is a *build* parameter rather than a setting or a flag in the document:
// there is no server to ask and no account to check, so the only honest place
// for it is the build that was shipped (see `docs/configuration.md`).
//
// Unset means the web edition, which is the safe way round: a build nobody
// configured is the free one.

export type Edition = "web" | "store";

/** The edition this build is. */
export const EDITION: Edition =
  import.meta.env.VITE_EDITION === "store" ? "store" : "web";
