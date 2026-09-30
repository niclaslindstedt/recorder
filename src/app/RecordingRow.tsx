// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Waveform } from "@niclaslindstedt/oss-framework/audio";

import { formatDuration } from "./format.ts";
import { StarFilledIcon } from "./icons.tsx";
import type { Recording } from "./types.ts";

// One recording, as a row: the thumbnail (recognition at a glance), the
// title with its star, a quiet line under it, and the length in the right
// corner in tabular figures, so a long interview stands out from a
// thirty-second memo down a whole list. The library, search and the Record
// screen's Latest all draw it, so a recording looks the same wherever it is
// met. No chevron: every row is plainly a thing to tap, and the corner is
// the length's.

type Props = {
  recording: Recording;
  /** The quiet line: the time, the folder, whatever the list around it has
   *  not already said. */
  detail: string;
  onOpen: () => void;
  /** A slimmer row, for the Record screen's Latest. */
  dense?: boolean;
};

export function RecordingRow({ recording: r, detail, onOpen, dense }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-lg border border-line bg-surface text-left transition-colors hover:bg-surface-2 ${
        dense ? "px-3 py-2" : "px-3 py-2.5"
      }`}
    >
      <div className={`${dense ? "h-6 w-12" : "h-8 w-14"} shrink-0 text-muted`}>
        <Waveform peaks={r.peaks} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-fg-bright">{r.title}</span>
          {r.favorite && (
            <StarFilledIcon className="h-3.5 w-3.5 shrink-0 text-flag" />
          )}
        </div>
        {detail && <div className="truncate text-xs text-muted">{detail}</div>}
      </div>
      <span className="shrink-0 font-figures text-sm text-muted tabular-nums">
        {formatDuration(r.durationMs)}
      </span>
    </button>
  );
}
