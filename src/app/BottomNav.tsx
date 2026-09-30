// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, type ReactNode } from "react";

import {
  BottomNav as NavBar,
  ListIcon,
  MicIcon,
  stepDirection,
} from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";

// The app's navigation: two tabs pinned to the bottom of the screen, the
// shell the sibling apps use. On a desk the same two move to the top bar
// (`TopBar.tsx`), in this order, and the bottom bar is not drawn.
//
// The two places a person *is*: at the microphone (Record), or among what it
// made (Recordings). Folders are arranged from the recordings themselves —
// the library's scope picker — not on a page of their own; Settings and the
// spaces are things you do and leave, so they live on the top bar.

/** Every screen the shell can show. */
export type Tab = "record" | "library" | "settings";

/** The screens that are *destinations* — the ones the bottom bar carries
 *  and a swipe moves between. */
export type NavTab = "record" | "library";

export const TABS: NavTab[] = ["record", "library"];

export function isNavTab(tab: Tab): tab is NavTab {
  return (TABS as Tab[]).includes(tab);
}

export type ScreenEnter = "forward" | "back" | "none";

/** How a move from one screen to another should animate. */
export function screenEnter(from: Tab, to: Tab): ScreenEnter {
  return stepDirection(TABS, from as NavTab, to as NavTab);
}

export const NAV_ICONS: Record<
  NavTab,
  (props: { className?: string }) => ReactNode
> = {
  record: MicIcon,
  library: ListIcon,
};

export function BottomNav({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (tab: NavTab) => void;
}) {
  const t = useT();
  const items = useMemo(
    () =>
      TABS.map((tab) => ({
        id: tab,
        label: t(`nav.${tab}` as const),
        icon: NAV_ICONS[tab],
      })),
    [t],
  );
  return (
    <NavBar
      items={items}
      active={active}
      onSelect={onSelect}
      label={t("app.name")}
      className="app-bottom-nav"
    />
  );
}
