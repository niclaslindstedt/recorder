// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useState } from "react";

import { Waveform } from "@niclaslindstedt/oss-framework/audio";
import {
  Button,
  ChevronRightIcon,
  ClearableInput,
  ConfirmDialog,
  RowActionMenu,
  StarIcon,
  SwipeableRow,
  TrashIcon,
  type RowAction,
} from "@niclaslindstedt/oss-framework/components";

import { folderPath, recordingsIn, subtreeIds } from "./folders.ts";
import { formatClock, formatDay, formatDuration } from "./format.ts";
import { StarFilledIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import {
  TRASH_DAYS,
  liveRecordings,
  trashedRecordings,
  type AppData,
  type Recording,
} from "./types.ts";

// The Recordings screen: the list, newest first, filtered by the folder the
// reader is in, by Favorites, by a search, or showing the trash. A row is a
// thumbnail, a title and a line of facts; a tap opens the player, a swipe
// deletes, a hold offers the rest.

export type LibraryView =
  | { kind: "all" }
  | { kind: "folder"; folderId: string }
  | { kind: "favorites" }
  | { kind: "trash" };

type Props = {
  data: AppData;
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
  onOpenFolders: () => void;
};

export function LibraryScreen({
  data,
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
  onOpenFolders,
}: Props) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [purge, setPurge] = useState<Recording | null>(null);

  const rows = useMemo((): Recording[] => {
    let list: Recording[];
    if (view.kind === "trash") list = trashedRecordings(data, now);
    else if (view.kind === "favorites")
      list = liveRecordings(data).filter((r) => r.favorite);
    else if (view.kind === "folder") {
      const ids = subtreeIds(data, view.folderId);
      list = liveRecordings(data).filter(
        (r) => r.folderId && ids.has(r.folderId),
      );
      // The folder's own first, then what is under it — `recordingsIn`
      // already orders the folder's own; the rest keep their date order.
      const own = new Set(recordingsIn(data, view.folderId).map((r) => r.id));
      list = [
        ...list.filter((r) => own.has(r.id)),
        ...list.filter((r) => !own.has(r.id)),
      ];
    } else list = liveRecordings(data);
    const q = query.trim().toLowerCase();
    if (q)
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q),
      );
    return list;
  }, [data, view, query, now]);

  const heading =
    view.kind === "trash"
      ? t("library.trash")
      : view.kind === "favorites"
        ? t("library.favorites")
        : view.kind === "folder"
          ? folderPath(data, view.folderId)
              .map((f) => f.name)
              .join(" › ") || t("library.all")
          : t("library.all");

  const empty =
    query.trim() !== ""
      ? t("library.emptySearch", { query: query.trim() })
      : view.kind === "trash"
        ? t("library.emptyTrash")
        : view.kind === "folder" || view.kind === "favorites"
          ? t("library.emptyFolder")
          : t("library.empty");

  const nameOf = (id: string | null) =>
    id ? (data.folders[id]?.name ?? "") : "";

  return (
    <div className="flex min-h-full flex-1 flex-col gap-3 px-3 py-3">
      <div className="flex items-center gap-2">
        <ClearableInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("library.searchPlaceholder")}
          aria-label={t("library.search")}
          clearLabel={t("common.close")}
          wrapperClassName="flex-1"
        />
      </div>

      {/* Where the list is: All, a folder, Favorites or the trash. */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Chip on={view.kind === "all"} onClick={() => onView({ kind: "all" })}>
          {t("library.all")}
        </Chip>
        <Chip
          on={view.kind === "favorites"}
          onClick={() => onView({ kind: "favorites" })}
        >
          <StarIcon className="h-3.5 w-3.5" />
          {t("library.favorites")}
        </Chip>
        <Chip on={view.kind === "folder"} onClick={onOpenFolders}>
          {view.kind === "folder" ? heading : t("nav.folders")}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Chip>
        <Chip
          on={view.kind === "trash"}
          onClick={() => onView({ kind: "trash" })}
        >
          <TrashIcon className="h-3.5 w-3.5" />
          {t("library.trash")}
        </Chip>
      </div>

      {view.kind === "trash" && (
        <p className="text-xs text-muted">
          {t("library.trashHint", { days: String(TRASH_DAYS) })}
        </p>
      )}

      <p className="text-xs text-muted" aria-live="polite">
        {rows.length === 1
          ? t("library.countOne")
          : t("library.count", { count: String(rows.length) })}
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-12 text-center">
          <p className="text-fg">{empty}</p>
          {view.kind === "all" && !query && (
            <p className="text-sm text-muted">{t("library.emptyHint")}</p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const here = present.has(r.fileName);
            const actions: RowAction[] =
              view.kind === "trash"
                ? [
                    {
                      label: t("library.restore"),
                      onSelect: () => onRestore(r.id),
                    },
                    {
                      label: t("library.deleteForever"),
                      onSelect: () => setPurge(r),
                      danger: true,
                    },
                  ]
                : [
                    {
                      label: r.favorite
                        ? t("library.unfavorite")
                        : t("library.favorite"),
                      onSelect: () => onFavorite(r.id, !r.favorite),
                    },
                    { label: t("library.move"), onSelect: () => onMove(r.id) },
                    {
                      label: t("library.export"),
                      onSelect: () => onExport(r.id),
                    },
                    {
                      label: t("common.delete"),
                      onSelect: () => onTrash(r.id),
                      danger: true,
                    },
                  ];
            return (
              <li key={r.id}>
                <SwipeableRow
                  trailing={{
                    kind: "commit",
                    onCommit: () =>
                      view.kind === "trash" ? setPurge(r) : onTrash(r.id),
                    label: t("common.delete"),
                    icon: <TrashIcon className="h-5 w-5" />,
                  }}
                  className="rounded-lg"
                >
                  <RowActionMenu actions={actions} ariaLabel={r.title}>
                    <button
                      type="button"
                      onClick={() => onOpen(r.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left hover:bg-surface-2"
                    >
                      <div className="h-8 w-16 shrink-0 text-muted">
                        <Waveform peaks={r.peaks} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-fg-bright">
                            {r.title}
                          </span>
                          {r.favorite && (
                            <StarFilledIcon className="h-3.5 w-3.5 shrink-0 text-flag" />
                          )}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {formatDay(r.createdAt, now, locale, {
                            today: t("common.today"),
                            yesterday: t("common.yesterday"),
                          })}{" "}
                          {formatClock(r.createdAt, locale)} ·{" "}
                          {formatDuration(r.durationMs)}
                          {view.kind !== "folder" &&
                          r.folderId &&
                          nameOf(r.folderId)
                            ? ` · ${nameOf(r.folderId)}`
                            : ""}
                          {!here ? ` · ${t("library.fetching")}` : ""}
                        </div>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  </RowActionMenu>
                </SwipeableRow>
              </li>
            );
          })}
        </ul>
      )}

      {view.kind === "trash" && rows.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onView({ kind: "all" })}>
            {t("common.back")}
          </Button>
        </div>
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
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: preact.ComponentChildren;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${
        on
          ? "border-accent bg-accent/15 text-fg-bright"
          : "border-line text-muted hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
