// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState } from "react";

import {
  PLAYBACK_RATES,
  Waveform,
  type Player,
} from "@niclaslindstedt/oss-framework/audio";
import {
  Button,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
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
import { EqIcon, StarFilledIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import type { BlobStore } from "./blobStore.ts";
import { stepPlayhead, type Playhead } from "./playhead.ts";
import { useEqPlayer } from "./useEqPlayer.ts";
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
  const player = useEqPlayer(blob, bypassed ? null : eq);
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

  // The format line: container and how it was kept, rate, channels, size.
  const format = [
    `${formatContainer(recording.mimeType)} · ${t(`record.kind.${recording.kind}`)}`,
    formatRate(recording.sampleRate),
    recording.channels > 1 ? t("player.stereo") : t("player.mono"),
    formatSize(recording.size, locale),
  ].join(" · ");

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
              <button
                type="button"
                onClick={onMove}
                aria-label={t("player.folder", {
                  folder: folderName ?? t("record.noFolder"),
                })}
                className="flex max-w-full items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-fg transition-colors hover:border-accent/60 hover:bg-surface-2"
              >
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="truncate">
                  {folderName ?? t("record.noFolder")}
                </span>
                <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
              </button>
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

          {/* The facts, always shown: what someone checks before dragging
            it into a session, and before calling a take a keeper. */}
          <dl className="flex flex-col gap-0.5 text-xs text-muted">
            <div className="flex flex-wrap gap-x-2">
              <dt className="sr-only">{t("player.format")}</dt>
              <dd>{format}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="sr-only">{t("player.peak")}</dt>
              <dd>
                {t("record.peak")}{" "}
                <span className="font-figures tabular-nums">
                  {recording.maxPeakDb.toFixed(1)} dB
                </span>
              </dd>
              <span aria-hidden>·</span>
              <dt className="sr-only">{t("player.clipped")}</dt>
              <dd className={recording.clipCount > 0 ? "text-danger" : ""}>
                {recording.clipCount > 0
                  ? t("record.clippedTimes", {
                      count: String(recording.clipCount),
                    })
                  : t("player.clippedNone")}
              </dd>
            </div>
          </dl>

          {/* The way out, labelled because it is what the player is opened
            for as often as listening; Delete a glyph at the other end. */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              className="flex h-11 flex-1 items-center justify-center gap-2"
              onClick={onExport}
              disabled={!blob}
            >
              <DownloadIcon className="h-4 w-4" />
              {t("library.export")}
            </Button>
            <IconButton
              label={t("common.delete")}
              className="h-11 w-11 hover:border-danger/60 hover:bg-danger/10"
              onClick={onTrash}
            >
              <TrashIcon className="h-5 w-5 text-danger" />
            </IconButton>
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
 *  every frame at the playback rate (`playhead.ts`) and only this redraws
 *  for it. */
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
  const latest = useRef(player);
  latest.current = player;
  const head = useRef<Playhead | null>(null);
  const [time, setTime] = useState(player.time);
  const { playing, rate } = player;

  // Paused, the line stands where the element says — a seek lands at once.
  useEffect(() => {
    if (playing) return;
    head.current = null;
    setTime(player.time);
  }, [playing, player.time]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = (now: number) => {
      head.current = stepPlayhead(head.current, latest.current.time, now, {
        playing: true,
        rate,
        duration,
      });
      setTime(head.current.time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, rate, duration]);

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
