// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import {
  LevelMeter,
  meterFill,
  type LevelMeterLabels,
  type MeterState,
} from "@niclaslindstedt/oss-framework/audio";

import { targetTone, type TargetRange, type TargetTone } from "./target.ts";

// The Record screen's meter (docs/design.md, "Listening"): the framework's
// `LevelMeter` at the screen's size, with the target level on it. The bar,
// its ballistics, the held peak, the clip lamp and the status region are
// all the framework's; the app adds two things, both in styles.css under
// `.app-meter-big`:
//
// - the target as a band on the track, its edges drawn over the bar, from
//   `--target-from` / `--target-to` set here;
// - the bar's colour by where the held peak sits against the target —
//   grey under, the accent in it, amber over, red when hot or clipping —
//   through `data-target`, set here on every frame without a render. The
//   peak, not the bar's length, because the target is a range for peaks:
//   the bar is the average, which sits well under them.
//
// - the sound trigger's level, when it is on, as a mark across the track
//   (`.app-trigger-mark`): the bar past it is sound the take keeps.
//
// Over the meter, the target in words — its name and its range, beside a
// swatch drawn like the band — so "under the target" and "over the
// target" in Listening's verdict have something on screen to point at.

type Subscribe = (
  listener: (frame: { meter: MeterState }) => void,
) => () => void;

type Props = {
  subscribe: Subscribe;
  labels: Partial<LevelMeterLabels>;
  target: TargetRange;
  /** The target in words: "Target", and what it is — "Voice · −18 to −6 dB". */
  targetLabel: { caption: string; value: string };
  /** The sound trigger, when it is on: its level and its words. */
  trigger?: { db: number; caption: string; value: string };
};

export function BigMeter({
  subscribe,
  labels,
  target,
  targetLabel,
  trigger,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const { lowDb, highDb } = target;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const range = { lowDb, highDb };
    let shown: TargetTone | null = null;
    const show = (tone: TargetTone) => {
      if (tone === shown) return;
      shown = tone;
      el.dataset.target = tone;
    };
    show("under");
    return subscribe(({ meter }) =>
      show(targetTone(meter.peakDb, meter.clipping, range)),
    );
  }, [subscribe, lowDb, highDb]);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex min-w-0 items-center gap-2 text-xs">
        <span aria-hidden className="app-target-swatch h-3 w-5 shrink-0" />
        <span className="shrink-0 text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
          {targetLabel.caption}
        </span>
        <span className="min-w-0 truncate font-medium text-fg-bright">
          {targetLabel.value}
        </span>
        {trigger && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <span aria-hidden className="app-trigger-swatch h-3 w-0.5" />
            <span className="text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
              {trigger.caption}
            </span>
            <span className="font-figures font-medium text-fg-bright tabular-nums">
              {trigger.value}
            </span>
          </span>
        )}
      </p>
      <div
        ref={box}
        className="app-meter-big"
        style={{
          ["--target-from" as string]: `${meterFill(lowDb) * 100}%`,
          ["--target-to" as string]: `${meterFill(highDb) * 100}%`,
        }}
      >
        <LevelMeter subscribe={subscribe} labels={labels} />
        {trigger && (
          <span
            aria-hidden
            className="app-trigger-mark"
            style={{
              ["--trigger-at" as string]: String(meterFill(trigger.db)),
            }}
          />
        )}
      </div>
    </div>
  );
}
