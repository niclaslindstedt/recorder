// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { CogIcon } from "@niclaslindstedt/oss-framework/components";

import { NAV_ICONS, TABS, type NavTab, type Tab } from "./BottomNav.tsx";
import { AppMarkIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";

// The bar across the top: the space's mark in the left corner, the app's
// mark and name, the sync glyph, and the cog. On a desk the three
// destinations sit here too, in the bottom bar's order — a row of tabs, not
// a menubar. The cog stays on the right on both shells, because Settings is
// a thing you do and leave rather than a place you are.

type Props = {
  active: Tab;
  onOpenSettings: () => void;
  /** The desk's tabs. On the phone the bottom bar carries them. */
  onSelect?: (tab: NavTab) => void;
  settingsOpen?: boolean;
  syncSlot?: ReactNode;
  /** The space switcher, in the left corner. */
  spaceSlot?: ReactNode;
};

export function TopBar({
  active,
  onOpenSettings,
  onSelect,
  settingsOpen = false,
  syncSlot,
  spaceSlot,
}: Props) {
  const t = useT();
  const onSettings = active === "settings" || settingsOpen;
  return (
    <header className="app-header relative flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 pb-3">
      <div className="flex min-w-0 shrink items-center gap-2">
        {spaceSlot}
        <h1 className="app-wordmark flex min-w-0 items-center gap-2 text-accent">
          <AppMarkIcon className="h-6 w-6 shrink-0" />
          <span className="truncate">{t("app.name")}</span>
        </h1>
      </div>

      {onSelect && (
        <nav
          aria-label={t("app.name")}
          className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex"
        >
          {TABS.map((tab) => {
            const Icon = NAV_ICONS[tab];
            const on = active === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onSelect(tab)}
                aria-current={on ? "page" : undefined}
                className={`flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                  on
                    ? "bg-accent/15 text-fg-bright"
                    : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${on ? "text-accent" : "text-muted"}`}
                />
                {t(`nav.${tab}` as const)}
              </button>
            );
          })}
        </nav>
      )}

      <div className="flex shrink-0 items-center gap-2">
        {syncSlot}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t("nav.settings")}
          aria-current={active === "settings" ? "page" : undefined}
          aria-expanded={onSelect ? settingsOpen : undefined}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-accent transition-colors ${
            onSettings ? "bg-accent/15" : "hover:bg-surface-2"
          }`}
        >
          <CogIcon className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
