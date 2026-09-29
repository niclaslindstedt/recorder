// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMediaQuery } from "@niclaslindstedt/oss-framework/hooks";

import { DESK_QUERY, STAND_QUERY, WIDE_QUERY } from "./shape.ts";

// The window's shape, live (see `shape.ts` for what the three are and where
// their edges fall).
//
// Three hooks rather than one, because the two questions the shell actually
// asks are not the same question. `useDesk` is "is this the desk shell" — the
// destinations on the top bar, Settings as a panel, no swipe. `useWide` is
// "does the Today screen stand its controls beside the dial", which the desk
// and the stand both do; it is the `wide:` variant in `styles.css` read from
// JavaScript, and everything it guards is layout.

/** The desk shell: the top bar's tabs, the side panel, no swipe. */
export function useDesk(): boolean {
  return useMediaQuery(DESK_QUERY);
}

/** A phone laid on its side: the phone's shell, the desk's Today. */
export function useStand(): boolean {
  return useMediaQuery(STAND_QUERY);
}

/** Either of the two shapes that put the day's controls beside the dial:
 *  the stand, and a desk laid wide (an upright tablet stacks them the way
 *  the phone does — `todayBeside` in `shape.ts`). The companion of the
 *  stylesheet's `wide:` variant — keep the pair in step. */
export function useWide(): boolean {
  return useMediaQuery(WIDE_QUERY);
}
