// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import { CheckIcon, Modal } from "@niclaslindstedt/oss-framework/components";

import { choiceOf, type AudioDevice, type DeviceChoice } from "./devices.ts";
import { useT } from "./i18n/index.ts";
import { SheetTitle } from "./ModalHeader.tsx";
import type { AudioRouting } from "./useAudioRouting.ts";
import type { AppSettings } from "./useAppSettings.ts";

// Which microphone a take records through and where the sound comes out
// (docs/design.md, "The Microphone sheet"). Its own sheet, opened from the
// Record screen, because the microphone is chosen at the microphone: a
// lapel mic for an interview, the phone's own for a memo.
//
// Two lists, each starting on Automatic — the device's own choice, which is
// what the app did before there was a sheet. A chosen device that is not
// here is still listed, ticked and said to be away, so a headset left in a
// bag does not quietly forget its place. Where the browser cannot route its
// output (Safari, on every iPhone), the second list is a sentence that
// says where the choice is made instead. Choosing does not close the
// sheet: there are two choices in it.

type Props = {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  routing: AudioRouting;
  onClose: () => void;
};

export function MicrophoneSheet({ settings, update, routing, onClose }: Props) {
  const t = useT();
  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="mic-title"
      centered
      closeLabel={t("common.close")}
    >
      <SheetTitle
        titleId="mic-title"
        title={t("devices.title")}
        onClose={onClose}
      />
      <div className="flex flex-col gap-5 p-3">
        <DeviceList
          id="mic-in"
          title={t("devices.recordWith")}
          hint={
            routing.named ? t("devices.recordWithHint") : t("devices.unnamed")
          }
          devices={routing.inputs}
          named={routing.named}
          choice={settings.inputDevice}
          chosen={routing.input}
          now={routing.inputNow}
          onChoose={(next) => update("inputDevice", next)}
        />
        {routing.outputs.length > 0 || routing.showPicker ? (
          <DeviceList
            id="mic-out"
            title={t("devices.playThrough")}
            hint={t("devices.playThroughHint")}
            devices={routing.outputs}
            named
            choice={settings.outputDevice}
            chosen={routing.output}
            now={routing.outputNow}
            onChoose={(next) => update("outputDevice", next)}
            after={
              routing.showPicker && (
                <button
                  type="button"
                  onClick={routing.showPicker}
                  className="self-start rounded-md px-1 py-1 text-sm font-medium text-accent hover:underline"
                >
                  {t("devices.picker")}
                </button>
              )
            }
          />
        ) : (
          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
              {t("devices.playThrough")}
            </h3>
            <p className="text-sm text-muted">{t("devices.noOutputs")}</p>
          </section>
        )}
      </div>
    </Modal>
  );
}

function DeviceList({
  id,
  title,
  hint,
  devices,
  named,
  choice,
  chosen,
  now,
  onChoose,
  after,
}: {
  id: string;
  title: string;
  hint: string;
  devices: AudioDevice[];
  /** Whether the list is the device's whole answer. Before it is, a
   *  remembered choice cannot be said to be away. */
  named: boolean;
  choice: DeviceChoice | null;
  /** The choice, found among the devices — `null` when it is away. */
  chosen: AudioDevice | null;
  now: string | null;
  onChoose: (next: DeviceChoice | null) => void;
  after?: ReactNode;
}) {
  const t = useT();
  const away = choice !== null && chosen === null;
  return (
    <section className="flex flex-col gap-1.5">
      <h3
        id={`${id}-title`}
        className="text-xs font-semibold tracking-wide text-muted uppercase"
      >
        {title}
      </h3>
      <p className="text-xs text-muted">{hint}</p>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-title`}
        className="flex flex-col gap-1.5"
      >
        <Row
          on={choice === null}
          name={t("devices.automatic")}
          hint={
            now ? t("devices.now", { name: now }) : t("devices.automaticHint")
          }
          onClick={() => onChoose(null)}
        />
        {devices.map((d) => (
          <Row
            key={d.id}
            on={chosen?.id === d.id}
            name={d.name}
            onClick={() => onChoose(choiceOf(d))}
          />
        ))}
        {away && (
          <Row
            on
            name={
              named ? t("devices.absent", { name: choice.name }) : choice.name
            }
            hint={named ? t("devices.absentHint") : undefined}
            onClick={() => {}}
          />
        )}
      </div>
      {after}
    </section>
  );
}

function Row({
  on,
  name,
  hint,
  onClick,
}: {
  on: boolean;
  name: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        on
          ? "border-accent bg-accent/10"
          : "border-line bg-surface hover:bg-surface-2"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          on ? "border-accent bg-accent text-page-bg" : "border-line"
        }`}
      >
        {on && <CheckIcon className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-fg-bright">
          {name}
        </span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
