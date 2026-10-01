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

type Subscribe = (
  listener: (frame: { meter: MeterState }) => void,
) => () => void;

type Props = {
  subscribe: Subscribe;
  labels: Partial<LevelMeterLabels>;
  target: TargetRange;
};

export function BigMeter({ subscribe, labels, target }: Props) {
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
    <div
      ref={box}
      className="app-meter-big"
      style={{
        ["--target-from" as string]: `${meterFill(lowDb) * 100}%`,
        ["--target-to" as string]: `${meterFill(highDb) * 100}%`,
      }}
    >
      <LevelMeter subscribe={subscribe} labels={labels} />
    </div>
  );
}
