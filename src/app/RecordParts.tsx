// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  MIME_WAV,
  Waveform,
  encodeWav,
  formatDb,
  usePlayer,
  type CaptureResult,
} from "@niclaslindstedt/oss-framework/audio";
import {
  AlertTriangleIcon,
  Button,
  CheckIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  WaveformIcon,
} from "@niclaslindstedt/oss-framework/components";

import { formatDuration } from "./format.ts";
import { ClipIcon, HeadphonesIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import type { Ambient, Verdict } from "./levels.ts";

// The pieces the Record screen's four modes are built from
// (docs/design.md, "Record"). The screen itself (`RecordScreen.tsx`) owns
// the state; these only draw.

/** A choice made before a take — its quality, where it goes — drawn as
 *  what it is: a button, bordered, with a caption, the value and a chevron.
 *  `slim` is the Listening mode's one-line form. */
export function ChoiceButton({
  icon,
  caption,
  detail,
  value,
  onClick,
  slim = false,
}: {
  icon: ReactNode;
  caption: string;
  /** A fact beside the caption — the quality's bitrate — kept off the
   *  value's line so the value is never cut short. */
  detail?: string;
  value: string;
  onClick: () => void;
  slim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={`${caption}: ${value}${detail ? `, ${detail}` : ""}`}
      className={`flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface text-left shadow-sm transition-colors hover:border-accent/60 hover:bg-surface-2 ${
        slim ? "px-3 py-2" : "px-3 py-2.5"
      }`}
    >
      <span className="shrink-0 text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        {!slim && (
          <span className="block truncate text-[0.6875rem] text-muted">
            <span className="font-semibold tracking-wide uppercase">
              {caption}
            </span>
            {detail && <span> · {detail}</span>}
          </span>
        )}
        <span className="block truncate text-sm font-semibold text-fg-bright">
          {value}
        </span>
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}

/** Ready's invitation to Listening: what it is, in one sentence, and the
 *  button. The sentence's job is to say that nothing is kept. */
export function ListenCard({
  onListen,
  busy,
  compact = false,
}: {
  onListen: () => void;
  busy: boolean;
  /** Less padding, for a phone on its side. */
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-dashed border-line bg-surface/60 ${compact ? "px-4 py-2.5" : "p-4"}`}
    >
      <WaveformIcon className="h-8 w-8 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg-bright">{t("listen.invite")}</p>
        <p className="text-xs text-muted">{t("listen.inviteHint")}</p>
      </div>
      <Button
        variant="primary"
        onClick={onListen}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5"
      >
        <HeadphonesIcon className="h-4 w-4" />
        {t("listen.start")}
      </Button>
    </div>
  );
}

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

/** A round glyph button beside the big one — Pause, Discard — or, `sm`, in
 *  a line of text: Listening's Stop. The name is the accessible name and the
 *  tooltip; there is no word on it. */
export function RoundGlyph({
  label,
  onClick,
  disabled,
  children,
  tone = "plain",
  size = "md",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: "plain" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex ${size === "sm" ? "h-11 w-11" : "h-14 w-14"} shrink-0 items-center justify-center rounded-full border border-line bg-surface transition-colors disabled:opacity-40 ${
        tone === "danger"
          ? "text-danger hover:border-danger/60 hover:bg-danger/10"
          : "text-fg hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
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
  beside = false,
  onSave,
  onDiscard,
}: {
  take: CaptureResult;
  suggested: string;
  /** A phone on its side: the take on the left, where it goes and Save in
   *  a rail on the right. */
  beside?: boolean;
  /** The "Save to" choice, drawn by the screen. */
  destination: ReactNode;
  saving: boolean;
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
  const player = usePlayer(preview);
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
    <div className={`flex flex-col gap-2 ${beside ? "min-h-0 flex-1" : ""}`}>
      <div
        className={`rounded-md bg-surface-2 px-2 py-1 text-accent ${
          beside ? "min-h-16 flex-1" : "h-24 tall:h-40"
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
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-muted">
          <span className="font-figures text-fg tabular-nums">
            {formatDuration(player.time * 1000)} /{" "}
            {formatDuration(take.durationMs)}
          </span>
          <span aria-hidden>·</span>
          <span>
            {t("record.peak")}{" "}
            <span className="font-figures tabular-nums">
              {formatDb(take.maxPeakDb)} dB
            </span>
          </span>
          <span aria-hidden>·</span>
          <span className={clipped ? "font-medium text-danger" : ""}>
            {clipped
              ? t("record.clippedTimes", { count: String(take.clipCount) })
              : t("player.clippedNone")}
          </span>
        </p>
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
            {destination}
            <div className="flex-1" />
            {keep}
          </div>
        </>
      ) : (
        <>
          {name}
          {hear}
          {destination}
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
  return (
    <dl
      className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-4"}`}
    >
      {cells.map(([label, value, tone]) => (
        <div
          key={label}
          className="flex min-w-0 flex-col items-center gap-0.5 rounded-md bg-surface-2 px-1 py-2"
        >
          <dt className="text-[0.625rem] font-semibold tracking-wide text-muted uppercase">
            {label}
          </dt>
          <dd className={`truncate font-figures text-sm tabular-nums ${tone}`}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

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
