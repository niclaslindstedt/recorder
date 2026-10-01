// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { FLAC_LEVELS, WAV_DEPTHS } from "@niclaslindstedt/oss-framework/audio";
import {
  Button,
  CloudIcon,
  CloudOffIcon,
  CloudUploadIcon,
  CogIcon,
  ConfirmDialog,
  DatabaseIcon,
  DownloadIcon,
  FolderOpenIcon,
  InfoIcon,
  MicIcon,
  PaletteIcon,
  PlayIcon,
  RefreshIcon,
  ScrollTextIcon,
  SearchIcon,
  Section,
  SegmentedControl,
  ToggleRow,
  TrashIcon,
  UploadIcon,
} from "@niclaslindstedt/oss-framework/components";
import { EncryptionSettings } from "@niclaslindstedt/oss-framework/encryption";
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";
import type { PwaUpdate } from "@niclaslindstedt/oss-framework/pwa";

import { backupFileName, readBackupFile, saveBackup } from "./backup.ts";
import type { DemoDataToggle } from "./dev/useDemoData.ts";
import { useEncryptionLabels } from "./encryptionLabels.ts";
import { formatRate } from "./format.ts";
import { useT } from "./i18n/index.ts";
import { logStore } from "./log.ts";
import { LookPicker } from "./LookPicker.tsx";
import { mergeDocs } from "./merge.ts";
import { serializeDoc } from "./migrations.ts";
import { SelfHostedSettings } from "./SelfHostedSettings.tsx";
import { emptyDoc } from "./types.ts";
import { UpdateCheck } from "./UpdateCheck.tsx";
import {
  BITRATES,
  EXPORT_RATES,
  SKIP_SECONDS,
  VISUALIZERS,
  type AppSettings,
  type ExportFormat,
  type ThemeChoice,
  type VisualizerKind,
} from "./useAppSettings.ts";
import type { DocStore } from "./useDocStore.ts";
import {
  PROVIDER_NAMES,
  type SyncBackendId,
  type SyncEngine,
} from "./useSyncEngine.ts";

// One scrolling page of the things set once: appearance, the Record
// screen's spectrum, playback, what an export defaults to, the backend and
// its passphrase, the data, the developer knobs, and About. How a take is
// kept is the Quality sheet's and the spaces are the top bar's glyph. Every knob reads and writes the caller's
// settings store, so what is on screen is always what is persisted.

/** The sections, in the page's order, with the glyph each is known by —
 *  the index at the top and the section's own heading wear the same one. */
const SECTIONS = [
  { key: "appearance", Icon: PaletteIcon },
  { key: "recording", Icon: MicIcon },
  { key: "playback", Icon: PlayIcon },
  { key: "exportDefaults", Icon: DownloadIcon },
  { key: "sync", Icon: CloudIcon },
  { key: "data", Icon: DatabaseIcon },
  { key: "developer", Icon: ScrollTextIcon },
  { key: "about", Icon: InfoIcon },
] as const;

type Props = {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  store: DocStore;
  sync: SyncEngine;
  demoData: DemoDataToggle;
  onAdoptSpace: (slug: string) => void;
  onNotice: (message: string) => void;
  /** The update lifecycle, for About's "Check for updates". */
  pwa: PwaUpdate;
};

