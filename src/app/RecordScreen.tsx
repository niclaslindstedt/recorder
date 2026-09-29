// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  LevelMeter,
  SpectrumBars,
  Waveform,
  bandTicks,
  layoutBands,
  useRecorder,
  type CaptureFrame,
  type CaptureResult,
} from "@niclaslindstedt/oss-framework/audio";
import {
  Button,
  ConfirmDialog,
  Modal,
  PauseIcon,
  PlayIcon,
  SelectPicker,
  StopIcon,
} from "@niclaslindstedt/oss-framework/components";

import { folderTree } from "./folders.ts";
import { formatTimer } from "./format.ts";
import { useT } from "./i18n/index.ts";
import { ModalHeader } from "./ModalHeader.tsx";
import { defaultTitle, finishTake } from "./takes.ts";
import { liveCtx } from "./ids.ts";
import { liveRecordings, type AppData, type Recording } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";

// The Record screen: the timer, the meter with its clip lamp, the spectrum
// under it, the shape of the take so far, and the one button. Everything
// live is drawn from the recorder's frames off the render loop; the screen
// itself renders a few times a second for the timer.
//
// A take ends in the naming sheet: a title (numbered past the ones taken),
// a folder, Save or Discard. Nothing is written until Save — a discarded
// take was never anywhere.

type Props = {
  data: AppData;
  settings: AppSettings;
  /** Where a new take is filed: the folder the library is showing. */
  folderId: string | null;
  onSave: (recording: Recording, blob: Blob) => Promise<void>;
  onNotice: (message: string) => void;
  onOpenSettings: () => void;
};

const BANDS = 32;

