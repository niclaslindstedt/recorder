// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useState } from "react";

import {
  ChevronDownIcon,
  ConfirmDialog,
  ContextMenu,
  DownloadIcon,
  FolderIcon,
  IconButton,
  ListIcon,
  RestoreIcon,
  RowActionMenu,
  SearchIcon,
  StarIcon,
  SwipeableRow,
  TrashIcon,
  type RowAction,
} from "@niclaslindstedt/oss-framework/components";

import { FolderPicker, type LibraryView } from "./FolderPicker.tsx";
import { folderPath, subtreeIds } from "./folders.ts";
import { formatClock, formatDay, groupByDay } from "./format.ts";
import { useT } from "./i18n/index.ts";
import { StarFilledIcon } from "./icons.tsx";
import { RecordingRow } from "./RecordingRow.tsx";
import { SearchSheet } from "./SearchSheet.tsx";
import {
  TRASH_DAYS,
  liveRecordings,
  trashedRecordings,
  type AppData,
  type Recording,
} from "./types.ts";
import type { DocStore } from "./useDocStore.ts";

export type { LibraryView } from "./FolderPicker.tsx";

// The Recordings screen: where the "after" happens (docs/design.md,
// "Recordings"). One line of chrome — the scope, which says where you are
// and how many, and opens the folder picker; and the search glyph, which
// opens the search sheet — and then the list, under day headings, so a row's
// own line only has to say the time.
//
// A tap opens the player, a swipe bares a trash button (the press on it is
// what deletes, so a swipe that went too far deletes nothing), a hold offers
// the rest.

type Props = {
  data: AppData;
  store: DocStore;
  view: LibraryView;
  onView: (view: LibraryView) => void;
  /** The files on this device, by name — a recording whose file has not
   *  arrived yet says so. */
  present: ReadonlySet<string>;
  locale: string;
  now: Date;
  onOpen: (id: string) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onMove: (id: string) => void;
  onExport: (id: string) => void;
  onNotice: (message: string) => void;
};

