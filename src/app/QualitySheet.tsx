// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  CheckIcon,
  Modal,
  SegmentedControl,
  ToggleRow,
} from "@niclaslindstedt/oss-framework/components";

import { formatSize, formatSpan } from "./format.ts";
import { QualityIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { SheetTitle } from "./ModalHeader.tsx";
import { SEGMENTS_FIT, useFreeBytes } from "./RecordParts.tsx";
import { TargetLevel } from "./TargetLevel.tsx";
import {
  QUALITY_PRESETS,
  bytesPerMinute,
  presetFor,
  qualityLevel,
  recordingTimeLeft,
  type QualityId,
  type QualityPreset,
} from "./quality.ts";
import { BITRATES, type AppSettings } from "./useAppSettings.ts";

// How the next take is kept (docs/design.md, "The Quality sheet"). Its own
// sheet, opened from the Record screen, because it varies between takes —
// an interview at 128 kbit/s, a song idea lossless — rather than being a
// setting three levels down.
//
// Presets first, each with who it is for, what a minute costs and how long
// the room left on this device would hold, because "will an hour fit?" and
// "will it be good enough?" are the two questions.
// The bitrate row is for a number the presets do not offer. Voice
// processing lives here too: it changes what is recorded, and whether you
// want it depends on the take. So does the target level (`TargetLevel.tsx`):
// where the peaks should land depends on what is in front of the microphone.

const HOUR = 3_600_000;

type Props = {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  locale: string;
  onClose: () => void;
};

export function QualitySheet({ settings, update, locale, onClose }: Props) {
  const t = useT();
  const current = presetFor(settings);
  // The browser's own estimate of its free space, read once as the sheet
  // opens — the same figure as "Room for" while recording.
  const freeBytes = useFreeBytes(true);
  const roomFor = (p: QualityPreset) => {
    const ms = recordingTimeLeft(freeBytes, p.kind, p.bitrate);
    if (ms === null) return null;
    // A rough figure: whole hours once there is an hour, so the column
    // stays narrow ("room for 16 h", not "16 h 32 min").
    return formatSpan(ms < HOUR ? ms : Math.round(ms / HOUR) * HOUR, {
      hours: t("common.hours"),
      minutes: t("common.minutes"),
    });
  };

  const choose = (id: QualityId) => {
    const preset = QUALITY_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    update("recordingKind", preset.kind);
    if (preset.kind === "compact") update("recordingBitrate", preset.bitrate);
  };

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="quality-title"
      centered
      closeLabel={t("common.close")}
    >
      <SheetTitle
        titleId="quality-title"
        title={t("quality.title")}
        onClose={onClose}
      />
      <div className="flex flex-col gap-4 p-3">
        {/* The four presets as tiles, two by two: the glyph's bars say
            the step, the words who it is for, the figures what a minute
            costs and how long this device has room for. */}
        <div
          role="radiogroup"
          aria-labelledby="quality-title"
          className="grid grid-cols-2 gap-2"
        >
          {QUALITY_PRESETS.map((p) => {
            const on = current === p.id;
            const room = roomFor(p);
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose(p.id)}
                className={`relative flex min-w-0 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                  on
                    ? "border-accent bg-accent/10"
                    : "border-line bg-surface hover:bg-surface-2"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <QualityIcon
                    level={qualityLevel(p.kind, p.bitrate)}
                    className={`h-6 w-6 ${on ? "text-accent" : "text-fg"}`}
                  />
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      on
                        ? "border-accent bg-accent text-page-bg"
                        : "border-line"
                    }`}
                  >
                    {on && <CheckIcon className="h-3 w-3" />}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-fg-bright">
                    {t(`quality.preset.${p.id}`)}
                  </span>
                  <span className="block text-xs text-muted">
                    {t(`quality.presetHint.${p.id}`)}
                  </span>
                </span>
                <span className="mt-auto flex flex-wrap gap-x-2 font-figures text-[0.6875rem] text-muted tabular-nums">
                  <span className="text-fg">
                    {p.kind === "lossless"
                      ? t("quality.flac")
                      : t("export.kbps", { kbps: String(p.bitrate) })}
                  </span>
                  <span>
                    {t("quality.perMinute", {
                      size: formatSize(
                        bytesPerMinute(p.kind, p.bitrate),
                        locale,
                      ),
                    })}
                  </span>
                  {room !== null && (
                    <span>{t("quality.roomFor", { span: room })}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {settings.recordingKind === "compact" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg">
              {t("quality.bitrate")}
            </span>
            <SegmentedControl<string>
              value={String(settings.recordingBitrate)}
              options={BITRATES.map((b) => ({
                value: String(b),
                label: String(b),
              }))}
              onChange={(next) =>
                update(
                  "recordingBitrate",
                  Number(next) as AppSettings["recordingBitrate"],
                )
              }
              ariaLabel={t("quality.bitrate")}
              fullWidth
              className={SEGMENTS_FIT}
            />
          </div>
        )}

        <ToggleRow
          label={t("settings.voiceProcessing")}
          hint={t("settings.voiceProcessingHint")}
          checked={settings.voiceProcessing}
          onChange={(next) => update("voiceProcessing", next)}
        />

        <TargetLevel settings={settings} update={update} />
      </div>
    </Modal>
  );
}
