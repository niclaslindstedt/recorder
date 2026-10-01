// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { meterFill } from "@niclaslindstedt/oss-framework/audio";
import {
  PlusIcon,
  SegmentedControl,
} from "@niclaslindstedt/oss-framework/components";

import { MinusIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { SEGMENTS_FIT } from "./RecordParts.tsx";
import {
  TARGET_IDS,
  TARGET_MAX_DB,
  TARGET_MIN_DB,
  TARGET_MIN_SPAN_DB,
  clampTarget,
  formatTargetDb,
  targetRange,
  type TargetId,
  type TargetRange,
} from "./target.ts";
import type { AppSettings } from "./useAppSettings.ts";

// The Quality sheet's target level (docs/design.md, "The Quality sheet"):
// where the next take's peaks should land, by what is in front of the
// microphone. It sits beside quality because it varies the same way — a
// voice memo today, a drum kit tomorrow — and the waveform shades it.
//
// The presets first, then the chosen one's range drawn on the meter's own
// scale so the band on the sheet and the band on the waveform are the same
// shape, and for Custom two steppers, a decibel at a time.

type Props = {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
};

export function TargetLevel({ settings, update }: Props) {
  const t = useT();
  const id = settings.levelTarget;
  const custom = {
    lowDb: settings.targetLowDb,
    highDb: settings.targetHighDb,
  };
  const range = targetRange(id, custom);

  const setCustom = (lowDb: number, highDb: number) => {
    const next = clampTarget(lowDb, highDb);
    update("targetLowDb", next.lowDb);
    update("targetHighDb", next.highDb);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span id="target-title" className="text-xs font-medium text-fg">
          {t("target.title")}
        </span>
        <span className="text-xs text-muted">{t("target.hint")}</span>
      </div>
      <SegmentedControl<TargetId>
        value={id}
        options={TARGET_IDS.map((v) => ({
          value: v,
          label: t(`target.preset.${v}`),
        }))}
        onChange={(next) => update("levelTarget", next)}
        ariaLabel={t("target.title")}
        fullWidth
        className={SEGMENTS_FIT}
      />
      <TargetScale range={range} />
      <p className="text-xs text-muted">
        <span className="font-figures font-medium text-fg tabular-nums">
          {t("target.range", {
            low: formatTargetDb(range.lowDb),
            high: formatTargetDb(range.highDb),
          })}
        </span>
        {" · "}
        {t(`target.presetHint.${id}`)}
      </p>
      {id === "custom" && (
        <div className="flex flex-col gap-1.5">
          <Stepper
            label={t("target.low")}
            value={range.lowDb}
            canLower={range.lowDb > TARGET_MIN_DB}
            canRaise={range.lowDb < range.highDb - TARGET_MIN_SPAN_DB}
            onStep={(by) => setCustom(range.lowDb + by, range.highDb)}
          />
          <Stepper
            label={t("target.high")}
            value={range.highDb}
            canLower={range.highDb > range.lowDb + TARGET_MIN_SPAN_DB}
            canRaise={range.highDb < TARGET_MAX_DB}
            onStep={(by) => setCustom(range.lowDb, range.highDb + by)}
          />
        </div>
      )}
    </div>
  );
}

/** The range on the meter's own scale, −60 to 0: the band in the accent,
 *  the framework's hot zone in red at the right, so the sheet's picture is
 *  the waveform's turned on its side. */
function TargetScale({ range }: { range: TargetRange }) {
  const at = (db: number) => `${meterFill(db) * 100}%`;
  const width = (from: number, to: number) =>
    `${(meterFill(to) - meterFill(from)) * 100}%`;
  return (
    <div aria-hidden className="flex flex-col gap-0.5">
      <div className="relative h-3 overflow-hidden rounded-sm bg-surface-2">
        <div
          className="absolute inset-y-0 bg-accent"
          style={{
            left: at(range.lowDb),
            width: width(range.lowDb, range.highDb),
          }}
        />
        <div
          className="absolute inset-y-0 bg-flag/40"
          style={{ left: at(range.highDb), width: width(range.highDb, -3) }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-danger/70"
          style={{ left: at(-3) }}
        />
      </div>
      <div className="relative h-3 font-figures text-[9px] leading-none text-muted">
        {[-60, -40, -20, -12, -6, 0].map((db) => (
          <span
            key={db}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: at(db) }}
          >
            {formatTargetDb(db)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  canLower,
  canRaise,
  onStep,
}: {
  label: string;
  value: number;
  canLower: boolean;
  canRaise: boolean;
  onStep: (by: number) => void;
}) {
  const t = useT();
  const button =
    "flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-fg transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-surface";
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 text-sm text-fg">{label}</span>
      <button
        type="button"
        className={button}
        disabled={!canLower}
        aria-label={t("target.lower", { edge: label })}
        onClick={() => onStep(-1)}
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className="w-16 text-center font-figures text-sm text-fg-bright tabular-nums"
      >
        {t("target.value", { db: formatTargetDb(value) })}
      </span>
      <button
        type="button"
        className={button}
        disabled={!canRaise}
        aria-label={t("target.raise", { edge: label })}
        onClick={() => onStep(1)}
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
