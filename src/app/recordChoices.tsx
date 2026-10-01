// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { FolderIcon, MicIcon } from "@niclaslindstedt/oss-framework/components";

import { presetOf } from "./eq.ts";
import { EqLine } from "./EqParts.tsx";
import { folderPath } from "./folders.ts";
import { ChoiceGlyph, ChoiceTile, FolderChip, RoundGlyph } from "./Glyphs.tsx";
import { QualityIcon, TriggerIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { presetFor, qualityLevel } from "./quality.ts";
import { formatTargetDb } from "./target.ts";
import type { AppData } from "./types.ts";
import type { AppSettings } from "./useAppSettings.ts";
import type { AudioRouting } from "./useAudioRouting.ts";

// The Record screen's choices — how a take is kept, how it sounds, what it
// hears through, when it starts, and where it goes — as they are drawn in
// each mode (docs/design.md, "Ready"): four tiles across the top of Ready
// and a glyph beside its button, a strip of small glyphs while Listening,
// chips while Recording, a chip in Review. One place says them all, so the
// tile, the glyph and the chip never disagree.

export type ChoiceSheet = "quality" | "eq" | "mic" | "trigger" | "destination";

export function useRecordChoices({
  settings,
  data,
  destinationLive,
  routing,
  saving,
  setSheet,
}: {
  settings: AppSettings;
  data: AppData;
  /** The folder a take will be saved to, `null` for none. */
  destinationLive: string | null;
  routing: AudioRouting;
  saving: boolean;
  setSheet: (sheet: ChoiceSheet) => void;
}) {
  const t = useT();
  const { gate, gateDb, gateHoldMs, gateQuiet } = settings;

  // The choices, as the tiles say them: a word or two each, the whole of
  // it in the accessible name.
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
  const qualityBars = qualityLevel(
    settings.recordingKind,
    settings.recordingBitrate,
  );
  const destinationPath = destinationLive
    ? folderPath(data, destinationLive).map((f) => f.name)
    : [];
  const destinationValue = destinationPath.join(" › ") || t("record.noFolder");
  const destinationShort = destinationPath.at(-1) ?? t("record.noFolder");

  // Which microphone, and — once one is chosen — where the sound comes
  // out. A chosen device that is away is said to be.
  const micName = (
    choice: AppSettings["inputDevice"],
    found: { name: string } | null,
    named = true,
  ) =>
    found
      ? found.name
      : choice
        ? named
          ? t("devices.absent", { name: choice.name })
          : choice.name
        : t("devices.automatic");
  const micValue = micName(settings.inputDevice, routing.input, routing.named);
  const micDetail = settings.outputDevice
    ? t("devices.playsOn", {
        name: micName(settings.outputDevice, routing.output),
      })
    : undefined;
  // When a take records: always, or only on sound — and then what becomes
  // of the quiet, with the level and the hold.
  const triggerValue = !gate
    ? t("trigger.off")
    : gateQuiet === "cut"
      ? t("trigger.onCut")
      : t("trigger.onSilence");
  const triggerDetail = gate
    ? t("trigger.detail", {
        db: formatTargetDb(gateDb),
        hold: t("trigger.seconds", { n: String(gateHoldMs / 1000) }),
      })
    : undefined;
  const eqPreset = presetOf(settings.recordEq);
  const eqValue = eqPreset ? t(`eq.preset.${eqPreset}`) : t("eq.custom");

  // The four choices that decide how and when a take records, in the
  // order they are thought of: how it is kept, how it sounds, what it
  // hears through, when it starts. Each is lit when it is not the default,
  // so a glance at the row says what is out of the ordinary. Where it goes
  // is the fifth, beside the button (`folderGlyph`).
  const named = (caption: string, value: string, detail?: string) =>
    `${caption}: ${value}${detail ? `, ${detail}` : ""}`;
  const choices: Array<{
    key: string;
    icon: (small: boolean) => ReactNode;
    caption: string;
    value: string;
    detail?: string;
    label: string;
    lit: boolean;
    open: () => void;
  }> = [
    {
      key: "quality",
      icon: (small) => (
        <QualityIcon
          level={qualityBars}
          className={small ? "h-5 w-5" : "h-7 w-7"}
        />
      ),
      caption: t("quality.title"),
      value: qualityName,
      detail: qualityDetail,
      label: named(t("quality.title"), qualityName, qualityDetail),
      lit: false,
      open: () => setSheet("quality"),
    },
    {
      // The EQ's own curve stands where a glyph would, so the tile shows
      // what new takes will sound like and not only what it is called.
      key: "eq",
      icon: (small) => (
        <EqLine
          eq={settings.recordEq}
          className={small ? "h-5 w-7" : "h-7 w-11"}
        />
      ),
      caption: t("eq.caption"),
      value: eqValue,
      detail: settings.recordEq?.lowCut ? t("eq.lowCut") : undefined,
      label: named(
        t("eq.caption"),
        eqValue,
        settings.recordEq?.lowCut ? t("eq.lowCut") : undefined,
      ),
      lit: settings.recordEq !== null,
      open: () => setSheet("eq"),
    },
    {
      key: "mic",
      icon: (small) => <MicIcon className={small ? "h-5 w-5" : "h-7 w-7"} />,
      caption: t("devices.short"),
      value: micValue,
      detail: micDetail,
      label: named(t("devices.caption"), micValue, micDetail),
      lit: settings.inputDevice !== null || settings.outputDevice !== null,
      open: () => {
        routing.refresh(true);
        setSheet("mic");
      },
    },
    {
      key: "trigger",
      icon: (small) => (
        <TriggerIcon className={small ? "h-5 w-5" : "h-7 w-7"} />
      ),
      caption: t("trigger.caption"),
      value: gate ? t("trigger.tileOn") : t("trigger.tileOff"),
      detail: triggerDetail,
      label: named(t("trigger.caption"), triggerValue, triggerDetail),
      lit: gate,
      open: () => setSheet("trigger"),
    },
  ];
  const tiles = (
    <div className="grid grid-cols-4 gap-2">
      {choices.map((c) => (
        <ChoiceTile
          key={c.key}
          icon={c.icon(false)}
          caption={c.caption}
          value={c.value}
          detail={c.detail}
          label={c.label}
          lit={c.lit}
          onClick={c.open}
        />
      ))}
    </div>
  );
  const folderLabel = `${t("record.saveTo")}: ${destinationValue}`;
  // Listening's form: the same five as a row of small glyphs — still in
  // reach, no longer the subject.
  const glyphStrip = (
    <div className="flex items-start justify-between gap-1">
      {choices.map((c) => (
        <ChoiceGlyph
          key={c.key}
          icon={c.icon(true)}
          value={c.value}
          label={c.label}
          lit={c.lit}
          onClick={c.open}
        />
      ))}
      <ChoiceGlyph
        icon={<FolderIcon className="h-5 w-5" />}
        value={destinationShort}
        label={folderLabel}
        lit={destinationLive !== null}
        onClick={() => setSheet("destination")}
      />
    </div>
  );
  // Where the take goes, as a glyph beside the big button: decided before
  // the take, and said again in Review.
  const folderGlyph = (
    <RoundGlyph
      label={folderLabel}
      caption={destinationShort}
      tone={destinationLive ? "accent" : "plain"}
      onClick={() => setSheet("destination")}
    >
      <FolderIcon className="h-6 w-6" />
    </RoundGlyph>
  );
  const destinationChip = (
    <FolderChip
      name={destinationValue}
      label={folderLabel}
      disabled={saving}
      onClick={() => setSheet("destination")}
    />
  );

  return {
    qualityName,
    qualityDetail,
    qualityBars,
    destinationValue,
    destinationShort,
    tiles,
    glyphStrip,
    folderGlyph,
    destinationChip,
  };
}