export function RecordScreen({
  data,
  settings,
  folderId,
  onSave,
  onNotice,
  onOpenSettings,
}: Props) {
  const t = useT();
  const recorder = useRecorder(
    useMemo(
      () => ({
        mode:
          settings.recordingKind === "lossless"
            ? ("pcm" as const)
            : ("encoded" as const),
        bitsPerSecond: settings.recordingBitrate * 1000,
        processing: settings.voiceProcessing,
        bands: BANDS,
      }),
      [
        settings.recordingKind,
        settings.recordingBitrate,
        settings.voiceProcessing,
      ],
    ),
  );
  const [take, setTake] = useState<CaptureResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [clipped, setClipped] = useState(false);

  // The take's shape so far, a few times a second, and whether it has
  // clipped at all — the hint under the meter stays once it has.
  useEffect(() => {
    let last = 0;
    return recorder.subscribe((frame: CaptureFrame) => {
      if (frame.meter.clipCount > 0) setClipped(true);
      const now = performance.now();
      if (now - last > 250) {
        last = now;
        setPeaks(frame.peaks.slice());
      }
    });
  }, [recorder]);

  const ticks = useMemo(() => bandTicks(layoutBands(BANDS, 2048, 48000)), []);

  const start = useCallback(async () => {
    setPeaks([]);
    setClipped(false);
    try {
      await recorder.start();
    } catch {
      // `recorder.error` says which; the screen prints it.
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    const result = await recorder.stop();
    if (result) setTake(result);
  }, [recorder]);

  const titles = useMemo(
    () => liveRecordings(data).map((r) => r.title),
    [data],
  );
  const suggested = useMemo(
    () => defaultTitle(t("record.newRecording"), titles),
    [t, titles],
  );

  const save = useCallback(
    async (title: string, folder: string | null) => {
      if (!take) return;
      setSaving(true);
      try {
        const { recording, blob } = finishTake(take, {
          title: title.trim() || suggested,
          folderId: folder,
          ctx: liveCtx(),
          flacLevel: settings.exportFlacLevel,
        });
        await onSave(recording, blob);
        onNotice(t("record.saved", { title: recording.title }));
        setTake(null);
        setPeaks([]);
      } catch (err) {
        onNotice(
          t("record.failed", {
            reason: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        setSaving(false);
      }
    },
    [take, suggested, settings.exportFlacLevel, onSave, onNotice, t],
  );

  const state = recorder.state;
  const live = state === "recording" || state === "paused";
  const statusLine =
    state === "starting"
      ? t("record.starting")
      : state === "recording"
        ? t("record.recording")
        : state === "paused"
          ? t("record.paused")
          : saving
            ? t("record.saving")
            : t("record.ready");

  const errorLine =
    recorder.error === "denied"
      ? t("record.denied")
      : recorder.error === "unavailable"
        ? t("record.unavailable")
        : recorder.error === "failed"
          ? t("record.failed", { reason: "" })
          : null;

  return (
    <div className="app-record flex min-h-full flex-1 flex-col gap-4 px-4 py-4">
      {/* The timer. Tenths tick while recording so the screen is seen to be
          counting; a paused take holds its figure. */}
      <div className="flex flex-col items-center gap-1 pt-4">
        <div
          className={`font-mono text-5xl font-light tabular-nums tracking-tight ${
            state === "recording" ? "text-fg-bright" : "text-fg"
          }`}
          aria-live="off"
        >
          {formatTimer(recorder.elapsedMs)}
        </div>
        <div
          className="flex items-center gap-2 text-sm text-muted"
          role="status"
          aria-live="polite"
        >
          {state === "recording" && (
            <span
              aria-hidden
              className="app-rec-dot inline-block h-2.5 w-2.5 rounded-full bg-danger"
            />
          )}
          {statusLine}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
        <LevelMeter
          subscribe={recorder.subscribe}
          labels={{
            meter: t("record.level"),
            clip: t("record.clip"),
            clipping: t("record.clipping"),
          }}
        />
        <p className={`text-xs ${clipped ? "text-danger" : "text-muted"}`}>
          {clipped ? t("record.clippedHint") : t("record.aim")}
        </p>
        {settings.showSpectrum && (
          <SpectrumBars
            subscribe={recorder.subscribe}
            ticks={ticks}
            label={t("record.spectrum")}
            className="h-28"
          />
        )}
      </div>

      {/* The take's shape so far: the thumbnail the list will show, growing
          as the take does. */}
      <div className="h-14 rounded-md bg-surface-2 px-2 py-1">
        <Waveform peaks={peaks} />
      </div>

      {errorLine && (
        <p
          role="alert"
          className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-fg"
        >
          {errorLine}
        </p>
      )}

      <div className="flex-1" />

      {/* The one button, and its two neighbours while a take is running. */}
      <div className="flex items-center justify-center gap-6 pb-2">
        {live && (
          <Button
            variant="secondary"
            className="h-12 w-12 rounded-full p-0"
            aria-label={
              state === "paused" ? t("record.resume") : t("record.pause")
            }
            onClick={() =>
              state === "paused" ? recorder.resume() : recorder.pause()
            }
          >
            {state === "paused" ? (
              <PlayIcon className="h-5 w-5" />
            ) : (
              <PauseIcon className="h-5 w-5" />
            )}
          </Button>
        )}
        <button
          type="button"
          className={`app-record-button flex h-20 w-20 items-center justify-center rounded-full ring-4 ring-line ring-offset-2 ring-offset-page transition-transform active:scale-95 ${
            live ? "bg-danger" : "bg-danger"
          }`}
          aria-label={live ? t("record.stop") : t("record.start")}
          disabled={state === "starting" || state === "stopping" || saving}
          onClick={() => void (live ? stop() : start())}
        >
          {live ? (
            <StopIcon className="h-9 w-9 text-fg-bright" />
          ) : (
            <span
              aria-hidden
              className="block h-9 w-9 rounded-full bg-fg-bright/90"
            />
          )}
        </button>
        {live && (
          <Button
            variant="secondary"
            className="h-12 w-12 rounded-full p-0"
            aria-label={t("record.discard")}
            onClick={() => setConfirmDiscard(true)}
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="mx-auto rounded-full border border-line px-3 py-1 text-xs text-muted hover:bg-surface-2"
      >
        {t(`record.kind.${settings.recordingKind}`)} ·{" "}
        {settings.recordingKind === "compact"
          ? t("record.kindHint.compact", {
              bitrate: String(settings.recordingBitrate),
            })
          : t("record.kindHint.lossless")}
      </button>

      <ConfirmDialog
        open={confirmDiscard}
        title={t("record.discardConfirm")}
        description={t("record.discardHint")}
        confirmLabel={t("record.discard")}
        tone="danger"
        labels={{ cancel: t("common.cancel"), close: t("common.close") }}
        onConfirm={async () => {
          setConfirmDiscard(false);
          await recorder.cancel();
          setPeaks([]);
          onNotice(t("record.discarded"));
        }}
        onCancel={() => setConfirmDiscard(false)}
      />

      {take && (
        <NameSheet
          data={data}
          take={take}
          suggested={suggested}
          folderId={folderId}
          saving={saving}
          onSave={save}
          onDiscard={() => {
            setTake(null);
            setPeaks([]);
            onNotice(t("record.discarded"));
          }}
        />
      )}
    </div>
  );
}

function NameSheet({
  data,
  take,
  suggested,
  folderId,
  saving,
  onSave,
  onDiscard,
}: {
  data: AppData;
  take: CaptureResult;
  suggested: string;
  folderId: string | null;
  saving: boolean;
  onSave: (title: string, folderId: string | null) => Promise<void>;
  onDiscard: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(suggested);
  const [folder, setFolder] = useState<string | null>(folderId);
  const input = useRef<HTMLInputElement>(null);
  const folders = useMemo(() => folderTree(data), [data]);
  const options = useMemo(
    () => [
      { value: "", label: t("record.noFolder") },
      ...folders.map(({ folder: f, depth }) => ({
        value: f.id,
        label: `${"  ".repeat(depth)}${f.name}`,
      })),
    ],
    [folders, t],
  );

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return (
    <Modal
      open
      onClose={onDiscard}
      labelledBy="take-title"
      initialFocusRef={input}
      closeLabel={t("common.close")}
    >
      <ModalHeader
        titleId="take-title"
        title={t("record.nameTitle")}
        onCancel={onDiscard}
        onSave={() => void onSave(title, folder)}
        saveDisabled={saving}
      />
      <div className="flex flex-col gap-4 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-fg">
            {t("record.name")}
          </span>
          <input
            ref={input}
            type="text"
            value={title}
            maxLength={200}
            onInput={(e) => setTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSave(title, folder);
            }}
            className="w-full rounded-md border border-line bg-surface-2 px-2 py-2 text-fg outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-fg">
            {t("record.folder")}
          </span>
          <SelectPicker<string>
            value={folder ?? ""}
            options={options}
            onChange={(next) => setFolder(next || null)}
            ariaLabel={t("record.folder")}
          />
        </div>
        <p className="text-xs text-muted">
          {t("record.length")}: {formatTimer(take.durationMs)}
          {take.clipCount > 0
            ? ` · ${t("record.clip")} ×${take.clipCount}`
            : ""}
        </p>
        <Button variant="danger" onClick={onDiscard} disabled={saving}>
          {t("record.discard")}
        </Button>
      </div>
    </Modal>
  );
}
