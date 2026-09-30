// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render } from "preact";

// The UI family (Inter) is imported statically so it ships in the main bundle
// and precaches for offline first paint. Self-hosted from the `@fontsource`
// package and served from this origin — a font is never reached for over the
// network (see the network rule in AGENTS.md).
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-700.css";

// The wordmark's family (bold, in the two Latin subsets), and the figures'
// (`font-figures` in styles.css): the timer at 300, every other number — a
// length, a level, a size — at 400.
import "@fontsource/jetbrains-mono/latin-300.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-ext-700.css";

import "./styles.css";
import { App } from "./App.tsx";
import { DEMO, bootDemo } from "./app/dev/useDemoData.ts";
import { LanguageRoot } from "./app/i18n/index.ts";

// In dev no worker registers (`usePwaUpdate` runs disabled), but a worker
// installed by a previous `vite preview` on this origin would keep serving
// stale bytes — unregister any so the dev server always wins.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => void reg.unregister()));
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

// The store demo (`VITE_SEED=demo`, `make demo`) turns the in-memory demo
// library on BEFORE the first render, so the first frame is already the demo
// and the device's own recordings are never read, cached or synced. If the
// demo cannot load, nothing mounts. Any other build folds this to a resolved
// promise.
const boot = DEMO ? bootDemo() : Promise.resolve();

void boot.then(() =>
  render(
    <LanguageRoot>
      <App />
    </LanguageRoot>,
    root,
  ),
);
