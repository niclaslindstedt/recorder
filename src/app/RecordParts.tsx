// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  MIME_WAV,
  Waveform,
  encodeWav,
  formatDb,
  type CaptureResult,
} from "@niclaslindstedt/oss-framework/audio";
import {
  AlertTriangleIcon,
  Button,
  CheckIcon,
  Modal,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";

import { formatDuration } from "./format.ts";
import { Chip, RoundGlyph } from "./Glyphs.tsx";
import { ClipIcon, HeadphonesIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { SheetTitle } from "./ModalHeader.tsx";
import type { Eq } from "./eq.ts";
import type { Ambient, Verdict } from "./levels.ts";
import { useRouting } from "./useAudioRouting.ts";
import { useEqPlayer } from "./useEqPlayer.ts";
import type { MonitorState } from "./useMonitor.ts";

// The pieces the Record screen's four modes are built from
// (docs/design.md, "Record"). The screen itself (`RecordScreen.tsx`) owns
// the state; these only draw.

/** Listening's three numbers — the room, the peak, the headroom — and the
 *  verdict in words. Colour is never the only signal: the verdict is a
 *  sentence, and the clip warning keeps its glyph. */
export function AmbientReadout({ ambient }: { ambient: Ambient | null }) {
  const t = useT();
  const cell = (label: string, value: string) => (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-surface-2 px-2 py-2">
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      <span className="font-figures text-base text-fg-bright tabular-nums">
        {value}
      </span>
    </div>
  );
  const verdict: Verdict = ambient?.verdict ?? "silent";
  const tone =
    verdict === "good"
      ? "text-accent"
      : verdict === "hot" || verdict === "clipping"
        ? "text-danger"
        : verdict === "loud"
          ? "text-flag"
          : "text-muted";
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {cell(
          t("listen.room"),
          ambient ? `${formatDb(ambient.roomDb)} dB` : "—",
        )}
        {cell(
          t("listen.peak"),
          ambient ? `${formatDb(ambient.peakDb)} dB` : "—",
        )}
        {cell(
          t("listen.headroom"),
          ambient ? `${ambient.headroomDb.toFixed(1)} dB` : "—",
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`flex items-center justify-center gap-1.5 text-center text-sm font-medium ${tone}`}
      >
        {verdict === "good" ? (
          <CheckIcon className="h-4 w-4 shrink-0" />
        ) : verdict === "clipping" ? (
          <ClipIcon className="h-4 w-4 shrink-0" />
        ) : verdict !== "silent" && verdict !== "quiet" ? (
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
        ) : null}
        {t(`listen.verdict.${verdict}`)}
      </p>
    </div>
  );
}

/** The monitor as a glyph, for Listening and Recording: the microphone
 *  through the take's EQ, into headphones. Lit while it runs, red once the
 *  feedback guard has stopped it; a press switches it. Its name says what a
 *  press will do. */
export function MonitorGlyph({
  state,
  onToggle,
  caption,
  size = "sm",
}: {
  state: MonitorState;
  onToggle: () => void;
  /** The word under it, in an action row. */
  caption?: string;
  size?: "sm" | "md";
}) {
  const t = useT();
  const on = state === "on" || state === "starting";
  // Stopped by the feedback guard or refused: off, in the danger colour,
  // until it is pressed again — the notice says why in words.
  const trouble =
    state === "feedback" || state === "denied" || state === "failed";
  const label = on ? t("eq.monitor.toggleOff") : t("eq.monitor.toggle");
  return (
    <RoundGlyph
      label={label}
      onClick={onToggle}
      pressed={on}
      tone={trouble ? "danger" : "plain"}
      size={size}
      caption={caption}
    >
      <HeadphonesIcon
        className={`${size === "sm" ? "h-5 w-5" : "h-6 w-6"} ${state === "starting" ? "animate-pulse" : ""}`}
      />
    </RoundGlyph>
  );
}

/** Asked before the glyph first starts the monitor: on speakers it howls,
 *  and while recording the howl is in the take. Monitor starts it inside
 *  the press itself — a browser lets sound start only there — which is why
 *  this is not the framework's `ConfirmDialog`, whose confirm lands a
 *  couple of frames later. */
export function HeadphonesCheck({
  open,
  onMonitor,
  onCancel,
}: {
  open: boolean;
  onMonitor: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="headphones-title"
      role="alertdialog"
      centered
      closeLabel={t("common.close")}
    >
      <SheetTitle
        titleId="headphones-title"
        title={t("eq.monitor.confirmTitle")}
        onClose={onCancel}
      />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <HeadphonesIcon className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
          <p className="text-sm text-fg">{t("eq.monitor.confirmHint")}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={onMonitor}
            className="flex items-center gap-1.5"
          >
            <HeadphonesIcon className="h-4 w-4" />
            {t("eq.monitor.start")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Review: the take is in memory and gets its name and its place. The
 *  title comes focused and selected, so typing replaces it and Enter saves.
 *  The take can be heard before it is kept — its shape is the playhead's
 *  track — because "did I get it?" is the question this moment is for.
 *  Save is the widest button on the screen, Discard a glyph beside it. */
export function TakeReview({
  take,
  suggested,
  destination,
  saving,
  eq,
  beside = false,
  onSave,
  onDiscard,
}: {
  take: CaptureResult;
  suggested: string;
  /** A phone on its side: the take on the left, where it goes and Save in
   *  a rail on the right. */
  beside?: boolean;
  /** Where it goes — the folder chip, drawn by the screen. */
  destination: ReactNode;
  saving: boolean;
  /** The EQ the take is saved with, and heard through here. */
  eq: Eq | null;
  onSave: (title: string) => void;
  onDiscard: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(suggested);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  // What the player plays: the container as the encoder wrote it, or — for
  // a lossless take, which is still samples — a WAV made on the first press,
  // so a take nobody listens back to costs nothing.
  const [preview, setPreview] = useState<Blob | null>(
    take.mode === "encoded" && take.blob.size > 0 ? take.blob : null,
  );
  const [wantPlay, setWantPlay] = useState(false);
  // Heard through the EQ it will be saved with.
  const { sinkId } = useRouting();
  const player = useEqPlayer(preview, eq, sinkId);
  const duration = player.duration || take.durationMs / 1000;
  const progress = duration > 0 ? player.time / duration : 0;
  useEffect(() => {
    if (wantPlay && preview && !player.loading) {
      setWantPlay(false);
      void player.play();
    }
  }, [wantPlay, preview, player]);
  const toggle = () => {
    if (preview) {
      void player.toggle();
      return;
    }
    if (!take.pcm) return;
    setPreview(
      new Blob([encodeWav(take.pcm, 16) as BlobPart], { type: MIME_WAV }),
    );
    setWantPlay(true);
  };
  const canPlay = preview !== null || take.pcm !== null;

  const clipped = take.clipCount > 0;
  const name = (
    <label className="flex flex-col gap-1">
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
        {t("record.name")}
      </span>
      <input
        ref={input}
        type="text"
        value={title}
        maxLength={200}
        onInput={(e) => setTitle(e.currentTarget.value)}
        className={`w-full border-b-2 border-line bg-transparent pb-1.5 font-bold text-fg-bright outline-none focus:border-accent ${
          beside ? "text-xl" : "text-2xl"
        }`}
      />
    </label>
  );
  const hear = (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        className={`rounded-md bg-surface-2 px-2 py-1 text-accent ${
          beside ? "min-h-16 flex-1" : "max-h-72 min-h-24 flex-1"
        }`}
      >
        <Waveform
          peaks={take.peaks}
          progress={progress}
          onSeek={
            preview ? (share) => player.seek(share * duration) : undefined
          }
          label={t("player.position")}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!canPlay}
          aria-label={
            player.playing ? t("player.pause") : t("record.listenBack")
          }
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-page-bg transition-transform active:scale-95 disabled:opacity-40"
        >
          {player.playing ? (
            <PauseIcon className="h-5 w-5" />
          ) : (
            <PlayIcon className="h-5 w-5 translate-x-px" />
          )}
        </button>
        <span className="font-figures text-sm text-fg tabular-nums">
          {formatDuration(player.time * 1000)} /{" "}
          {formatDuration(take.durationMs)}
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
          <Chip>
            {t("record.peak")}{" "}
            <span className="font-figures tabular-nums">
              {formatDb(take.maxPeakDb)} dB
            </span>
          </Chip>
          <Chip
            tone={clipped ? "danger" : "plain"}
            icon={clipped ? <ClipIcon className="h-3.5 w-3.5" /> : undefined}
          >
            {clipped
              ? t("record.clippedTimes", { count: String(take.clipCount) })
              : t("player.clippedNone")}
          </Chip>
        </span>
      </div>
    </div>
  );
  const keep = (
    <div className="flex items-center gap-3 pb-2">
      <RoundGlyph
        label={t("record.discard")}
        onClick={onDiscard}
        disabled={saving}
        tone="danger"
      >
        <TrashIcon className="h-5 w-5" />
      </RoundGlyph>
      <button
        type="submit"
        disabled={saving}
        className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-accent text-base font-bold text-page-bg shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        <CheckIcon className="h-5 w-5" />
        {saving ? t("record.saving") : t("common.save")}
      </button>
    </div>
  );

  return (
    <form
      className={`flex min-h-full flex-1 gap-4 ${beside ? "flex-row" : "flex-col"}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(title);
      }}
    >
      {beside ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {name}
            {hear}
          </div>
          <div className="flex w-64 shrink-0 flex-col justify-end gap-3">
            <div className="flex">{destination}</div>
            <div className="flex-1" />
            {keep}
          </div>
        </>
      ) : (
        <>
          {name}
          <div className="flex">{destination}</div>
          {hear}
          <div className="flex-1" />
          {keep}
        </>
      )}
    </form>
  );
}

/** What the take is so far, as four figures a person acts on: the loudest
 *  peak (is it too hot?), the clips (did it flatten?), the size (will it
 *  fit an email?) and how much longer this device has room for (can the
 *  interview run on?). */
export function TakeStats({
  columns = 4,
  maxPeakDb,
  clipCount,
  size,
  left,
}: {
  /** Four across under the meter; two by two in a phone-on-its-side's
   *  rail. */
  columns?: 2 | 4;
  maxPeakDb: number;
  clipCount: number;
  size: string;
  /** Room left, in words — absent where the browser does not say. */
  left: string | null;
}) {
  const t = useT();
  const hot = maxPeakDb > -3;
  const cells: Array<[string, string, string]> = [
    [
      t("stats.peak"),
      maxPeakDb > -60 ? `${formatDb(maxPeakDb)} dB` : "—",
      hot ? "text-danger" : "text-fg-bright",
    ],
    [
      t("stats.clips"),
      String(clipCount),
      clipCount > 0 ? "text-danger" : "text-fg-bright",
    ],
    [t("stats.size"), size, "text-fg-bright"],
    [t("stats.left"), left ?? "—", "text-fg-bright"],
  ];
  return <Figures columns={columns} cells={cells} />;
}

/** Figures in a row of cells: a small caption over a number. The take's
 *  four while recording, and Ready's two before it, drawn alike so the
 *  standby face turns into the running one where it stands. */
export function Figures({
  cells,
  columns,
}: {
  /** Caption, value, the value's colour class. */
  cells: Array<[string, string, string]>;
  columns: 2 | 4;
}) {
  return (
    <dl
      className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-4"}`}
    >
      {cells.map(([label, value, tone]) => (
        <div
          key={label}
          className="flex min-w-0 flex-col items-center gap-0.5 rounded-md bg-surface-2 px-1 py-2"
        >
          <dt className="max-w-full truncate text-[0.625rem] font-semibold tracking-wide text-muted uppercase">
            {label}
          </dt>
          <dd
            className={`max-w-full truncate font-figures text-sm tabular-nums ${tone}`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Ready's face: the instrument at rest — the timer at nought, where the
 *  running one will stand, what a minute of this quality costs and how
 *  long this device has room for, and the one line that says Listen keeps
 *  nothing. A face, not an empty card: every figure on it is one a person
 *  acts on before the take. */
export function StandbyFace({
  timer,
  perMinute,
  left,
  hint,
  compact = false,
}: {
  timer: string;
  perMinute: string;
  left: string | null;
  hint: string;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        aria-hidden
        className={`flex items-center gap-3 font-figures font-light tracking-tight text-muted/70 tabular-nums ${compact ? "text-4xl" : "text-6xl"}`}
      >
        <span className="inline-block h-4 w-4 rounded-full border-2 border-current" />
        {timer}
      </div>
      <div className="w-full max-w-xs">
        <Figures
          columns={2}
          cells={[
            [t("stats.perMinute"), perMinute, "text-fg-bright"],
            [t("stats.left"), left ?? "—", "text-fg-bright"],
          ]}
        />
      </div>
      <p className="max-w-xs text-center text-xs text-muted">{hint}</p>
    </div>
  );
}

/** The framework's segmented buttons keep their text's width and their
 *  padding, so six (or five longer) of them run out of the bar on a narrow
 *  phone (the Quality sheet's bitrate and target rows). Let each shrink to its text with a little padding, and wrap onto
 *  a second line inside the bar rather than ever leaving it. */
export const SEGMENTS_FIT =
  "flex-wrap [&>button]:min-w-0 [&>button]:basis-auto [&>button]:px-1";

/** The room the browser says this site has left, bytes — read once each
 *  time `when` turns true, since it changes slowly and asking is not free.
 *  `null` where the browser does not say. Nothing leaves the device: this
 *  is the browser's own estimate of its own disk. */
export function useFreeBytes(when: boolean): number | null {
  const [free, setFree] = useState<number | null>(null);
  useEffect(() => {
    if (!when) return;
    let live = true;
    const estimate =
      typeof navigator !== "undefined"
        ? navigator.storage?.estimate?.bind(navigator.storage)
        : undefined;
    if (!estimate) return;
    void estimate()
      .then((e) => {
        if (!live || e.quota === undefined) return;
        setFree(Math.max(0, e.quota - (e.usage ?? 0)));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [when]);
  return free;
}
