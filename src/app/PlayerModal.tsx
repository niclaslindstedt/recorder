// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useState } from "react";

import {
  PLAYBACK_RATES,
  Waveform,
  usePlayer,
} from "@niclaslindstedt/oss-framework/audio";
import {
  Button,
  Modal,
  PauseIcon,
  PlayIcon,
  SegmentedControl,
  SkipBackIcon,
  SkipForwardIcon,
  SpinnerIcon,
  StarIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import {
  formatContainer,
  formatDuration,
  formatRate,
  formatSize,
  formatWhen,
} from "./format.ts";
import { StarFilledIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import type { BlobStore } from "./blobStore.ts";
import type { Recording } from "./types.ts";
import type { DocStore } from "./useDocStore.ts";

// The player: the recording's shape with the playhead over it, the
// transport, the speed, the title and the note, and the facts about the
// take. A full sheet on a phone, a card on a desk.

type Props = {
  recording: Recording;
  store: DocStore;
  blobs: BlobStore;
  /** The file may not have arrived yet; bumped when the sync brings one. */
  filesVersion: number;
  locale: string;
  skipSeconds: number;
  onExport: () => void;
  onMove: () => void;
  onTrash: () => void;
  onClose: () => void;
};

export function PlayerModal({
  recording,
  store,
  blobs,
  filesVersion,
  locale,
  skipSeconds,
  onExport,
  onMove,
  onTrash,
  onClose,
}: Props) {
  const t = useT();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [missing, setMissing] = useState(false);
  const player = usePlayer(blob);

  useEffect(() => {
    let live = true;
    setMissing(false);
    void blobs.readBlob(recording.fileName).then((b) => {
      if (!live) return;
      setBlob(b);
      setMissing(b === null);
    });
    return () => {
      live = false;
    };
  }, [blobs, recording.fileName, filesVersion]);

  const duration = player.duration || recording.durationMs / 1000;
  const progress = duration > 0 ? player.time / duration : 0;
  const [title, setTitle] = useState(recording.title);
  const [notes, setNotes] = useState(recording.notes);
  useEffect(() => setTitle(recording.title), [recording.title]);
  useEffect(() => setNotes(recording.notes), [recording.notes]);

  const commitTitle = () => {
    const next = title.trim();
    if (next && next !== recording.title)
      store.patchRecording(recording.id, { title: next });
    else setTitle(recording.title);
  };
  const commitNotes = () => {
    if (notes !== recording.notes)
      store.patchRecording(recording.id, { notes });
  };

  const facts = useMemo(
    () => [
      [t("player.recorded"), formatWhen(recording.createdAt, locale)],
      [t("player.duration"), formatDuration(recording.durationMs)],
      [t("player.size"), formatSize(recording.size, locale)],
      [
        t("player.format"),
        `${formatContainer(recording.mimeType)} · ${t(`record.kind.${recording.kind}`)}`,
      ],
      [t("player.sampleRate"), formatRate(recording.sampleRate)],
      [
        t("player.channels"),
        recording.channels > 1 ? t("player.stereo") : t("player.mono"),
      ],
      [t("player.peak"), `${recording.maxPeakDb.toFixed(1)} dB`],
      [
        t("player.clipped"),
        recording.clipCount > 0
          ? t("player.clippedTimes", { count: String(recording.clipCount) })
          : t("player.clippedNone"),
      ],
    ],
    [recording, locale, t],
  );

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="player-title"
      centered
      size="max-w-lg"
      closeLabel={t("common.close")}
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-2">
          <input
            id="player-title"
            type="text"
            value={title}
            maxLength={200}
            aria-label={t("player.rename")}
            onInput={(e) => setTitle(e.currentTarget.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-fg-bright outline-none hover:border-line focus:border-accent"
          />
          <button
            type="button"
            aria-pressed={recording.favorite}
            aria-label={
              recording.favorite
                ? t("library.unfavorite")
                : t("library.favorite")
            }
            onClick={() =>
              store.patchRecording(recording.id, {
                favorite: !recording.favorite,
              })
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-flag hover:bg-surface-2"
          >
            {recording.favorite ? (
              <StarFilledIcon className="h-5 w-5" />
            ) : (
              <StarIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="h-20 rounded-md bg-surface-2 px-2 py-1">
          <Waveform
            peaks={recording.peaks}
            progress={progress}
            onSeek={blob ? (share) => player.seek(share * duration) : undefined}
            label={t("player.position")}
          />
        </div>
        <div className="flex items-center justify-between font-mono text-xs tabular-nums text-muted">
          <span>{formatDuration(player.time * 1000)}</span>
          <span>{formatDuration(duration * 1000)}</span>
        </div>

        {missing && <p className="text-sm text-muted">{t("player.missing")}</p>}
        {player.error && (
          <p role="alert" className="text-sm text-danger">
            {t("player.playFailed", { reason: player.error })}
          </p>
        )}

        <div className="flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            className="h-12 w-12 rounded-full p-0"
            aria-label={t("player.skipBack", { seconds: String(skipSeconds) })}
            disabled={!blob}
            onClick={() => player.skip(-skipSeconds)}
          >
            <SkipBackIcon className="h-6 w-6" />
          </Button>
          <button
            type="button"
            aria-label={player.playing ? t("player.pause") : t("player.play")}
            disabled={!blob}
            onClick={() => void player.toggle()}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-page transition-transform active:scale-95 disabled:opacity-50"
          >
            {!blob && !missing ? (
              <SpinnerIcon className="h-6 w-6 animate-spin" />
            ) : player.playing ? (
              <PauseIcon className="h-7 w-7" />
            ) : (
              <PlayIcon className="h-7 w-7 translate-x-0.5" />
            )}
          </button>
          <Button
            variant="secondary"
            className="h-12 w-12 rounded-full p-0"
            aria-label={t("player.skipForward", {
              seconds: String(skipSeconds),
            })}
            disabled={!blob}
            onClick={() => player.skip(skipSeconds)}
          >
            <SkipForwardIcon className="h-6 w-6" />
          </Button>
        </div>

        <SegmentedControl<string>
          value={String(player.rate)}
          options={PLAYBACK_RATES.map((r) => ({
            value: String(r),
            label: `${r}×`,
          }))}
          onChange={(next) => player.setRate(Number(next))}
          ariaLabel={t("player.speed")}
          fullWidth
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-fg">
            {t("player.notes")}
          </span>
          <textarea
            value={notes}
            rows={2}
            maxLength={2000}
            placeholder={t("player.notesPlaceholder")}
            onInput={(e) => setNotes(e.currentTarget.value)}
            onBlur={commitNotes}
            className="w-full resize-y rounded-md border border-line bg-surface-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onExport} disabled={!blob}>
            {t("library.export")}
          </Button>
          <Button onClick={onMove}>{t("library.move")}</Button>
          <Button variant="danger" onClick={onTrash}>
            <TrashIcon className="h-4 w-4" />
            {t("common.delete")}
          </Button>
        </div>

        <details className="rounded-md border border-line">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-fg">
            {t("player.details")}
          </summary>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 pb-3 text-sm">
            {facts.map(([k, v]) => (
              <>
                <dt key={`${k}-k`} className="text-muted">
                  {k}
                </dt>
                <dd key={`${k}-v`} className="text-fg">
                  {v}
                </dd>
              </>
            ))}
          </dl>
        </details>
      </div>
    </Modal>
  );
}
