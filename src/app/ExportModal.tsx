// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { FLAC_LEVELS, WAV_DEPTHS } from "@niclaslindstedt/oss-framework/audio";
import {
  Button,
  DownloadIcon,
  Modal,
  SegmentedControl,
  SpinnerIcon,
  ToggleRow,
} from "@niclaslindstedt/oss-framework/components";

import {
  estimateExportBytes,
  exportFileName,
  exportPlan,
  exportRecording,
  shareOriginal,
  type ExportOptions,
} from "./export.ts";
import { formatContainer, formatRate, formatSize } from "./format.ts";
import { presetOf, type Eq } from "./eq.ts";
import { useT } from "./i18n/index.ts";
import { EqIcon, ShareIcon } from "./icons.tsx";
import { ModalHeader } from "./ModalHeader.tsx";
import type { Recording } from "./types.ts";
import {
  BITRATES,
  EXPORT_RATES,
  type AppSettings,
  type ExportFormat,
} from "./useAppSettings.ts";

// The export sheet: the format, its quality, the rate and mono, starting on
// the settings' defaults and writing the choice back to them, so the next
// export starts where this one left off. Above the button's reach, what the
// file will be and roughly how large — before the encoder runs, because a
// file that will not fit in an email is worth knowing about first.

type Props = {
  recording: Recording;
  blob: Blob;
  locale: string;
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onNotice: (message: string) => void;
  onClose: () => void;
};

