// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { meterFill } from "@niclaslindstedt/oss-framework/audio";
import {
  Modal,
  PlusIcon,
  SegmentedControl,
  ToggleRow,
} from "@niclaslindstedt/oss-framework/components";

import {
  GATE_HOLDS_MS,
  GATE_MAX_DB,
  GATE_MIN_DB,
  GATE_PRES_MS,
  GATE_QUIETS,
  clampGateDb,
  type GateQuiet,
} from "./gate.ts";
import { MinusIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { SheetTitle } from "./ModalHeader.tsx";
import { SEGMENTS_FIT } from "./RecordParts.tsx";
import { formatTargetDb } from "./target.ts";
import type { AppSettings } from "./useAppSettings.ts";

// The sound trigger (docs/design.md, "The Trigger sheet"): a take that
// keeps only what is loud enough (`gate.ts`). Its own sheet, opened from
// the Record screen, because whether a take waits for sound depends on the
// take — a meeting left running, a rehearsal room — not on the device.
//
// The switch, then the level on the meter's own scale — with the room's
// noise floor on it while Listening, so the trigger is set above the room —
// then how long it keeps after the sound and from before it, and what
// becomes of the quiet: cut out, or kept as silence so the take keeps its
// length.

type Props = {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  /** The room's noise floor, dBFS, while Listening — `null` otherwise. */
  roomDb: number | null;
  /** The live meter, while Listening: the trigger set by watching the bar
   *  cross it. */
  meter?: ReactNode;
  onClose: () => void;
};

/** Seconds as the sheet's rows say them: "0.5 s", "2 s". */
function seconds(ms: number): string {
  return String(ms / 1000);
}

export function TriggerSheet({
  settings,
  update,
  roomDb,
  meter,
  onClose,
}: Props) {
  const t = useT();
  const db = settings.gateDb;
  const step = (by: number) => update("gateDb", clampGateDb(db + by));
  const off = !settings.gate;
  const stepButton =
    "flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-fg transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-surface";

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="trigger-title"
      centered
      closeLabel={t("common.close")}
    >
      <SheetTitle
        titleId="trigger-title"
        title={t("trigger.title")}
        onClose={onClose}
      />
      <div className="flex flex-col gap-4 p-3">
        <ToggleRow
          label={t("trigger.switch")}
          hint={t("trigger.switchHint")}
          checked={settings.gate}
          onChange={(next) => update("gate", next)}
        />

        <fieldset
          disabled={off}
          className={`flex flex-col gap-4 transition-opacity ${off ? "opacity-50" : ""}`}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-medium text-fg">
                  {t("trigger.level")}
                </span>
                <span className="text-xs text-muted">
                  {t("trigger.levelHint")}
                </span>
              </div>
              <button
                type="button"
                className={stepButton}
                disabled={db <= GATE_MIN_DB}
                aria-label={t("trigger.lower")}
                onClick={() => step(-1)}
              >
                <MinusIcon className="h-4 w-4" />
              </button>
              <span
                aria-live="polite"
                className="w-16 text-center font-figures text-sm text-fg-bright tabular-nums"
              >
                {t("target.value", { db: formatTargetDb(db) })}
              </span>
              <button
                type="button"
                className={stepButton}
                disabled={db >= GATE_MAX_DB}
                aria-label={t("trigger.raise")}
                onClick={() => step(1)}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            <TriggerScale db={db} roomDb={roomDb} />
            {roomDb !== null && (
              <p className="text-xs text-muted">
                {t("trigger.room", { db: formatTargetDb(Math.round(roomDb)) })}
              </p>
            )}
            {meter}
          </div>

          <Row label={t("trigger.hold")}>
            <SegmentedControl<string>
              value={String(settings.gateHoldMs)}
              options={GATE_HOLDS_MS.map((ms) => ({
                value: String(ms),
                label: t("trigger.seconds", { n: seconds(ms) }),
              }))}
              onChange={(next) =>
                update("gateHoldMs", Number(next) as AppSettings["gateHoldMs"])
              }
              ariaLabel={t("trigger.hold")}
              fullWidth
              className={SEGMENTS_FIT}
            />
          </Row>

          <Row label={t("trigger.pre")}>
            <SegmentedControl<string>
              value={String(settings.gatePreMs)}
              options={GATE_PRES_MS.map((ms) => ({
                value: String(ms),
                label: t("trigger.seconds", { n: seconds(ms) }),
              }))}
              onChange={(next) =>
                update("gatePreMs", Number(next) as AppSettings["gatePreMs"])
              }
              ariaLabel={t("trigger.pre")}
              fullWidth
              className={SEGMENTS_FIT}
            />
          </Row>

          <Row label={t("trigger.quiet")}>
            <SegmentedControl<GateQuiet>
              value={settings.gateQuiet}
              options={GATE_QUIETS.map((q) => ({
                value: q,
                label: t(`trigger.quietOption.${q}`),
              }))}
              onChange={(next) => update("gateQuiet", next)}
              ariaLabel={t("trigger.quiet")}
              fullWidth
              className={SEGMENTS_FIT}
            />
            <span className="text-xs text-muted">
              {t(`trigger.quietHint.${settings.gateQuiet}`)}
            </span>
          </Row>
        </fieldset>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fg">{label}</span>
      {children}
    </div>
  );
}

/** The trigger on the meter's own scale, −60 to 0: everything from it up in
 *  the accent — what will be kept — and the room, while Listening, as a
 *  mark, so "above the room" is something to see. */
function TriggerScale({ db, roomDb }: { db: number; roomDb: number | null }) {
  const at = (v: number) => `${meterFill(v) * 100}%`;
  return (
    <div aria-hidden className="flex flex-col gap-0.5">
      <div className="relative h-3 overflow-hidden rounded-sm bg-surface-2">
        <div
          className="absolute inset-y-0 right-0 bg-accent/60"
          style={{ left: at(db) }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-fg-bright"
          style={{ left: at(db) }}
        />
        {roomDb !== null && (
          <div
            className="absolute inset-y-0 w-0.5 bg-muted"
            style={{ left: at(roomDb) }}
          />
        )}
      </div>
      <div className="relative h-3 font-figures text-[9px] leading-none text-muted">
        {[-60, -40, -20, -12, -6, 0].map((v) => (
          <span
            key={v}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: at(v) }}
          >
            {formatTargetDb(v)}
          </span>
        ))}
      </div>
    </div>
  );
}