export function SettingsScreen({
  settings,
  update,
  store,
  sync,
  demoData,
  onAdoptSpace,
  onNotice,
  pwa,
}: Props) {
  const t = useT();
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [foundSpaces, setFoundSpaces] = useState<string[] | null>(null);
  const encryptionLabels = useEncryptionLabels(sync.providerName);

  const importBackup = async (file: File) => {
    try {
      const doc = await readBackupFile(file);
      const before = Object.keys(store.data.recordings).length;
      const merged = mergeDocs(store.data, doc);
      store.replaceAll(merged);
      onNotice(
        t("settings.imported", {
          count: String(Object.keys(merged.recordings).length - before),
        }),
      );
    } catch {
      onNotice(t("settings.importFailed"));
    }
  };

  const media = sync.media;

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {/* The page's contents as glyphs: one press to the section, so a
          setting is found by its picture rather than by scrolling past the
          rest. */}
      <nav aria-label={t("settings.index")} className="grid grid-cols-4 gap-2">
        {SECTIONS.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            aria-label={t("settings.jump", { section: t(`settings.${key}`) })}
            onClick={() =>
              document
                .getElementById(`settings-${key}`)
                ?.scrollIntoView({ block: "start" })
            }
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-line bg-surface px-1 py-2.5 transition-colors hover:border-accent/60 hover:bg-surface-2"
          >
            <Icon className="h-5 w-5 text-accent" />
            <span
              aria-hidden
              className="max-w-full truncate text-[0.6875rem] text-fg"
            >
              {t(`settings.short.${key}`)}
            </span>
          </button>
        ))}
      </nav>
      <div id="settings-appearance" className="scroll-mt-3">
        <Section
          title={t("settings.appearance")}
          icon={<PaletteIcon className="h-3.5 w-3.5" />}
        >
          <SegmentedControl<ThemeChoice>
            value={settings.theme}
            options={[
              { value: "light", label: t("settings.themeLight") },
              { value: "dark", label: t("settings.themeDark") },
              { value: "system", label: t("settings.themeSystem") },
            ]}
            onChange={(theme) => update("theme", theme)}
            ariaLabel={t("settings.theme")}
            fullWidth
          />
          {/* The looks for whichever sides can show: both while following
              the device, one by day and one by night. */}
          {settings.theme !== "dark" && (
            <Labelled
              label={
                settings.theme === "system" ? t("look.day") : t("look.label")
              }
            >
              <LookPicker
                side="light"
                value={settings.lookLight}
                onChange={(look) => update("lookLight", look)}
                label={
                  settings.theme === "system"
                    ? t("look.dayHint")
                    : t("look.label")
                }
              />
            </Labelled>
          )}
          {settings.theme !== "light" && (
            <Labelled
              label={
                settings.theme === "system" ? t("look.night") : t("look.label")
              }
            >
              <LookPicker
                side="dark"
                value={settings.lookDark}
                onChange={(look) => update("lookDark", look)}
                label={
                  settings.theme === "system"
                    ? t("look.nightHint")
                    : t("look.label")
                }
              />
            </Labelled>
          )}
        </Section>
      </div>

      {/* How a take is kept is not here: it varies between takes, so it is
          the Record screen's Quality sheet (docs/design.md, "Settings"). */}
      <div id="settings-recording" className="scroll-mt-3">
        <Section
          title={t("settings.recording")}
          icon={<MicIcon className="h-3.5 w-3.5" />}
        >
          <Labelled label={t("settings.visualizer")}>
            <SegmentedControl<VisualizerKind>
              value={settings.visualizer}
              options={VISUALIZERS.map((v) => ({
                value: v,
                label: t(`visualizer.${v}`),
              }))}
              onChange={(next) => update("visualizer", next)}
              ariaLabel={t("settings.visualizer")}
              fullWidth
            />
            <p className="text-xs text-muted">
              {t(`visualizer.hint.${settings.visualizer}`)}
            </p>
          </Labelled>
        </Section>
      </div>

      <div id="settings-playback" className="scroll-mt-3">
        <Section
          title={t("settings.playback")}
          icon={<PlayIcon className="h-3.5 w-3.5" />}
        >
          <Labelled label={t("settings.skipSeconds")}>
            <SegmentedControl<string>
              value={String(settings.skipSeconds)}
              options={SKIP_SECONDS.map((s) => ({
                value: String(s),
                label: `${s} ${t("common.seconds")}`,
              }))}
              onChange={(next) =>
                update(
                  "skipSeconds",
                  Number(next) as AppSettings["skipSeconds"],
                )
              }
              ariaLabel={t("settings.skipSeconds")}
              fullWidth
            />
          </Labelled>
        </Section>
      </div>

      <div id="settings-exportDefaults" className="scroll-mt-3">
        <Section
          title={t("settings.exportDefaults")}
          icon={<DownloadIcon className="h-3.5 w-3.5" />}
        >
          <p className="text-xs text-muted">
            {t("settings.exportDefaultsHint")}
          </p>
          <Labelled label={t("export.format")}>
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
          </Labelled>
          {settings.exportFormat === "wav" && (
            <Labelled label={t("export.depth")}>
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
            </Labelled>
          )}
          {settings.exportFormat === "flac" && (
            <Labelled label={t("export.level")}>
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
            </Labelled>
          )}
          {settings.exportFormat === "mp3" && (
            <Labelled label={t("export.bitrate")}>
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
            </Labelled>
          )}
          <Labelled label={t("export.rate")}>
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
          </Labelled>
          <ToggleRow
            label={t("export.mono")}
            hint={t("export.monoHint")}
            checked={settings.exportMono}
            onChange={(next) => update("exportMono", next)}
          />
        </Section>
      </div>

      <div id="settings-sync" className="scroll-mt-3">
        <Section
          title={t("settings.sync")}
          icon={<CloudIcon className="h-3.5 w-3.5" />}
        >
          <p className="text-xs text-muted">
            {sync.available.includes("icloud")
              ? t("settings.syncHintICloud")
              : t("settings.syncHint")}
          </p>
          <SegmentedControl<SyncBackendId>
            value={sync.backend}
            options={sync.available.map((id) => ({
              value: id,
              label: PROVIDER_NAMES[id],
              disabled: demoData.on && id !== sync.backend,
            }))}
            onChange={(next) => {
              if (next === sync.backend || demoData.on) return;
              if (next === "local") {
                sync.disconnect();
                return;
              }
              setBusy(true);
              void sync
                .connect(next)
                .catch((err: unknown) =>
                  onNotice(err instanceof Error ? err.message : String(err)),
                )
                .finally(() => setBusy(false));
            }}
            ariaLabel={t("settings.backend")}
            fullWidth
          />
          <p className="text-xs text-muted">
            {sync.connected
              ? t("settings.connected", { name: sync.providerName })
              : t("settings.localOnly")}
            {" · "}
            {sync.location.path}
          </p>
          {sync.connected && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={sync.saveNow} disabled={busy || !sync.dirty}>
                <span className="flex items-center justify-center gap-1.5">
                  <CloudUploadIcon className="h-4 w-4 shrink-0" />
                  {t("settings.saveNow")}
                </span>
              </Button>
              <Button onClick={() => void sync.reload()} disabled={busy}>
                <span className="flex items-center justify-center gap-1.5">
                  <RefreshIcon className="h-4 w-4 shrink-0" />
                  {t("settings.reload")}
                </span>
              </Button>
              <Button
                variant="danger"
                onClick={sync.disconnect}
                disabled={demoData.on}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <CloudOffIcon className="h-4 w-4 shrink-0" />
                  {t("settings.disconnect")}
                </span>
              </Button>
            </div>
          )}
          {sync.connected && (
            <div className="flex flex-col gap-1 rounded-md border border-line p-2 text-xs text-muted">
              <span className="font-medium text-fg">
                {t("settings.files", { name: sync.providerName })}
              </span>
              <span>
                {media.running
                  ? t("settings.filesRunning", {
                      done: String(media.done),
                      total: String(media.total),
                    })
                  : media.last
                    ? t("settings.filesLast", {
                        sent: String(media.last.pushed.length),
                        fetched: String(media.last.pulled.length),
                        removed: String(media.last.pruned.length),
                      })
                    : t("settings.filesIdle")}
              </span>
              {media.last && media.last.failed.length > 0 && (
                <span className="text-danger">
                  {t("settings.filesFailed", {
                    count: String(media.last.failed.length),
                  })}
                </span>
              )}
              <div>
                <Button onClick={media.run} disabled={media.running}>
                  <span className="flex items-center justify-center gap-1.5">
                    <RefreshIcon className="h-4 w-4 shrink-0" />
                    {t("settings.filesRun")}
                  </span>
                </Button>
              </div>
            </div>
          )}
          {sync.encryptable && sync.connected && (
            <EncryptionSettings
              encryption={sync.encryption}
              location={sync.providerName}
              labels={encryptionLabels}
              disabled={demoData.on}
              onChanged={() => void sync.reload()}
            />
          )}
          {sync.backend === "selfhosted" && (
            <SelfHostedSettings
              selfHosted={sync.selfHosted}
              onUnpaired={sync.disconnect}
              onNotice={onNotice}
            />
          )}
          {sync.connected && (
            <div className="flex flex-col gap-1">
              <Button
                onClick={() =>
                  void sync
                    .listSpaces()
                    .then((slugs) =>
                      setFoundSpaces(slugs.filter((s) => s !== store.slug)),
                    )
                    .catch((err: unknown) =>
                      onNotice(
                        err instanceof Error ? err.message : String(err),
                      ),
                    )
                }
              >
                <span className="flex items-center justify-center gap-1.5">
                  <SearchIcon className="h-4 w-4 shrink-0" />
                  {t("settings.listSpaces")}
                </span>
              </Button>
              {foundSpaces && (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-muted">
                    {t("spaces.onBackendHint")}
                  </span>
                  {foundSpaces.length === 0 ? (
                    <span className="text-xs text-muted">
                      {t("settings.noSpacesOnBackend")}
                    </span>
                  ) : (
                    foundSpaces.map((slug) => (
                      <div
                        key={slug}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-fg">{slug}</span>
                        <Button onClick={() => onAdoptSpace(slug)}>
                          <span className="flex items-center justify-center gap-1.5">
                            <FolderOpenIcon className="h-4 w-4 shrink-0" />
                            {t("spaces.open")}
                          </span>
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      <div id="settings-data" className="scroll-mt-3">
        <Section
          title={t("settings.data")}
          icon={<DatabaseIcon className="h-3.5 w-3.5" />}
        >
          <div className="flex flex-col gap-1">
            <Button
              onClick={() =>
                void saveBackup(store.data, store.slug).catch((err: unknown) =>
                  onNotice(
                    t("common.exportFailed", {
                      file: backupFileName(store.slug),
                      reason: err instanceof Error ? err.message : String(err),
                    }),
                  ),
                )
              }
            >
              <span className="flex items-center justify-center gap-1.5">
                <DownloadIcon className="h-4 w-4 shrink-0" />
                {t("settings.export")}
              </span>
            </Button>
            <p className="text-xs text-muted">{t("settings.exportHint")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="inline-flex">
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const input = e.currentTarget;
                  const file = input.files?.[0];
                  if (file) void importBackup(file);
                  input.value = "";
                }}
              />
              <span className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-fg hover:bg-surface-2">
                <UploadIcon className="h-4 w-4 shrink-0" />
                {t("settings.import")}
              </span>
            </label>
            <p className="text-xs text-muted">{t("settings.importHint")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="danger" onClick={() => setConfirmClear(true)}>
              <span className="flex items-center justify-center gap-1.5">
                <TrashIcon className="h-4 w-4 shrink-0" />
                {t("settings.deleteAll")}
              </span>
            </Button>
            <p className="text-xs text-muted">{t("settings.deleteAllHint")}</p>
          </div>
        </Section>
      </div>

      <div id="settings-developer" className="scroll-mt-3">
        <Section
          title={t("settings.developer")}
          icon={<ScrollTextIcon className="h-3.5 w-3.5" />}
        >
          <ToggleRow
            label={t("settings.devMode")}
            hint={t("settings.devModeHint")}
            checked={settings.devMode}
            onChange={(next) => {
              update("devMode", next);
              if (!next && demoData.on) demoData.setOn(false);
            }}
          />
          {settings.devMode && (
            <>
              <ToggleRow
                label={t("settings.demoData")}
                hint={t("settings.demoDataHint")}
                checked={demoData.on}
                onChange={(next) => {
                  demoData.setOn(next);
                  onNotice(
                    next ? t("settings.demoDataOn") : t("settings.demoDataOff"),
                  );
                }}
              />
              <ToggleRow
                label={t("settings.captureLogs")}
                hint={t("settings.captureLogsHint")}
                checked={settings.captureLogs}
                onChange={(next) => {
                  update("captureLogs", next);
                  logStore.setCaptureEnabled(next);
                }}
              />
              <p className="text-xs text-muted">
                {t("settings.documentSize")}:{" "}
                {serializeDoc(store.data).length.toLocaleString()} bytes
              </p>
              <div className="max-h-64 overflow-auto rounded-md border border-line p-2">
                <LogViewer store={logStore} />
              </div>
            </>
          )}
        </Section>
      </div>

      <div id="settings-about" className="scroll-mt-3">
        <Section
          title={t("settings.about")}
          icon={<InfoIcon className="h-3.5 w-3.5" />}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">{t("settings.version")}</dt>
            <dd className="text-fg">{__APP_VERSION__}</dd>
            <dt className="text-muted">{t("settings.build")}</dt>
            <dd className="text-fg">{__BUILD_LABEL__}</dd>
          </dl>
          {!__SHELL_BUILD__ && <UpdateCheck pwa={pwa} />}
          <p className="text-xs leading-snug text-muted">
            {t("settings.privacy")}
          </p>
        </Section>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title={t("settings.deleteAllConfirm")}
        description={t("settings.deleteAllHint")}
        confirmLabel={t("common.delete")}
        tone="danger"
        labels={{ cancel: t("common.cancel"), close: t("common.close") }}
        onConfirm={() => {
          store.replaceAll(emptyDoc());
          setConfirmClear(false);
          onNotice(t("settings.deleted"));
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <span className="hidden">
        <CogIcon className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function Labelled({
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
