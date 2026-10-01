// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  IconButton,
  SpinnerIcon,
  ToastViewport,
  createToastStore,
} from "@niclaslindstedt/oss-framework/components";
import { EncryptionGate } from "@niclaslindstedt/oss-framework/encryption";
import { useSwipeNav } from "@niclaslindstedt/oss-framework/hooks";
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";
import { Glyph } from "@niclaslindstedt/oss-framework/glyphs";
import { NamespacesModal } from "@niclaslindstedt/oss-framework/namespaces";
import { UpdateToast, usePwaUpdate } from "@niclaslindstedt/oss-framework/pwa";
import {
  SyncDetailsModal,
  SyncStatus,
} from "@niclaslindstedt/oss-framework/sync";
import {
  useApplyTheme,
  useThemeColorMeta,
} from "@niclaslindstedt/oss-framework/theme";

import { createBlobStore, type BlobStore } from "./app/blobStore.ts";
import {
  BottomNav,
  isNavTab,
  screenEnter,
  TABS,
  type NavTab,
  type ScreenEnter,
  type Tab,
} from "./app/BottomNav.tsx";
import { demoBackendModule, useDemoData } from "./app/dev/useDemoData.ts";
import { useEncryptionLabels } from "./app/encryptionLabels.ts";
import { ExportModal } from "./app/ExportModal.tsx";
import { FolderPicker } from "./app/FolderPicker.tsx";
import { SpacesIcon } from "./app/icons.tsx";
import { useT } from "./app/i18n/index.ts";
import { LibraryScreen, type LibraryView } from "./app/LibraryScreen.tsx";
import { logStore } from "./app/log.ts";
import { appearanceFor, usePrefersDark } from "./app/look.ts";
import { PlayerModal } from "./app/PlayerModal.tsx";
import { cacheIdForBase } from "./app/pwa.ts";
import { RecordScreen } from "./app/RecordScreen.tsx";
import { SelfHostedConnectModal } from "./app/SelfHostedConnectModal.tsx";
import { SettingsScreen } from "./app/SettingsScreen.tsx";
import { SidePanel } from "./app/SidePanel.tsx";
import { TopBar } from "./app/TopBar.tsx";
import type { Recording } from "./app/types.ts";
import { useAppSettings } from "./app/useAppSettings.ts";
import { AudioRoutingContext, useAudioRouting } from "./app/useAudioRouting.ts";
import { createIdbDocBackend, useDocStore } from "./app/useDocStore.ts";
import { useNamespaces } from "./app/useNamespaces.ts";
import { useDesk, useStand } from "./app/useShape.ts";
import { useSyncEngine } from "./app/useSyncEngine.ts";
import { status } from "./output.ts";

// A local-first voice recorder built from the framework's shared surface.
// The app owns the document store, the blob store, the folder tree and the
// three screens; the framework supplies the microphone, the meter, the
// encoders, the theme engine, the storage adapters behind sync and the PWA
// update lifecycle.
//
// Two shells over the same screens. On a phone the two destinations sit on
// the bottom bar; on a desk (`useDesk`) they sit on the top bar and Settings
// slides in over the right-hand edge (`SidePanel.tsx`). The player and the
// export sheet are modals on both: full-screen on the phone, a card on the
// desk.

const toasts = createToastStore();

/** A tap on a toast, anywhere but its own buttons, is its ✕: the card is
 *  the framework's, so the press is handed to the dismiss button it draws
 *  last, which lets the card leave the way it always does. */
function dismissToast(e: MouseEvent) {
  const target = e.target as Element | null;
  if (!target || target.closest("button")) return;
  const card = target.closest(".app-toasts [data-kind]");
  const close = card?.querySelector<HTMLButtonElement>(
    ":scope > button:last-of-type",
  );
  close?.click();
}
const idbBackend = createIdbDocBackend();