export function LibraryScreen({
  data,
  store,
  view,
  onView,
  present,
  locale,
  now,
  onOpen,
  onFavorite,
  onTrash,
  onRestore,
  onPurge,
  onMove,
  onExport,
  onNotice,
}: Props) {
  const t = useT();
  const [purge, setPurge] = useState<Recording | null>(null);
  const [picking, setPicking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState<{
    recording: Recording;
    at: { x: number; y: number };
  } | null>(null);

  const rows = useMemo((): Recording[] => {
    if (view.kind === "trash") return trashedRecordings(data, now);
    if (view.kind === "favorites")
      return liveRecordings(data).filter((r) => r.favorite);
    if (view.kind === "folder") {
      const ids = subtreeIds(data, view.folderId);
      return liveRecordings(data).filter(
        (r) => r.folderId && ids.has(r.folderId),
      );
    }
    return liveRecordings(data);
  }, [data, view, now]);

  const groups = useMemo(
    () =>
      view.kind === "trash"
        ? [{ key: "trash", items: rows }]
        : groupByDay(rows),
    [rows, view.kind],
  );

  const scopeLabel =
    view.kind === "trash"
      ? t("library.trash")
      : view.kind === "favorites"
        ? t("library.favorites")
        : view.kind === "folder"
          ? folderPath(data, view.folderId)
              .map((f) => f.name)
              .join(" › ") || t("library.all")
          : t("library.all");
  const ScopeIcon =
    view.kind === "trash"
      ? TrashIcon
      : view.kind === "favorites"
        ? StarIcon
        : view.kind === "folder"
          ? FolderIcon
          : ListIcon;

  const empty =
    view.kind === "trash"
      ? t("library.emptyTrash")
      : view.kind === "folder" || view.kind === "favorites"
        ? t("library.emptyFolder")
        : t("library.empty");

  const nameOf = (id: string | null) =>
    id ? (data.folders[id]?.name ?? "") : "";
  const dayLabels = {
    today: t("common.today"),
    yesterday: t("common.yesterday"),
  };

  const detailOf = (r: Recording): string => {
    const parts =
      view.kind === "trash"
        ? [
            `${formatDay(r.createdAt, now, locale, dayLabels)} ${formatClock(r.createdAt, locale)}`,
          ]
        : [formatClock(r.createdAt, locale)];
    // The folder, where the scope has not already said it: everywhere but a
    // folder, and inside one for what is in a folder under it.
    if (
      r.folderId &&
      nameOf(r.folderId) &&
      !(view.kind === "folder" && r.folderId === view.folderId)
    )
      parts.push(nameOf(r.folderId));
    if (!present.has(r.fileName)) parts.push(t("library.fetching"));
    return parts.join(" · ");
  };

  return (
    <div className="flex min-h-full flex-1 flex-col gap-2 px-3 py-3">
      {/* The scope is the heading: where you are, how many, and — pressed —
          everywhere else you could be. Search sits at the far end. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-haspopup="dialog"
          aria-label={t("library.scope", { scope: scopeLabel })}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-surface-2"
        >
          <ScopeIcon
            className={`h-5 w-5 shrink-0 ${view.kind === "trash" ? "text-danger" : "text-accent"}`}
          />
          <span className="truncate text-lg font-bold text-fg-bright">
            {scopeLabel}
          </span>
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-figures text-xs text-muted tabular-nums">
            {rows.length}
          </span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
        </button>
        {/* Favorites at a press, and back: the scope's commonest change,
            as a glyph beside it. */}
        <IconButton
          label={
            view.kind === "favorites"
              ? t("library.showAll")
              : t("library.showFavorites")
          }
          pressed={view.kind === "favorites"}
          onClick={() =>
            onView(
              view.kind === "favorites"
                ? { kind: "all" }
                : { kind: "favorites" },
            )
          }
          className={`h-11 w-11 ${view.kind === "favorites" ? "text-flag" : ""}`}
        >
          {view.kind === "favorites" ? (
            <StarFilledIcon className="h-5 w-5" />
          ) : (
            <StarIcon className="h-5 w-5" />
          )}
        </IconButton>
        <IconButton
          label={t("library.search")}
          onClick={() => setSearching(true)}
          className="h-11 w-11"
        >
          <SearchIcon className="h-5 w-5" />
        </IconButton>
      </div>

      {view.kind === "trash" && (
        <p className="px-2 text-xs text-muted">
          {t("library.trashHint", { days: String(TRASH_DAYS) })}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-12 text-center">
          <p className="text-fg">{empty}</p>
          {view.kind === "all" && (
            <p className="text-sm text-muted">{t("library.emptyHint")}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-1.5">
              {view.kind !== "trash" && (
                <h3 className="px-2 pt-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {formatDay(group.items[0]!.createdAt, now, locale, dayLabels)}
                </h3>
              )}
              <ul className="flex flex-col gap-1.5">
                {group.items.map((r) => (
                  <li key={r.id}>
                    <SwipeableRow
                      trailing={{
                        kind: "reveal",
                        buttonWidth: 72,
                        buttons: [
                          {
                            label:
                              view.kind === "trash"
                                ? t("library.deleteForever")
                                : t("common.delete"),
                            icon: <TrashIcon className="h-5 w-5" />,
                            onSelect: () =>
                              view.kind === "trash"
                                ? setPurge(r)
                                : onTrash(r.id),
                            danger: true,
                          },
                        ],
                      }}
                      className="rounded-lg"
                    >
                      <RowActionMenu
                        actions={actionsFor(r)}
                        ariaLabel={r.title}
                      >
                        <RecordingRow
                          recording={r}
                          detail={detailOf(r)}
                          onOpen={() => onOpen(r.id)}
                          onMore={(at) => setMenu({ recording: r, at })}
                          moreLabel={t("library.more", { title: r.title })}
                        />
                      </RowActionMenu>
                    </SwipeableRow>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {picking && (
        <FolderPicker
          mode="browse"
          data={data}
          store={store}
          view={view}
          now={now}
          onView={(next) => {
            onView(next);
            setPicking(false);
          }}
          onNotice={onNotice}
          onClose={() => setPicking(false)}
        />
      )}

      {searching && (
        <SearchSheet
          data={data}
          locale={locale}
          now={now}
          onOpen={onOpen}
          onClose={() => setSearching(false)}
        />
      )}

      {menu && (
        <ContextMenu
          position={menu.at}
          actions={actionsFor(menu.recording)}
          onClose={() => setMenu(null)}
          ariaLabel={menu.recording.title}
        />
      )}

      <ConfirmDialog
        open={purge !== null}
        title={t("library.deleteForeverConfirm", { title: purge?.title ?? "" })}
        description={t("library.deleteForeverHint")}
        confirmLabel={t("library.deleteForever")}
        tone="danger"
        labels={{ cancel: t("common.cancel"), close: t("common.close") }}
        onConfirm={() => {
          if (purge) onPurge(purge.id);
          setPurge(null);
        }}
        onCancel={() => setPurge(null)}
      />
    </div>
  );

  function actionsFor(r: Recording): RowAction[] {
    const icon = "h-4 w-4";
    if (view.kind === "trash")
      return [
        {
          label: t("library.restore"),
          icon: <RestoreIcon className={icon} />,
          onSelect: () => onRestore(r.id),
        },
        {
          label: t("library.deleteForever"),
          icon: <TrashIcon className={icon} />,
          onSelect: () => setPurge(r),
          danger: true,
        },
      ];
    return [
      {
        label: r.favorite ? t("library.unfavorite") : t("library.favorite"),
        icon: <StarIcon className={icon} />,
        onSelect: () => onFavorite(r.id, !r.favorite),
      },
      {
        label: t("library.move"),
        icon: <FolderIcon className={icon} />,
        onSelect: () => onMove(r.id),
      },
      {
        label: t("library.export"),
        icon: <DownloadIcon className={icon} />,
        onSelect: () => onExport(r.id),
      },
      {
        label: t("common.delete"),
        icon: <TrashIcon className={icon} />,
        onSelect: () => onTrash(r.id),
        danger: true,
      },
    ];
  }
}