export function ExportModal({
  recording,
  blob,
  locale,
  settings,
  update,
  onNotice,
  onClose,
}: Props) {
  const t = useT();
  const [busy, setBusy] = useState<null | "encoder" | "encoding">(null);
  const options: ExportOptions = {
    format: settings.exportFormat,
    wavDepth: settings.exportWavDepth,
    flacLevel: settings.exportFlacLevel,
    mp3Bitrate: settings.exportMp3Bitrate,
    rate: settings.exportRate,
    mono: settings.exportMono,
  };

  const eqName = (eq: Eq) => {
    const id = presetOf(eq);
    return id ? t(`eq.preset.${id}`) : t("eq.custom");
  };
  const plan = exportPlan(recording, options);
  const outcome = t("export.outcome", {
    size: formatSize(estimateExportBytes(recording, options), locale),
    rate: formatRate(plan.sampleRate),
    channels: plan.channels > 1 ? t("player.stereo") : t("player.mono"),
    format: t(`export.${options.format}`),
  });

  const run = async () => {
    setBusy(options.format === "mp3" ? "encoder" : "encoding");
    const file = exportFileName(recording, options.format);
    try {
      const outcome = await exportRecording(recording, blob, options);
      onNotice(
        outcome === "shared"
          ? t("export.shared", { file })
          : t("export.done", { file }),
      );
      onClose();
    } catch (err) {
      onNotice(
        t("common.exportFailed", {
          file,
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      setBusy(null);
    }
  };

  const original = async () => {
    try {
      const outcome = await shareOriginal(recording, blob);
      onNotice(
        outcome === "shared"
          ? t("export.shared", { file: recording.fileName })
          : t("export.done", { file: recording.fileName }),
      );
      onClose();
    } catch (err) {
      onNotice(
        t("common.exportFailed", {
          file: recording.fileName,
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="export-title"
      centered
      closeLabel={t("common.close")}
    >
      <ModalHeader
        titleId="export-title"
        title={t("export.title")}
        onCancel={onClose}
        onSave={() => void run()}
        saveDisabled={busy !== null}
        saveLabel={t("export.run")}
        saveIcon={<DownloadIcon className="h-4 w-4" />}
      />
      <div className="flex flex-col gap-4 p-4">
        <Field label={t("export.format")}>
          <SegmentedControl<ExportFormat>
            value={settings.exportFormat}
            options={[
              { value: "wav", label: t("export.wav") },
              { value: "flac", label: t("export.flac") },
              { value: "mp3", label: t("export.mp3") },
            ]}
            onChange={(next) => update("exportFormat", next)}
            ariaLabel={t("export.format")}
            fullWidth
          />
          <p className="text-xs text-muted">
            {t(`export.formatHint.${settings.exportFormat}`)}
          </p>
        </Field>

        {settings.exportFormat === "wav" && (
          <Field label={t("export.depth")}>
            <SegmentedControl<string>
              value={String(settings.exportWavDepth)}
              options={WAV_DEPTHS.map((d) => ({
                value: String(d),
                label:
                  d === 32
                    ? t("export.depthFloat")
                    : t("export.depthBits", { bits: String(d) }),
              }))}
              onChange={(next) =>
                update(
                  "exportWavDepth",
                  Number(next) as AppSettings["exportWavDepth"],
                )
              }
              ariaLabel={t("export.depth")}
              fullWidth
            />
          </Field>
        )}

        {settings.exportFormat === "flac" && (
          <Field label={t("export.level")}>
            <SegmentedControl<string>
              value={String(settings.exportFlacLevel)}
              options={FLAC_LEVELS.map((l) => ({
                value: String(l),
                label: t(`export.levelName.${String(l) as "0" | "5" | "8"}`),
              }))}
              onChange={(next) =>
                update(
                  "exportFlacLevel",
                  Number(next) as AppSettings["exportFlacLevel"],
                )
              }
              ariaLabel={t("export.level")}
              fullWidth
            />
          </Field>
        )}

        {settings.exportFormat === "mp3" && (
          <Field label={t("export.bitrate")}>
            <SegmentedControl<string>
              value={String(settings.exportMp3Bitrate)}
              options={BITRATES.map((b) => ({
                value: String(b),
                label: String(b),
              }))}
              onChange={(next) =>
                update(
                  "exportMp3Bitrate",
                  Number(next) as AppSettings["exportMp3Bitrate"],
                )
              }
              ariaLabel={t("export.bitrate")}
              fullWidth
            />
            <p className="text-xs text-muted">
              {t("export.kbps", { kbps: String(settings.exportMp3Bitrate) })}
            </p>
          </Field>
        )}

        <Field label={t("export.rate")}>
          <SegmentedControl<string>
            value={String(settings.exportRate)}
            options={EXPORT_RATES.map((r) => ({
              value: String(r),
              label: r === 0 ? t("export.rateKeep") : formatRate(r),
            }))}
            onChange={(next) =>
              update("exportRate", Number(next) as AppSettings["exportRate"])
            }
            ariaLabel={t("export.rate")}
            fullWidth
          />
        </Field>

        <ToggleRow
          label={t("export.mono")}
          hint={t("export.monoHint")}
          checked={settings.exportMono}
          onChange={(next) => update("exportMono", next)}
        />

        <p
          aria-live="polite"
          className="rounded-md bg-surface-2 px-3 py-2 text-center text-sm font-medium text-fg-bright"
        >
          {outcome}
          {recording.eq && (
            <span className="mt-0.5 flex items-center justify-center gap-1.5 text-xs font-normal text-accent">
              <EqIcon className="h-3.5 w-3.5" />
              {t("eq.exportLine", { name: eqName(recording.eq) })}
            </span>
          )}
        </p>

        {busy && (
          <p
            className="flex items-center gap-2 text-sm text-muted"
            role="status"
          >
            <SpinnerIcon className="h-4 w-4 animate-spin" />
            {busy === "encoder"
              ? t("export.fetchingEncoder")
              : t("export.working")}
          </p>
        )}

        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <Button
            onClick={() => void original()}
            disabled={busy !== null}
            className="flex items-center justify-center gap-1.5"
          >
            <ShareIcon className="h-4 w-4" />
            {t("export.original")}
          </Button>
          <p className="text-xs text-muted">
            {t("export.originalHint", {
              format: formatContainer(recording.mimeType),
            })}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: preact.ComponentChildren;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fg">{label}</span>
      {children}
    </div>
  );
}