export function App() {
  const t = useT();
  const { settings, update } = useAppSettings();
  // The microphone and the output chosen on the Microphone sheet, for the
  // Record screen and every player.
  const routing = useAudioRouting(settings.inputDevice, settings.outputDevice);
  const prefersDark = usePrefersDark();
  const appearance = useMemo(
    () =>
      appearanceFor(
        {
          theme: settings.theme,
          lookLight: settings.lookLight,
          lookDark: settings.lookDark,
        },
        prefersDark,
      ),
    [settings.theme, settings.lookLight, settings.lookDark, prefersDark],
  );
  useApplyTheme(appearance);
  // The browser's own chrome (the address bar, the task switcher) wears the
  // page's colour too.
  useThemeColorMeta(appearance.theme);

  // Developer "Demo data" takeover: while the toggle is on, an in-memory
  // backend seeded with invented recordings replaces IndexedDB for the
  // session, and the sync engine is paused (see `useDemoData`).
  const demo = useDemoData();
  const spaces = useNamespaces(t("spaces.personal"));
  const slug = spaces.activeSlug;
  const demoStores = useMemo(() => {
    const module = demoBackendModule();
    return demo.on && module ? module.createDemoBackend() : null;
  }, [demo.on]);
  const backend = demoStores?.docs ?? idbBackend;
  const store = useDocStore(slug, backend);
  const blobs: BlobStore = useMemo(
    () => demoStores?.blobs ?? createBlobStore(slug),
    [demoStores, slug],
  );
  const sync = useSyncEngine(store, blobs, demo.on);
  const encryptionLabels = useEncryptionLabels(sync.providerName);

  // Which files are on this device, by name — re-read after a save, a space
  // switch and every sweep.
  const [present, setPresent] = useState<ReadonlySet<string>>(new Set());
  const [filesVersion, setFilesVersion] = useState(0);
  useEffect(() => {
    let live = true;
    void blobs.sizes().then((sizes) => {
      if (!live) return;
      setPresent(new Set(sizes.keys()));
      setFilesVersion((v) => v + 1);
    });
    return () => {
      live = false;
    };
  }, [blobs, sync.media.version, store.editCount]);

  const desk = useDesk();
  // A phone on its side stands the Record screen's instrument beside its
  // controls, which wants the whole width rather than the reading column.
  const stand = useStand();
  const [tab, setTab] = useState<Tab>("record");
  const [home, setHome] = useState<NavTab>("record");
  const [enter, setEnter] = useState<ScreenEnter>("none");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<LibraryView>({ kind: "all" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [spacesOpen, setSpacesOpen] = useState(false);
  // A take is running or waiting to be named: the Record screen is the only
  // place on offer until it is saved or discarded (docs/design.md, "The
  // shell") — leaving it would end the take.
  const [capturing, setCapturing] = useState(false);
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  // The clock the list's "Today" and the trash's window are read against:
  // re-read on every edit and every screen change, which is as often as it
  // can be seen to be wrong.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => setNow(new Date()), [store.editCount, tab]);

  const show = useCallback(
    (next: Tab) => {
      setEnter(screenEnter(tab, next));
      if (isNavTab(next)) setHome(next);
      setTab(next);
    },
    [tab],
  );
  const toggleSettings = useCallback(() => {
    if (desk) {
      setSettingsOpen((open) => !open);
      return;
    }
    const target: Tab = tab === "settings" ? home : "settings";
    setEnter(screenEnter(tab, target));
    setTab(target);
  }, [desk, tab, home]);
  useEffect(() => {
    if (!desk || tab !== "settings") return;
    setTab(home);
    setSettingsOpen(true);
  }, [desk, tab, home]);

  const main = useRef<HTMLElement>(null);
  const swipe = useCallback(
    (direction: 1 | -1) => {
      if (!isNavTab(tab)) {
        setEnter(screenEnter(tab, home));
        setTab(home);
        return;
      }
      const next = TABS[TABS.indexOf(tab) + direction];
      if (next !== undefined) show(next);
    },
    [tab, home, show],
  );
  useSwipeNav(main, swipe, { enabled: !desk && !capturing });

  useEffect(() => {
    logStore.setCaptureEnabled(settings.captureLogs);
  }, [settings.captureLogs]);

  const navShown = !desk && !capturing;

  const notice = useCallback((message: string) => {
    toasts.clear();
    toasts.push({ message, kind: "success", durationMs: 2500 });
  }, []);

  useEffect(() => {
    if (store.writeFailures === 0) return;
    toasts.clear();
    toasts.push({
      message: t("settings.importFailed"),
      kind: "danger",
      durationMs: 8000,
    });
  }, [store.writeFailures, t]);

  const pwa = usePwaUpdate({
    base: import.meta.env.BASE_URL,
    cacheId: cacheIdForBase(import.meta.env.BASE_URL),
    enabled: !import.meta.env.DEV && !__SHELL_BUILD__,
  });
  useEffect(() => {
    if (pwa.needRefresh) status(`Update ready: ${pwa.incomingVersion ?? "?"}`);
  }, [pwa.needRefresh, pwa.incomingVersion]);

  // A finished take: the bytes first, then the record, so a record never
  // names a file that is not there.
  const saveTake = useCallback(
    async (recording: Recording, blob: Blob) => {
      await blobs.writeBlob(recording.fileName, blob);
      store.saveRecording(recording);
    },
    [blobs, store],
  );

  const trash = useCallback(
    (id: string) => {
      store.trashRecording(id);
      if (openId === id) setOpenId(null);
      notice(t("library.deleted"));
    },
    [store, openId, notice, t],
  );

  const openExport = useCallback(
    (id: string) => {
      const r = store.data.recordings[id];
      if (!r) return;
      void blobs.readBlob(r.fileName).then((blob) => {
        if (!blob) {
          notice(t("player.missing"));
          return;
        }
        setExportBlob(blob);
        setExportId(id);
      });
    },
    [blobs, store.data.recordings, notice, t],
  );

  const locale =
    typeof navigator !== "undefined" ? navigator.language : "en-US";
  const open = openId ? store.data.recordings[openId] : undefined;
  const exporting = exportId ? store.data.recordings[exportId] : undefined;

  // The space glyph: the active space's own symbol in its own colour, so
  // the button is the answer to "which space am I in?" without a label.
  const spaceButton = (
    <IconButton
      label={t("spaces.current", { name: spaces.active.name })}
      onClick={() => setSpacesOpen(true)}
      className="border-transparent"
      style={spaces.active.color ? { color: spaces.active.color } : undefined}
    >
      {spaces.active.glyph ? (
        <Glyph name={spaces.active.glyph} className="h-5 w-5" />
      ) : (
        <SpacesIcon className="h-5 w-5" />
      )}
    </IconButton>
  );

  const recordScreen = (
    <RecordScreen
      data={store.data}
      store={store}
      settings={settings}
      update={update}
      folderId={view.kind === "folder" ? view.folderId : null}
      locale={locale}
      onSave={saveTake}
      onNotice={notice}
      onCaptureChange={setCapturing}
    />
  );
  const libraryScreen = (
    <LibraryScreen
      data={store.data}
      store={store}
      view={view}
      onView={setView}
      present={present}
      locale={locale}
      now={now}
      onOpen={setOpenId}
      onFavorite={(id, favorite) => store.patchRecording(id, { favorite })}
      onTrash={trash}
      onRestore={(id) => {
        store.restoreRecording(id);
        notice(t("library.restored"));
      }}
      onPurge={(id) => store.purgeRecording(id)}
      onMove={setMoveId}
      onExport={openExport}
      onNotice={notice}
    />
  );
  const settingsScreen = (
    <SettingsScreen
      settings={settings}
      update={update}
      store={store}
      sync={sync}
      demoData={demo}
      onAdoptSpace={(s) => {
        spaces.adopt(s, s);
        spaces.switchTo(s);
        setView({ kind: "all" });
      }}
      onNotice={notice}
      pwa={pwa}
    />
  );

  const shell = (
    <div className="flex h-full flex-col bg-page-bg text-fg">
      <TopBar
        active={tab}
        onOpenSettings={toggleSettings}
        settingsOpen={desk && settingsOpen}
        onSelect={desk && !capturing ? show : undefined}
        spaceSlot={spaceButton}
        syncSlot={
          sync.backend !== "local" ? (
            <SyncStatus
              providerName={sync.providerName}
              status={sync.status}
              dirty={sync.dirty}
              offline={sync.offline}
              onOpenDetails={() => setSyncDetailsOpen(true)}
              labels={{ syncedTo: (name) => t("sync.syncedTo", { name }) }}
            />
          ) : undefined
        }
      />

      <main
        ref={main}
        className="app-main relative min-h-0 flex-1 overflow-clip"
      >
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <div
            key={tab}
            data-enter={enter}
            className={`app-screen mx-auto flex min-h-full flex-col ${
              stand && tab === "record"
                ? "max-w-none"
                : `max-w-2xl ${desk ? "lg:max-w-3xl" : ""}`
            }`}
          >
            {tab === "record" && recordScreen}
            {tab === "library" && libraryScreen}
            {tab === "settings" && settingsScreen}
          </div>
        </div>

        {desk && settingsOpen && (
          <SidePanel
            title={t("nav.settings")}
            onClose={() => setSettingsOpen(false)}
          >
            {settingsScreen}
          </SidePanel>
        )}
      </main>

      <div className="app-update-slot relative z-[60]">
        {pwa.needRefresh && reloading ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-x-3 bottom-3 mx-auto flex max-w-md items-center gap-3 rounded-sm border border-line bg-surface px-3 py-2.5 text-fg shadow-md"
          >
            <SpinnerIcon className="h-5 w-5 animate-spin text-accent" />
            <span className="text-sm font-medium">{t("update.reload")}</span>
          </div>
        ) : (
          <UpdateToast
            needRefresh={pwa.needRefresh}
            incomingVersion={pwa.incomingVersion}
            onReload={() => {
              setReloading(true);
              pwa.reload();
            }}
            onDismiss={() => pwa.dismiss()}
            labels={{
              ready: t("update.available"),
              action: t("update.reload"),
              dismiss: t("common.close"),
            }}
          />
        )}
      </div>

      {/* The toasts stand on the bottom bar, where the eye already is after
          a tap and clear of the top bar's glyphs — above the update prompt
          when one is up, on the screen's foot when there is no bar. A tap
          anywhere on one puts it away; the ✕ is only the visible half. */}
      <div className="app-toast-slot relative z-[70]" onClick={dismissToast}>
        <ToastViewport
          store={toasts}
          labels={{ dismiss: t("common.close") }}
          className={`app-toasts pointer-events-none absolute inset-x-0 flex flex-col items-center gap-2 px-4 ${
            pwa.needRefresh
              ? "bottom-20"
              : navShown
                ? "bottom-3"
                : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
          }`}
        />
      </div>

      {navShown && <BottomNav active={tab} onSelect={show} />}

      {open && (
        <PlayerModal
          recording={open}
          store={store}
          blobs={blobs}
          filesVersion={filesVersion}
          locale={locale}
          skipSeconds={settings.skipSeconds}
          onExport={() => openExport(open.id)}
          onMove={() => setMoveId(open.id)}
          folderName={
            open.folderId
              ? (store.data.folders[open.folderId]?.name ?? null)
              : null
          }
          onTrash={() => trash(open.id)}
          onNotice={notice}
          onClose={() => setOpenId(null)}
        />
      )}

      {exporting && exportBlob && (
        <ExportModal
          recording={exporting}
          blob={exportBlob}
          locale={locale}
          settings={settings}
          update={update}
          onNotice={notice}
          onClose={() => {
            setExportId(null);
            setExportBlob(null);
          }}
        />
      )}

      {moveId && (
        <FolderPicker
          mode="choose"
          data={store.data}
          store={store}
          title={t("library.move")}
          noneLabel={t("record.noFolder")}
          value={store.data.recordings[moveId]?.folderId ?? null}
          onChoose={(folderId) => {
            store.patchRecording(moveId, { folderId });
            setMoveId(null);
          }}
          onClose={() => setMoveId(null)}
        />
      )}

      <NamespacesModal
        open={spacesOpen}
        onClose={() => setSpacesOpen(false)}
        namespaces={spaces.list}
        activeNamespace={slug}
        onSwitch={(next) => {
          spaces.switchTo(next);
          setView({ kind: "all" });
        }}
        onCreate={(name, appearance) => {
          spaces.create(name, appearance);
          setView({ kind: "all" });
        }}
        onRename={spaces.rename}
        onSetAppearance={spaces.setAppearance}
        onRemove={async (s) => {
          spaces.remove(s);
          await store.dropSpace(s);
          notice(t("spaces.forgot"));
        }}
        labels={{
          heading: t("spaces.heading"),
          blurb: t("spaces.blurb"),
          newAction: t("spaces.newAction"),
          namePlaceholder: t("spaces.namePlaceholder"),
          nameLabel: t("spaces.nameLabel"),
          create: t("spaces.create"),
          nameRequired: t("spaces.nameRequired"),
          colorLabel: t("spaces.colorLabel"),
          glyphLabel: t("spaces.glyphLabel"),
          glyphNone: t("spaces.glyphNone"),
          save: t("common.save"),
          cancel: t("common.cancel"),
          renameAction: t("spaces.renameAction"),
          deleteAction: t("spaces.deleteAction"),
          delete: t("common.delete"),
          deleteConfirm: (name) => t("spaces.deleteConfirm", { name }),
          switchTo: (name) => t("spaces.switchTo", { name }),
          defaultBadge: t("spaces.defaultBadge"),
          close: t("common.close"),
        }}
      />

      <SyncDetailsModal
        open={syncDetailsOpen}
        providerName={sync.providerName}
        backendKind="cloud"
        location={sync.location}
        encrypted={sync.encryptable && sync.encryption.encrypted}
        status={sync.status}
        statusDetail={sync.statusDetail}
        dirty={sync.dirty}
        offline={sync.offline}
        onSaveNow={sync.saveNow}
        onReload={() => void sync.reload()}
        onReconnect={sync.reconnect}
        onCheckConnection={sync.checkConnection}
        logPanel={settings.devMode ? <LogViewer store={logStore} /> : undefined}
        onClose={() => setSyncDetailsOpen(false)}
      />

      {sync.encryptable && (
        <EncryptionGate
          encryption={sync.encryption}
          location={sync.providerName}
          labels={encryptionLabels}
          paused={demo.on}
        />
      )}

      {sync.selfHosted.connectRequest && (
        <SelfHostedConnectModal
          selfHosted={sync.selfHosted}
          initialPayload={sync.selfHosted.connectRequest.payload}
          onConnected={sync.adoptSelfHosted}
          onClose={sync.selfHosted.closeConnect}
        />
      )}
    </div>
  );
  return (
    <AudioRoutingContext.Provider value={routing}>
      {shell}
    </AudioRoutingContext.Provider>
  );
}
