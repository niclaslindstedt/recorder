// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState } from "react";

import {
  PLAYBACK_RATES,
  Waveform,
  type Player,
} from "@niclaslindstedt/oss-framework/audio";
import {
  Button,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  IconButton,
  Modal,
  PauseIcon,
  PlayIcon,
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
import { sameEq, type Eq } from "./eq.ts";
import { EqLine, useEqName } from "./EqParts.tsx";
import { EqSheet } from "./EqSheet.tsx";
import { shareOriginal } from "./export.ts";
import { Chip, FolderChip, ToolGlyph } from "./Glyphs.tsx";
import { ClipIcon, EqIcon, ShareIcon, StarFilledIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import type { BlobStore } from "./blobStore.ts";
import { useRouting } from "./useAudioRouting.ts";
import { useEqPlayer } from "./useEqPlayer.ts";
import { usePlayhead } from "./usePlayhead.ts";
import type { Recording } from "./types.ts";
import type { DocStore } from "./useDocStore.ts";

// The player, a recording's page: listen, annotate, file, export
// (docs/design.md, "The player"). The title editable in place, the folder
// as a chip that files it, the shape with the playhead, the transport with
// the speed beside it, the note, the facts always in view, and Export — with
// Delete a glyph at the far end.

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
  /** The folder's name, for the chip beside the date. */
  folderName: string | null;
  onTrash: () => void;
  onNotice: (message: string) => void;
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
  folderName,
  onTrash,
  onNotice,
  onClose,
}: Props) {
  const t = useT();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [missing, setMissing] = useState(false);
  // The recording's EQ, as it is being heard: the stored one until the EQ
  // sheet turns it, kept when the sheet closes. Compare hears it flat.
  const [eq, setEq] = useState<Eq | null>(recording.eq ?? null);
  useEffect(() => setEq(recording.eq ?? null), [recording.eq]);
  const [eqOpen, setEqOpen] = useState(false);
  const [bypassed, setBypassed] = useState(false);
  const { sinkId } = useRouting();
  const player = useEqPlayer(blob, bypassed ? null : eq, sinkId);
  // Kept on the way out too, should the player close under the sheet.
  const pending = useRef({ eq, recording, store });
  pending.current = { eq, recording, store };
  useEffect(
    () => () => {
      const p = pending.current;
      if (!sameEq(p.eq, p.recording.eq ?? null))
        p.store.setRecordingEq(p.recording.id, p.eq);
    },
    [],
  );
  const closeEq = () => {
    setEqOpen(false);
    setBypassed(false);
    if (!sameEq(eq, recording.eq ?? null))
      store.setRecordingEq(recording.id, eq);
  };
  const eqName = useEqName()(eq);

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

  // The take as it is — the container the browser wrote, without its EQ.
  const share = async () => {
    if (!blob) return;
    try {
      const outcome = await shareOriginal(recording, blob);
      onNotice(
        outcome === "shared"
          ? t("export.shared", { file: recording.fileName })
          : t("export.done", { file: recording.fileName }),
      );
    } catch (err) {
      onNotice(
        t("common.exportFailed", {
          file: recording.fileName,
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  };

  const nextRate = () => {
    const at = PLAYBACK_RATES.indexOf(
      player.rate as (typeof PLAYBACK_RATES)[number],
    );
    player.setRate(PLAYBACK_RATES[(at + 1) % PLAYBACK_RATES.length]!);
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        labelledBy="player-title"
        centered
        size="max-w-lg"
        closeLabel={t("common.close")}
      >
        <div className="flex flex-col gap-4 p-4">
          {/* The title, editable in place — a take named "New recording 4"
            gets its real name here — the star, and the way out. */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
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
                className="-ml-2 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-fg-bright outline-none hover:border-line focus:border-accent"
              />
              <IconButton
                label={
                  recording.favorite
                    ? t("library.unfavorite")
                    : t("library.favorite")
                }
                pressed={recording.favorite}
                className="border-transparent text-flag"
                onClick={() =>
                  store.patchRecording(recording.id, {
                    favorite: !recording.favorite,
                  })
                }
              >
                {recording.favorite ? (
                  <StarFilledIcon className="h-5 w-5" />
                ) : (
                  <StarIcon className="h-5 w-5" />
                )}
              </IconButton>
              <IconButton
                label={t("common.close")}
                className="border-transparent"
                onClick={onClose}
              >
                <CloseIcon className="h-5 w-5" />
              </IconButton>
            </div>
            {/* When, and where — the folder is a chip that files it. */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{formatWhen(recording.createdAt, locale)}</span>
              <FolderChip
                name={folderName ?? t("record.noFolder")}
                label={t("player.folder", {
                  folder: folderName ?? t("record.noFolder"),
                })}
                onClick={onMove}
              />
            </div>
          </div>

          <PlayerWave
            player={player}
            peaks={recording.peaks}
            duration={duration}
            canSeek={blob !== null}
            label={t("player.position")}
          />

          {missing && (
            <p className="text-sm text-muted">{t("player.missing")}</p>
          )}
          {player.error && (
            <p role="alert" className="text-sm text-danger">
              {t("player.playFailed", { reason: player.error })}
            </p>
          )}

          {/* The transport, and the speed beside it — one button that steps,
            because it changes the transport and is set now and then. The
            spacer on the left keeps Play in the middle. */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                player.attachEq();
                setEqOpen(true);
              }}
              aria-haspopup="dialog"
              aria-label={t("eq.player", { name: eqName })}
              title={t("eq.player", { name: eqName })}
              className={`flex h-9 w-12 items-center justify-center rounded-full border transition-colors ${
                eq
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-line text-fg hover:bg-surface-2"
              }`}
            >
              {eq ? (
                <EqLine eq={eq} className="h-5 w-8" />
              ) : (
                <EqIcon className="h-5 w-5" />
              )}
            </button>
            <Button
              variant="secondary"
              className="h-12 w-12 rounded-full p-0"
              aria-label={t("player.skipBack", {
                seconds: String(skipSeconds),
              })}
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
              className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-page-bg transition-transform active:scale-95 disabled:opacity-50"
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
            <button
              type="button"
              onClick={nextRate}
              aria-label={t("player.speedIs", { rate: `${player.rate}×` })}
              className="h-9 w-12 rounded-full border border-line font-figures text-xs text-fg tabular-nums transition-colors hover:bg-surface-2"
            >
              {player.rate}×
            </button>
          </div>

          <textarea
            value={notes}
            rows={2}
            maxLength={2000}
            aria-label={t("player.notes")}
            placeholder={t("player.notesPlaceholder")}
            onInput={(e) => setNotes(e.currentTarget.value)}
            onBlur={commitNotes}
            className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 text-fg outline-none focus:border-accent"
          />

          {/* The facts, always shown, as chips: what someone checks
            before dragging it into a session, and before calling a take a
            keeper. */}
          <ul
            aria-label={t("player.details")}
            className="flex flex-wrap gap-1.5"
          >
            {[
              <Chip key="container" icon={<FileIcon className="h-3.5 w-3.5" />}>
                {formatContainer(recording.mimeType)} ·{" "}
                {t(`record.kind.${recording.kind}`)}
              </Chip>,
              <Chip key="rate">{formatRate(recording.sampleRate)}</Chip>,
              <Chip key="channels">
                {recording.channels > 1 ? t("player.stereo") : t("player.mono")}
              </Chip>,
              <Chip key="size">{formatSize(recording.size, locale)}</Chip>,
              <Chip key="peak">
                {t("record.peak")}{" "}
                <span className="font-figures tabular-nums">
                  {recording.maxPeakDb.toFixed(1)} dB
                </span>
              </Chip>,
              <Chip
                key="clips"
                tone={recording.clipCount > 0 ? "danger" : "plain"}
                icon={
                  recording.clipCount > 0 ? (
                    <ClipIcon className="h-3.5 w-3.5" />
                  ) : undefined
                }
              >
                {recording.clipCount > 0
                  ? t("record.clippedTimes", {
                      count: String(recording.clipCount),
                    })
                  : t("player.clippedNone")}
              </Chip>,
            ].map((chip) => (
              <li key={chip.key} className="flex min-w-0">
                {chip}
              </li>
            ))}
          </ul>

          {/* The ways out, as a toolbar of labelled glyphs: Export the one
            it is opened for (filled), sharing the take as it is, filing it,
            and Delete in red at the far end. */}
          <div className="flex items-start justify-between border-t border-line pt-3">
            <ToolGlyph
              label={t("library.export")}
              caption={t("player.exportShort")}
              tone="primary"
              onClick={onExport}
              disabled={!blob}
            >
              <DownloadIcon className="h-5 w-5" />
            </ToolGlyph>
            <ToolGlyph
              label={t("export.original")}
              caption={t("player.shareShort")}
              onClick={() => void share()}
              disabled={!blob}
            >
              <ShareIcon className="h-5 w-5" />
            </ToolGlyph>
            <ToolGlyph
              label={t("library.move")}
              caption={t("player.moveShort")}
              onClick={onMove}
            >
              <FolderIcon className="h-5 w-5" />
            </ToolGlyph>
            <ToolGlyph
              label={t("common.delete")}
              caption={t("player.deleteShort")}
              tone="danger"
              onClick={onTrash}
            >
              <TrashIcon className="h-5 w-5" />
            </ToolGlyph>
          </div>
        </div>
      </Modal>
      {eqOpen && (
        <EqSheet
          eq={eq}
          onChange={setEq}
          bypassed={bypassed}
          onBypass={setBypassed}
          analyser={player.analyser}
          note={t("eq.forRecording")}
          onClose={closeEq}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={player.playing ? t("player.pause") : t("player.play")}
              disabled={!blob}
              onClick={() => void player.toggle()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-page-bg transition-transform active:scale-95 disabled:opacity-50"
            >
              {player.playing ? (
                <PauseIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5 translate-x-px" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg-bright">
                {recording.title}
              </p>
              <p className="font-figures text-xs text-muted tabular-nums">
                {formatDuration(player.time * 1000)} /{" "}
                {formatDuration(duration * 1000)}
              </p>
            </div>
          </div>
        </EqSheet>
      )}
    </>
  );
}

/** The recording's shape with the playhead over it, and the time under it.
 *  Its own component, on its own animation frame, so the line moves on
 *  every frame at the playback rate (`usePlayhead.ts`) and only this
 *  redraws for it. */
function PlayerWave({
  player,
  peaks,
  duration,
  canSeek,
  label,
}: {
  player: Player;
  peaks: readonly number[];
  duration: number;
  canSeek: boolean;
  label: string;
}) {
  const time = usePlayhead(player, duration);

  return (
    <div>
      <div className="h-24 rounded-md bg-surface-2 px-2 py-1">
        <Waveform
          peaks={peaks}
          progress={duration > 0 ? time / duration : 0}
          onSeek={
            canSeek ? (share) => player.seek(share * duration) : undefined
          }
          label={label}
        />
      </div>
      <div className="mt-1 flex items-center justify-between font-figures text-xs text-muted tabular-nums">
        <span>{formatDuration(time * 1000)}</span>
        <span>{formatDuration(duration * 1000)}</span>
      </div>
    </div>
  );
}
