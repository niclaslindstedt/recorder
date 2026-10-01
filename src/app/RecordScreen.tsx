// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  bandTicks,
  layoutBands,
  useRecorder,
  type CaptureFrame,
  type CaptureResult,
} from "@niclaslindstedt/oss-framework/audio";
import {
  ConfirmDialog,
  FolderIcon,
  PauseIcon,
  PlayIcon,
  SlidersIcon,
  StopIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import { FolderPicker } from "./FolderPicker.tsx";
import { folderPath } from "./folders.ts";
import {
  formatDuration,
  formatSize,
  formatSpan,
  formatTimer,
} from "./format.ts";
import { presetOf } from "./eq.ts";
import { EqSheet } from "./EqSheet.tsx";
import { EqLine } from "./EqParts.tsx";
import { ClipIcon, TriggerIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { liveCtx } from "./ids.ts";
import { paced } from "./pacing.ts";
import { bytesPerSecond, presetFor, recordingTimeLeft } from "./quality.ts";
import { QualitySheet } from "./QualitySheet.tsx";
import {
  AmbientReadout,
  ChoiceButton,
  HeadphonesCheck,
  ListenCard,
  MonitorGlyph,
  RoundGlyph,
  TakeReview,
  TakeStats,
  useFreeBytes,
} from "./RecordParts.tsx";
import { defaultTitle, finishTake, gateCapture } from "./takes.ts";
import { formatTargetDb, targetRange } from "./target.ts";
import { liveRecordings, type AppData, type Recording } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";
import type { DocStore } from "./useDocStore.ts";
import { useListen } from "./useListen.ts";
import { useMonitor } from "./useMonitor.ts";
import { useStand } from "./useShape.ts";
import { TriggerSheet } from "./TriggerSheet.tsx";
import { useGateLive } from "./useGateLive.ts";
import { Visualizer } from "./Visualizer.tsx";
import { BigMeter } from "./BigMeter.tsx";

// The Record screen, an instrument in four modes (docs/design.md, "Record"):
//
// - Ready: the microphone is closed. The take's two choices (quality and
//   where it goes) as buttons at the top, the invitation to listen, and the
//   one button centred in the room left. What was recorded is the
//   Recordings screen's, not this one's.
// - Listening: the microphone is open and nothing is kept. The visualizer,
//   the big meter, the room's noise floor, the peak, the headroom and a
//   verdict in words — the mode for setting a level before a take.
// - Recording: the timer, the visualizer with the whole take along its
//   foot, the big meter with its clip lamp, and the take's four figures;
//   Pause, Stop and Discard, all glyphs. With the sound trigger on, the
//   line under the timer says whether it is hearing sound or waiting, and
//   how much it has kept.
// - Review: the take is in memory, getting its name and its place, and can
//   be heard back. Save is the big button; Discard is a glyph and asks first.
//
// Nothing is written until Save — a discarded take was never anywhere.

type Props = {
  data: AppData;
  store: DocStore;
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  /** The folder the library is showing: where a take is filed unless the
   *  reader picks another. */
  folderId: string | null;
  locale: string;
  onSave: (recording: Recording, blob: Blob) => Promise<void>;
  onNotice: (message: string) => void;
  /** A take is running or waiting to be named: the shell keeps the reader
   *  here until it is saved or discarded. */
  onCaptureChange: (capturing: boolean) => void;
};

/** Bars in the spectrum, rows in the spectrogram. */
const BANDS = 48;

export function RecordScreen({
  data,
  store,
  settings,
  update,
  folderId,
  locale,
  onSave,
  onNotice,
  onCaptureChange,
}: Props) {
  const t = useT();
  // A take with the sound trigger on is captured as samples whatever its
  // kind: the stretches worth keeping are cut from them at Stop
  // (`gateCapture`), and the browser's encoder cannot be handed them back.
  const recorder = useRecorder(
    useMemo(
      () => ({
        mode:
          settings.recordingKind === "lossless" || settings.gate
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
        settings.gate,
      ],
    ),
  );
  // Where the peaks should land: the waveform's band, the meter's colour and
  // Listening's verdict all read it.
  const { levelTarget, targetLowDb, targetHighDb } = settings;
  const target = useMemo(
    () =>
      targetRange(levelTarget, { lowDb: targetLowDb, highDb: targetHighDb }),
    [levelTarget, targetLowDb, targetHighDb],
  );
  const listen = useListen(settings.voiceProcessing, BANDS, target);
  const [take, setTake] = useState<CaptureResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [clipped, setClipped] = useState(false);
  const [sheet, setSheet] = useState<
    "quality" | "eq" | "trigger" | "destination" | null
  >(null);
  // Stopped, and the trigger's stretches being cut out and encoded: still
  // the take's, so the shell keeps the reader here.
  const [finishing, setFinishing] = useState(false);

  // The monitor: the microphone through the EQ new takes start with, into
  // headphones — from the headphones glyph, while Listening and Recording
  // and in the EQ sheet's title row. One monitor, whichever switched it on,
  // so it is lit wherever the glyph is drawn; flat
  // while the sheet's Compare is held. It runs beside the capture, never
  // in it: nothing it plays is kept.
  const [eqBypassed, setEqBypassed] = useState(false);
  const monitor = useMonitor(
    eqBypassed ? null : settings.recordEq,
    settings.voiceProcessing,
  );
  // On speakers it howls, and a howl while recording is in the take: the
  // glyph asks once whether headphones are on.
  const headphonesOn = useRef(false);
  const [askHeadphones, setAskHeadphones] = useState(false);
  const toggleMonitor = () => {
    if (monitor.state === "on" || monitor.state === "starting") monitor.stop();
    else if (headphonesOn.current) monitor.start();
    else setAskHeadphones(true);
  };
  const closeEq = () => {
    setEqBypassed(false);
    setSheet(null);
  };

  // Where the take goes: the library's folder, until the reader says
  // otherwise. A folder deleted meanwhile is no folder.
  const [destination, setDestination] = useState<string | null>(folderId);
  useEffect(() => setDestination(folderId), [folderId]);
  const destinationLive =
    destination &&
    data.folders[destination] &&
    !data.folders[destination]!.deletedAt
      ? destination
      : null;

  // Whether the take has clipped at all — the warning under the meter
  // stays once it has.
  useEffect(
    () =>
      recorder.subscribe((frame: CaptureFrame) => {
        if (frame.meter.clipCount > 0) setClipped(true);
      }),
    [recorder],
  );

  // What the meter and the picture draw from: the capture's frames, paced
  // so every display frame shows something new (`pacing.ts`).
  const recordFrames = useMemo(
    () => paced(recorder.subscribe),
    [recorder.subscribe],
  );
  const listenFrames = useMemo(
    () => paced(listen.subscribe),
    [listen.subscribe],
  );

  const ticks = useMemo(() => bandTicks(layoutBands(BANDS, 2048, 48000)), []);

  const state = recorder.state;
  const live = state === "recording" || state === "paused";
  const capturing =
    live ||
    state === "starting" ||
    state === "stopping" ||
    finishing ||
    take !== null;
  useEffect(() => onCaptureChange(capturing), [capturing, onCaptureChange]);
  const freeBytes = useFreeBytes(live);
  useEffect(() => () => onCaptureChange(false), [onCaptureChange]);

  // Listening handing the microphone to a take: the monitor keeps running
  // across the gap.
  const [handingOver, setHandingOver] = useState(false);
  const start = useCallback(async () => {
    setClipped(false);
    setHandingOver(true);
    try {
      // Listening hands the microphone over: the level is already set.
      if (listen.on) await listen.stop();
      await recorder.start();
    } catch {
      // `recorder.error` says which; the screen prints it.
    } finally {
      setHandingOver(false);
    }
  }, [recorder, listen]);

  // The monitor runs only beside an open microphone — Listening, a take
  // running or paused — or in the EQ sheet. Stop, Discard, Review and
  // leaving Listening close it.
  const monitorWanted =
    listen.on || live || state === "starting" || handingOver || sheet === "eq";
  const { state: monitorState, stop: stopMonitor } = monitor;
  useEffect(() => {
    if (monitorWanted) return;
    setAskHeadphones(false);
    if (monitorState !== "off") stopMonitor();
  }, [monitorWanted, monitorState, stopMonitor]);

  // A monitor that could not open, or stopped itself on hearing feedback,
  // says so, wherever its glyph was pressed.
  const lastMonitorState = useRef(monitorState);
  useEffect(() => {
    const was = lastMonitorState.current;
    lastMonitorState.current = monitorState;
    if (was === monitorState) return;
    if (monitorState === "denied") onNotice(t("eq.monitor.denied"));
    if (monitorState === "failed") onNotice(t("eq.monitor.failed"));
    if (monitorState === "feedback") onNotice(t("eq.monitor.feedback"));
  }, [monitorState, onNotice, t]);
  const monitorGlyph = (
    <MonitorGlyph state={monitorState} onToggle={toggleMonitor} />
  );

  // The sound trigger, as the take is gated by it and as the screen shows
  // it while the take runs.
  const { gate, gateDb, gatePreMs, gateHoldMs, gateQuiet } = settings;
  const trigger = useMemo(
    () => ({
      thresholdDb: gateDb,
      preMs: gatePreMs,
      holdMs: gateHoldMs,
      quiet: gateQuiet,
    }),
    [gateDb, gatePreMs, gateHoldMs, gateQuiet],
  );
  const gateLive = useGateLive(recorder.subscribe, gate && live, trigger);

  const stop = useCallback(async () => {
    const result = await recorder.stop();
    if (!result) return;
    if (!gate) {
      setTake(result);
      return;
    }
    setFinishing(true);
    try {
      // Let "Keeping the sound…" paint before the encoder takes the thread.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const kept = await gateCapture(result, trigger, {
        kind: settings.recordingKind,
        bitrate: settings.recordingBitrate,
      });
      if (kept) setTake(kept);
      else onNotice(t("trigger.nothing"));
    } catch (err) {
      onNotice(
        t("record.failed", {
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      setFinishing(false);
    }
  }, [
    recorder,
    gate,
    trigger,
    settings.recordingKind,
    settings.recordingBitrate,
    onNotice,
    t,
  ]);

  const titles = useMemo(
    () => liveRecordings(data).map((r) => r.title),
    [data],
  );
  const suggested = useMemo(
    () => defaultTitle(t("record.newRecording"), titles),
    [t, titles],
  );

  const save = useCallback(
    async (title: string) => {
      if (!take) return;
      setSaving(true);
      try {
        const { recording, blob } = finishTake(take, {
          title: title.trim() || suggested,
          folderId: destinationLive,
          ctx: liveCtx(),
          flacLevel: settings.exportFlacLevel,
          eq: settings.recordEq,
        });
        await onSave(recording, blob);
        onNotice(t("record.saved", { title: recording.title }));
        setTake(null);
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
    [
      take,
      suggested,
      destinationLive,
      settings.exportFlacLevel,
      settings.recordEq,
      onSave,
      onNotice,
      t,
    ],
  );

  const discard = useCallback(async () => {
    setConfirmDiscard(false);
    if (take) setTake(null);
    else await recorder.cancel();
    onNotice(t("record.discarded"));
  }, [take, recorder, onNotice, t]);

  const error = recorder.error ?? listen.error;
  const errorLine =
    error === "denied"
      ? t("record.denied")
      : error === "unavailable"
        ? t("record.unavailable")
        : error === "failed"
          ? t("record.failed", { reason: "" })
          : null;

  // The two choices, as the buttons say them.
  const preset = presetFor(settings);
  const qualityName =
    settings.recordingKind === "lossless"
      ? t("quality.preset.lossless")
      : preset
        ? t(`quality.preset.${preset}`)
        : t("quality.custom");
  const qualityDetail =
    settings.recordingKind === "lossless"
      ? t("quality.flac")
      : t("export.kbps", { kbps: String(settings.recordingBitrate) });
  const qualityValue = `${qualityName} · ${qualityDetail}`;
  const destinationValue = destinationLive
    ? folderPath(data, destinationLive)
        .map((f) => f.name)
        .join(" › ")
    : t("record.noFolder");

  const qualityButton = (slim = false) => (
    <ChoiceButton
      slim={slim}
      icon={<SlidersIcon className="h-5 w-5" />}
      caption={t("quality.title")}
      detail={qualityDetail}
      value={qualityName}
      onClick={() => setSheet("quality")}
    />
  );
  // The EQ's own curve stands where a glyph would, so the button shows
  // what new takes will sound like and not only what it is called; the low
  // cut, a switch of its own, is said beside the caption.
  const eqPreset = presetOf(settings.recordEq);
  const eqButton = (slim = false) => (
    <ChoiceButton
      slim={slim}
      icon={<EqLine eq={settings.recordEq} className="h-7 w-11" />}
      caption={t("eq.caption")}
      detail={settings.recordEq?.lowCut ? t("eq.lowCut") : undefined}
      value={eqPreset ? t(`eq.preset.${eqPreset}`) : t("eq.custom")}
      onClick={() => setSheet("eq")}
    />
  );
  // When a take records: always, or only on sound — and then what becomes
  // of the quiet, with the level and the hold on the caption's line.
  const triggerButton = (slim = false) => (
    <ChoiceButton
      slim={slim}
      icon={<TriggerIcon className="h-5 w-5" />}
      caption={t("trigger.caption")}
      detail={
        gate
          ? t("trigger.detail", {
              db: formatTargetDb(gateDb),
              hold: t("trigger.seconds", { n: String(gateHoldMs / 1000) }),
            })
          : undefined
      }
      value={
        !gate
          ? t("trigger.off")
          : gateQuiet === "cut"
            ? t("trigger.onCut")
            : t("trigger.onSilence")
      }
      onClick={() => setSheet("trigger")}
    />
  );
  const destinationButton = (slim = false) => (
    <ChoiceButton
      slim={slim}
      icon={<FolderIcon className="h-5 w-5" />}
      caption={t("record.saveTo")}
      value={destinationValue}
      onClick={() => setSheet("destination")}
    />
  );

  // Upright, one column; a phone on its side (`useStand`, 956×440 and the
  // like) is far too short to stack it, so the instrument stands on the left
  // and a rail of controls on the right (docs/design.md, "On its side").
  const stand = useStand();
  const split = (stage: ReactNode, rail: ReactNode) => (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">{stage}</div>
      <div className="flex w-64 shrink-0 flex-col justify-center gap-3">
        {rail}
      </div>
    </div>
  );
  const bigButton = stand ? "h-20 w-20" : "h-24 w-24";

  const recordButton = (
    <div className="flex items-center justify-center pb-2">
      <button
        type="button"
        className={`app-record-button flex ${bigButton} items-center justify-center rounded-full bg-danger ring-4 ring-line ring-offset-2 ring-offset-page transition-transform active:scale-95`}
        aria-label={t("record.start")}
        disabled={state !== "idle" || saving}
        onClick={() => void start()}
      >
        <span
          aria-hidden
          className={`block rounded-full bg-fg-bright/90 ${stand ? "h-8 w-8" : "h-10 w-10"}`}
        />
      </button>
    </div>
  );

  const meter = (subscribe: typeof recorder.subscribe) => (
    <BigMeter
      subscribe={subscribe}
      target={target}
      targetLabel={{
        caption: t("target.onMeter"),
        value: t("target.named", {
          name: t(`target.preset.${settings.levelTarget}`),
          range: t("target.range", {
            low: formatTargetDb(target.lowDb),
            high: formatTargetDb(target.highDb),
          }),
        }),
      }}
      labels={{
        meter: t("record.level"),
        clip: t("record.clip"),
        clipping: t("record.clipping"),
      }}
      trigger={
        gate
          ? {
              db: gateDb,
              caption: t("trigger.onMeter"),
              value: t("target.value", { db: formatTargetDb(gateDb) }),
            }
          : undefined
      }
    />
  );
  const visualizerSize = stand ? "min-h-32 flex-1" : "min-h-44 flex-1";

  let body;
  if (take) {
    body = (
      <TakeReview
        take={take}
        suggested={suggested}
        saving={saving}
        eq={settings.recordEq}
        beside={stand}
        destination={destinationButton()}
        onSave={(title) => void save(title)}
        onDiscard={() => setConfirmDiscard(true)}
      />
    );
  } else if (capturing) {
    // The timer is the headline; tenths tick so the screen is seen to be
    // counting. Under it, what this take is — read-only now.
    const timer = (
      <div className="flex flex-col items-center gap-1">
        <div
          className={`flex items-center gap-3 font-figures font-light tracking-tight text-fg-bright tabular-nums ${
            stand ? "text-5xl" : "text-6xl"
          }`}
          aria-live="off"
        >
          <span
            aria-hidden
            className={`inline-block h-4 w-4 rounded-full ${
              state !== "recording"
                ? "bg-muted"
                : !gate || gateLive.open
                  ? "app-rec-dot bg-danger"
                  : "border-2 border-danger"
            }`}
          />
          {formatTimer(recorder.elapsedMs)}
        </div>
        {/* The monitor at the end of the line, not in a corner: a long
            take's timer needs the width. Upright, a spacer of its size on
            the other end keeps the line centred. */}
        <div className="flex max-w-full items-center gap-2">
          {!stand && <span aria-hidden className="w-11 shrink-0" />}
          <div
            className="min-w-0 truncate text-sm text-muted"
            role="status"
            aria-live="polite"
          >
            {finishing
              ? t("trigger.finishing")
              : state === "starting"
                ? t("record.starting")
                : state === "paused"
                  ? t("record.paused")
                  : state === "stopping"
                    ? t("record.saving")
                    : gate
                      ? `${gateLive.open ? t("trigger.hearing") : t("trigger.waiting")} · ${t(
                          "trigger.kept",
                          { time: formatDuration(gateLive.keptMs) },
                        )}`
                      : t("record.recordingTo", {
                          quality: qualityValue,
                          folder: destinationValue,
                        })}
          </div>
          {monitorGlyph}
        </div>
      </div>
    );
    // The big picture takes the room: the last seconds scrolling by (or the
    // spectrum, or the spectrogram), and the whole take along its foot.
    const picture = (
      <Visualizer
        kind={settings.visualizer}
        onKind={(next) => update("visualizer", next)}
        subscribe={recordFrames}
        running={state === "recording"}
        ticks={ticks}
        bands={BANDS}
        target={target}
        overview
        className={visualizerSize}
      />
    );
    const warning = clipped && (
      <p className="-mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
        <ClipIcon className="h-4 w-4 shrink-0" />
        {t("record.clippedHint")}
      </p>
    );
    const ms = recordingTimeLeft(
      freeBytes,
      settings.recordingKind,
      settings.recordingBitrate,
    );
    const stats = (
      <TakeStats
        columns={stand ? 2 : 4}
        maxPeakDb={recorder.meter.maxPeakDb}
        clipCount={recorder.meter.clipCount}
        size={formatSize(
          (bytesPerSecond(settings.recordingKind, settings.recordingBitrate) *
            // What the file will hold: with the trigger on, what it kept —
            // or, kept as silence, the whole length at a compact take's
            // constant bitrate (FLAC makes next to nothing of silence).
            (gate &&
            !(gateQuiet === "silence" && settings.recordingKind === "compact")
              ? gateLive.keptMs
              : recorder.elapsedMs)) /
            1000,
          locale,
        )}
        left={
          ms === null
            ? null
            : formatSpan(ms, {
                hours: t("common.hours"),
                minutes: t("common.minutes"),
              })
        }
      />
    );
    // Pause · Stop · Discard. Stop sits where Record was, so the thumb does
    // not move; Discard is a glyph, and asks.
    const controls = (
      <div
        className={`flex items-center justify-center pb-2 ${stand ? "gap-5" : "gap-10"}`}
      >
        <RoundGlyph
          label={state === "paused" ? t("record.resume") : t("record.pause")}
          disabled={!live}
          onClick={() =>
            state === "paused" ? recorder.resume() : recorder.pause()
          }
        >
          {state === "paused" ? (
            <PlayIcon className="h-6 w-6" />
          ) : (
            <PauseIcon className="h-6 w-6" />
          )}
        </RoundGlyph>
        <button
          type="button"
          className={`app-record-button flex ${bigButton} items-center justify-center rounded-full bg-danger ring-4 ring-line ring-offset-2 ring-offset-page transition-transform active:scale-95`}
          aria-label={t("record.stop")}
          disabled={!live}
          onClick={() => void stop()}
        >
          <StopIcon
            className={`text-fg-bright ${stand ? "h-8 w-8" : "h-10 w-10"}`}
          />
        </button>
        <RoundGlyph
          label={t("record.discard")}
          tone="danger"
          disabled={!live}
          onClick={() => setConfirmDiscard(true)}
        >
          <TrashIcon className="h-6 w-6" />
        </RoundGlyph>
      </div>
    );
    body = stand ? (
      split(
        <>
          {picture}
          {meter(recordFrames)}
          {warning}
        </>,
        <>
          {timer}
          {stats}
          {controls}
        </>,
      )
    ) : (
      <>
        {timer}
        {picture}
        {meter(recordFrames)}
        {warning}
        {stats}
        {controls}
      </>
    );
  } else if (listen.on) {
    const status = (
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="app-rec-dot inline-block h-2.5 w-2.5 rounded-full bg-accent"
        />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold text-fg-bright">
            {t("listen.title")}
          </span>{" "}
          <span className="text-muted">{t("listen.nothingKept")}</span>
        </p>
        {monitorGlyph}
        <RoundGlyph
          size="sm"
          label={t("listen.stop")}
          onClick={() => void listen.stop()}
        >
          <StopIcon className="h-5 w-5" />
        </RoundGlyph>
      </div>
    );
    const picture = (
      <Visualizer
        kind={settings.visualizer}
        onKind={(next) => update("visualizer", next)}
        subscribe={listenFrames}
        running
        ticks={ticks}
        bands={BANDS}
        target={target}
        className={visualizerSize}
      />
    );
    body = stand ? (
      split(
        <>
          {status}
          {picture}
          {meter(listenFrames)}
        </>,
        <>
          <AmbientReadout ambient={listen.ambient} />
          {recordButton}
        </>,
      )
    ) : (
      <>
        {status}
        {picture}
        {meter(listenFrames)}
        <AmbientReadout ambient={listen.ambient} />
        {/* Still changeable, no longer the subject — and on a small phone
            left to Ready, so the button stays in reach. */}
        <div className="hidden grid-cols-2 gap-2 tall:grid">
          {qualityButton(true)}
          {eqButton(true)}
          <div className="col-span-2 flex flex-col">{triggerButton(true)}</div>
          <div className="col-span-2 flex flex-col">
            {destinationButton(true)}
          </div>
        </div>
        {recordButton}
      </>
    );
  } else {
    // The take's choices, decided before it and never during: how it
    // sounds side by side — its quality and its EQ — then when it records,
    // and where it goes, each the whole width: the trigger's value and a
    // folder's path are long.
    const choices = (
      <div className="grid grid-cols-2 gap-2">
        {qualityButton()}
        {eqButton()}
        <div className="col-span-2 flex flex-col">{triggerButton()}</div>
        <div className="col-span-2 flex flex-col">{destinationButton()}</div>
      </div>
    );
    const listenCard = (
      <ListenCard
        compact={stand}
        busy={listen.starting}
        onListen={() => void listen.start()}
      />
    );
    // The rest of the room is the button's: centred in it, large, with the
    // one word it needs.
    const go = (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2">
        {recordButton}
        <span className="text-sm text-muted">{t("record.tapToRecord")}</span>
      </div>
    );
    body = stand ? (
      split(
        <>
          {choices}
          {listenCard}
        </>,
        go,
      )
    ) : (
      <>
        {choices}
        {listenCard}
        {go}
      </>
    );
  }

  return (
    <div
      className={`app-record flex min-h-full flex-1 flex-col gap-4 px-4 ${stand ? "py-3" : "py-4"}`}
    >
      {body}

      {errorLine && (
        <p
          role="alert"
          className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-fg"
        >
          {errorLine}
        </p>
      )}

      {sheet === "quality" && (
        <QualitySheet
          settings={settings}
          update={update}
          locale={locale}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "trigger" && (
        <TriggerSheet
          settings={settings}
          update={update}
          roomDb={listen.on ? (listen.ambient?.roomDb ?? null) : null}
          meter={listen.on ? meter(listenFrames) : undefined}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "eq" && (
        <EqSheet
          eq={settings.recordEq}
          onChange={(next) => update("recordEq", next)}
          bypassed={eqBypassed}
          onBypass={setEqBypassed}
          analyser={monitor.analyser}
          note={t("eq.forRecord")}
          action={monitorGlyph}
          onClose={closeEq}
        />
      )}
      {sheet === "destination" && (
        <FolderPicker
          mode="choose"
          data={data}
          store={store}
          title={t("record.saveTo")}
          noneLabel={t("record.noFolder")}
          value={destinationLive}
          onChoose={(next) => {
            setDestination(next);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      <HeadphonesCheck
        open={askHeadphones}
        onMonitor={() => {
          setAskHeadphones(false);
          headphonesOn.current = true;
          monitor.start();
        }}
        onCancel={() => setAskHeadphones(false)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title={t("record.discardConfirm")}
        description={t("record.discardHint")}
        confirmLabel={t("record.discard")}
        tone="danger"
        labels={{ cancel: t("common.cancel"), close: t("common.close") }}
        onConfirm={() => void discard()}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
