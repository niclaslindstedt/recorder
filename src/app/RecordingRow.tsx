// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef } from "react";

import { Waveform } from "@niclaslindstedt/oss-framework/audio";
import { IconButton } from "@niclaslindstedt/oss-framework/components";

import { formatDuration } from "./format.ts";
import { MoreIcon, StarFilledIcon } from "./icons.tsx";
import type { Recording } from "./types.ts";

// One recording, as a row: the thumbnail (recognition at a glance), the
// title with its star, a quiet line under it, and the length in the right
// corner in tabular figures, so a long interview stands out from a
// thirty-second memo down a whole list. The library and search both draw
// it, so a recording looks the same wherever it is met. No chevron: every
// row is plainly a thing to tap. In the library a ⋯ glyph ends the row,
// opening the menu a hold opens.

type Props = {
  recording: Recording;
  /** The quiet line: the time, the folder, whatever the list around it has
   *  not already said. */
  detail: string;
  onOpen: () => void;
  /** The ⋯ at the row's end: the same menu a hold opens, for a reader who
   *  would not guess the hold. Opened at the glyph's corner. */
  onMore?: (at: { x: number; y: number }) => void;
  moreLabel?: string;
};

export function RecordingRow({
  recording: r,
  detail,
  onOpen,
  onMore,
  moreLabel,
}: Props) {
  const more = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex w-full items-center rounded-lg border border-line bg-surface transition-colors hover:bg-surface-2">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left ${onMore ? "pr-1" : "pr-3"}`}
      >
        <div className="h-8 w-14 shrink-0 text-muted">
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
          {detail && (
            <div className="truncate text-xs text-muted">{detail}</div>
          )}
        </div>
        <span className="shrink-0 font-figures text-sm text-muted tabular-nums">
          {formatDuration(r.durationMs)}
        </span>
      </button>
      {onMore && (
        <IconButton
          ref={more}
          label={moreLabel ?? ""}
          className="mr-1 border-transparent text-muted"
          onClick={() => {
            const box = more.current?.getBoundingClientRect();
            onMore(box ? { x: box.right, y: box.bottom } : { x: 0, y: 0 });
          }}
        >
          <MoreIcon className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}
