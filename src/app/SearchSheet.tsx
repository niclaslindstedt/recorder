// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useRef, useState } from "react";

import { Modal, SearchIcon } from "@niclaslindstedt/oss-framework/components";

import { formatClock, formatDay } from "./format.ts";
import { useT } from "./i18n/index.ts";
import { SheetTitle } from "./ModalHeader.tsx";
import { RecordingRow } from "./RecordingRow.tsx";
import { liveRecordings, type AppData } from "./types.ts";

// Search, as a moment rather than a fixture (docs/design.md,
// "Recordings"): a sheet with the field at the top, already focused, and
// the results under it with the whole height to themselves. It looks
// through every folder in the space — titles, notes and the folder's name —
// because the reason to search is not knowing where something was filed.
// A result opens the player over the sheet, so closing it comes back to the
// results.

type Props = {
  data: AppData;
  locale: string;
  now: Date;
  onOpen: (id: string) => void;
  onClose: () => void;
};

export function SearchSheet({ data, locale, now, onOpen, onClose }: Props) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return liveRecordings(data).filter((r) => {
      const folder = r.folderId ? (data.folders[r.folderId]?.name ?? "") : "";
      return (
        r.title.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        folder.toLowerCase().includes(q)
      );
    });
  }, [data, q]);

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="search-title"
      initialFocusRef={input}
      size="max-w-lg"
      closeLabel={t("common.close")}
    >
      <SheetTitle
        titleId="search-title"
        title={t("library.search")}
        onClose={onClose}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
          <span id="search-title" className="sr-only">
            {t("library.search")}
          </span>
          <input
            ref={input}
            type="search"
            value={query}
            aria-labelledby="search-title"
            placeholder={t("library.searchPlaceholder")}
            onInput={(e) => setQuery(e.currentTarget.value)}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-fg-bright outline-none placeholder:text-muted"
          />
        </label>
      </SheetTitle>
      <div className="flex min-h-[40vh] flex-col gap-1.5 p-3">
        {!q ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            {t("library.searchHint")}
          </p>
        ) : results.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            {t("library.emptySearch", { query: query.trim() })}
          </p>
        ) : (
          <>
            <p className="px-1 text-xs text-muted" aria-live="polite">
              {results.length === 1
                ? t("library.countOne")
                : t("library.count", { count: String(results.length) })}
            </p>
            <ul className="flex flex-col gap-1.5">
              {results.map((r) => (
                <li key={r.id}>
                  <RecordingRow
                    recording={r}
                    detail={[
                      `${formatDay(r.createdAt, now, locale, {
                        today: t("common.today"),
                        yesterday: t("common.yesterday"),
                      })} ${formatClock(r.createdAt, locale)}`,
                      r.folderId ? (data.folders[r.folderId]?.name ?? "") : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onOpen={() => onOpen(r.id)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
