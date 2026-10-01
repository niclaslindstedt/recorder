// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { Modal } from "@niclaslindstedt/oss-framework/components";

import {
  EQ_BANDS,
  EQ_PRESETS,
  FLAT_EQ,
  normalizeEq,
  presetOf,
  withGain,
  withPreset,
  type Eq,
} from "./eq.ts";
import { EqCurve, Knob, useEqName } from "./EqParts.tsx";
import { HeadphonesIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { SheetTitle } from "./ModalHeader.tsx";
import type { Monitor } from "./useMonitor.ts";

// The equalizer sheet (docs/design.md, "The EQ sheet"): one sheet, opened
// from the Record screen for the EQ new takes start with, and from the
// player for one recording's. The curve on top, the starting points, a
// knob per band, the low cut and Compare; under them whatever hears it —
// the monitor on the Record screen, the transport in the player. A starting
// point sets the five bands and never the low cut, which is its own switch:
// the two never undo each other.
//
// Every move is heard at once; the sheet's owner keeps the EQ (the Record
// screen in settings as it moves, the player when the sheet closes).

type Props = {
  eq: Eq | null;
  onChange: (eq: Eq | null) => void;
  /** Comparing: heard without the EQ while it is on. */
  bypassed: boolean;
  onBypass: (on: boolean) => void;
  /** The sound after the EQ, when there is one to show. */
  analyser: AnalyserNode | null;
  /** What the EQ here is for, in a sentence. */
  note: string;
  /** What lets it be heard: the monitor, or the transport. */
  children: ReactNode;
  onClose: () => void;
};

export function EqSheet({
  eq,
  onChange,
  bypassed,
  onBypass,
  analyser,
  note,
  children,
  onClose,
}: Props) {
  const t = useT();
  const current = eq ?? FLAT_EQ;
  const preset = presetOf(eq);
  const eqName = useEqName();
  const set = (next: Eq) => onChange(normalizeEq(next));

  const pill = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      on
        ? "border-accent bg-accent/15 text-fg-bright"
        : "border-line text-fg hover:bg-surface-2"
    }`;

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="eq-title"
      centered
      size="max-w-lg"
      closeLabel={t("common.close")}
    >
      <SheetTitle titleId="eq-title" title={t("eq.title")} onClose={onClose} />
      <div className="flex flex-col gap-4 p-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-bright">
              {eqName(eq)}
            </span>
            <button
              type="button"
              aria-pressed={bypassed}
              title={t("eq.compareHint")}
              onClick={() => onBypass(!bypassed)}
              className={pill(bypassed)}
            >
              {t("eq.compare")}
            </button>
          </div>
          <div className="h-36 rounded-md bg-surface-2 tall:h-44">
            <EqCurve eq={eq} analyser={analyser} bypassed={bypassed} />
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label={t("eq.presets")}
          className="flex flex-wrap gap-1.5"
        >
          {EQ_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={preset === p.id}
              onClick={() => set(withPreset(eq, p.id))}
              className={pill(preset === p.id)}
            >
              {t(`eq.preset.${p.id}`)}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label={t("eq.knobs")}
          className="grid grid-cols-5 gap-1"
        >
          {EQ_BANDS.map((b) => (
            <Knob
              key={b.id}
              name={t(`eq.band.${b.id}.name`)}
              hz={t(`eq.band.${b.id}.hz`)}
              hint={t(`eq.band.${b.id}.hint`)}
              value={current.gains[b.id]}
              onChange={(db) => set(withGain(current, b.id, db))}
            />
          ))}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={current.lowCut}
          onClick={() => set({ ...current, lowCut: !current.lowCut })}
          className="flex items-center gap-3 rounded-md border border-line px-3 py-2 text-left transition-colors hover:bg-surface-2"
        >
          <span
            aria-hidden
            className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              current.lowCut ? "bg-accent" : "bg-surface-3"
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-fg-bright shadow transition-transform ${
                current.lowCut ? "translate-x-4" : ""
              }`}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg-bright">
              {t("eq.lowCut")}
            </span>
            <span className="block text-xs text-muted">
              {t("eq.lowCutHint")}
            </span>
          </span>
        </button>

        {children}

        <p className="text-xs text-muted">{note}</p>
      </div>
    </Modal>
  );
}

/** The Record screen's way to hear the EQ: the microphone through it, into
 *  headphones. Says to put them on before it starts, says that nothing is
 *  kept while it runs. */
export function MonitorPanel({ monitor }: { monitor: Monitor }) {
  const t = useT();
  const on = monitor.state === "on" || monitor.state === "starting";
  const status =
    monitor.state === "on"
      ? t("eq.monitor.on")
      : monitor.state === "starting"
        ? t("eq.monitor.starting")
        : monitor.state === "denied"
          ? t("eq.monitor.denied")
          : monitor.state === "failed"
            ? t("eq.monitor.failed")
            : t("eq.monitor.hint");
  const trouble = monitor.state === "denied" || monitor.state === "failed";
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        on ? "border-accent/60 bg-accent/10" : "border-dashed border-line"
      }`}
    >
      <HeadphonesIcon
        className={`h-7 w-7 shrink-0 ${on ? "text-accent" : "text-muted"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg-bright">
          {t("eq.monitor.title")}
        </p>
        <p
          role="status"
          aria-live="polite"
          className={`text-xs ${trouble ? "text-danger" : "text-muted"}`}
        >
          {monitor.state === "on" && (
            <span
              aria-hidden
              className="app-rec-dot mr-1.5 inline-block h-2 w-2 rounded-full bg-accent"
            />
          )}
          {status}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => (on ? monitor.stop() : monitor.start())}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
          on
            ? "border border-line bg-surface text-fg hover:bg-surface-2"
            : "bg-accent text-page-bg"
        }`}
      >
        {on ? t("eq.monitor.stop") : t("eq.monitor.start")}
      </button>
    </div>
  );
}
