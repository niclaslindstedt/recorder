// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, type ReactNode } from "react";

import {
  BottomNav as NavBar,
  FolderIcon,
  ListIcon,
  MicIcon,
  stepDirection,
} from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";

// The app's navigation: three tabs pinned to the bottom of the screen, the
// shell the sibling apps use. On a desk the same three move to the top bar
// (`TopBar.tsx`), in this order, and the bottom bar is not drawn.
//
// The order is the order of use: the button you came to press (Record), what
// it made (Recordings), and how they are arranged (Folders). Settings is not
// a place you are but a thing you do, so it lives on the top bar.

/** Every screen the shell can show. */
export type Tab = "record" | "library" | "folders" | "settings";

/** The screens that are *destinations* — the ones the bottom bar carries
 *  and a swipe moves between. */
export type NavTab = "record" | "library" | "folders";

export const TABS: NavTab[] = ["record", "library", "folders"];

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
  folders: FolderIcon,
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
