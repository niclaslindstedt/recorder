// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useState } from "react";

import {
  Button,
  CheckIcon,
  CloudOffIcon,
  ConfirmDialog,
  LockIcon,
  Modal,
  PlusIcon,
  RefreshIcon,
} from "@niclaslindstedt/oss-framework/components";
import { QrCode } from "@niclaslindstedt/oss-framework/qr";
import {
  describeStorageError,
  type SelfHostedDevice,
} from "@niclaslindstedt/oss-framework/storage";

import { useT } from "./i18n/index.ts";
import { withoutPairing } from "./selfHosted.ts";
import type { SelfHosted } from "./useSelfHosted.ts";

// What Settings shows under the storage picker while the reader's own server
// is the backend: which server, and the three things only this device can do
// for the account — hand its keys to a new device (a QR), approve a device
// that paired with a server-made code (by matching the safety code), and
// replace the recovery key. Unpairing erases this device's keys.
//
// Every device operation is the framework client's; the keys never pass
// through the server in a form it can read.

type Pending = SelfHostedDevice & { safetyCode: string };

type Props = {
  selfHosted: SelfHosted;
  /** Drop back to this device only (the engine's `disconnect`). */
  onUnpaired: () => void;
  onNotice: (message: string) => void;
};

const LINE =
  "min-w-0 rounded-md border border-line bg-surface-2 px-2 py-2 font-figures text-sm break-all text-fg-bright";

export function SelfHostedSettings({
  selfHosted,
  onUnpaired,
  onNotice,
}: Props) {
  const t = useT();
  const { client, phase, server } = selfHosted;
  const [pending, setPending] = useState<Pending[]>([]);
  const [addDevice, setAddDevice] = useState<{
    payload: string;
    expiresAt: number;
  } | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"unpair" | "recovery" | null>(null);
  const [busy, setBusy] = useState(false);

  const act = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      try {
        await action();
      } catch (err) {
        onNotice(describeStorageError(err));
      } finally {
        setBusy(false);
      }
    },
    [onNotice],
  );

  const checkApprovals = useCallback(
    () => act(async () => setPending(await client.pendingDevices())),
    [act, client],
  );

  useEffect(() => {
    if (phase === "ready") void checkApprovals();
  }, [phase, checkApprovals]);

  return (
    <div className="flex flex-col gap-3" data-testid="selfhosted-settings">
      {server && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted">{t("selfHosted.server")}</dt>
          <dd className="min-w-0 break-all text-fg">
            {server.name ? `${server.name} · ` : ""}
            {server.url}
          </dd>
        </dl>
      )}

      {phase === "unreachable" && (
        <p className="text-xs text-muted">{t("selfHosted.unreachable")}</p>
      )}
      {phase === "needs-keys" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">{t("selfHosted.needsKeys")}</p>
          <Button onClick={() => selfHosted.requestConnect()}>
            <span className="flex items-center justify-center gap-1.5">
              <LockIcon className="h-4 w-4 shrink-0" />
              {t("selfHosted.finish")}
            </span>
          </Button>
        </div>
      )}
      {selfHosted.error && phase !== "ready" && (
        <p className="text-xs text-danger">{selfHosted.error}</p>
      )}

      {phase === "ready" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                void act(async () =>
                  setAddDevice(
                    await client.addDevicePayload({
                      // A phone's camera opens this app with the code in it.
                      appUrl: withoutPairing(window.location.href),
                    }),
                  ),
                )
              }
            >
              <span className="flex items-center justify-center gap-1.5">
                <PlusIcon className="h-4 w-4 shrink-0" />
                {t("selfHosted.addDevice")}
              </span>
            </Button>
            <Button disabled={busy} onClick={() => setConfirm("recovery")}>
              <span className="flex items-center justify-center gap-1.5">
                <RefreshIcon className="h-4 w-4 shrink-0" />
                {t("selfHosted.newRecovery")}
              </span>
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-fg">
              {t("selfHosted.approvals")}
            </p>
            {pending.length === 0 ? (
              <p className="text-xs text-muted">
                {t("selfHosted.noApprovals")}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted">
                  {t("selfHosted.approvalsHint")}
                </p>
                <ul className="flex flex-col gap-2">
                  {pending.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 rounded-md border border-line px-2 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-fg">{d.name}</p>
                        <p className="font-figures text-sm font-bold text-fg-bright tabular-nums">
                          {d.safetyCode}
                        </p>
                      </div>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await client.approveDevice(d.id);
                            setPending(await client.pendingDevices());
                          })
                        }
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <CheckIcon className="h-4 w-4 shrink-0" />
                          {t("selfHosted.approve")}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div>
              <Button disabled={busy} onClick={() => void checkApprovals()}>
                <span className="flex items-center justify-center gap-1.5">
                  <RefreshIcon className="h-4 w-4 shrink-0" />
                  {t("selfHosted.checkApprovals")}
                </span>
              </Button>
            </div>
          </div>
        </>
      )}

      {phase !== "signed-out" && phase !== "loading" && (
        <div>
          <Button variant="danger" onClick={() => setConfirm("unpair")}>
            <span className="flex items-center justify-center gap-1.5">
              <CloudOffIcon className="h-4 w-4 shrink-0" />
              {t("selfHosted.unpair")}
            </span>
          </Button>
        </div>
      )}

      {addDevice && (
        <AddDeviceModal
          {...addDevice}
          onClose={() => {
            setAddDevice(null);
            void checkApprovals();
          }}
        />
      )}

      {recoveryKey && (
        <Modal
          open
          onClose={() => setRecoveryKey(null)}
          labelledBy="recovery-title"
          closeLabel={t("common.close")}
          centered
          size="max-w-md"
        >
          <div className="flex flex-col gap-3 px-3 py-4">
            <h2 id="recovery-title" className="text-base font-bold text-fg">
              {t("selfHosted.recoveryTitle")}
            </h2>
            <p className="text-xs text-muted">{t("selfHosted.recovery")}</p>
            <code className={LINE}>{recoveryKey}</code>
            <Button onClick={() => setRecoveryKey(null)}>
              {t("selfHosted.done")}
            </Button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === "unpair"
            ? t("selfHosted.unpairConfirm")
            : t("selfHosted.newRecoveryConfirm")
        }
        description={
          confirm === "unpair"
            ? t("selfHosted.unpairHint")
            : t("selfHosted.newRecoveryHint")
        }
        confirmLabel={
          confirm === "unpair"
            ? t("selfHosted.unpair")
            : t("selfHosted.newRecovery")
        }
        tone={confirm === "unpair" ? "danger" : undefined}
        labels={{ cancel: t("common.cancel"), close: t("common.close") }}
        onConfirm={() => {
          const which = confirm;
          setConfirm(null);
          void act(async () => {
            if (which === "unpair") {
              await selfHosted.unpair();
              onUnpaired();
            } else {
              setRecoveryKey(await client.regenerateRecoveryKey());
            }
          });
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function AddDeviceModal({
  payload,
  expiresAt,
  onClose,
}: {
  payload: string;
  expiresAt: number;
  onClose: () => void;
}) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.round((expiresAt - now) / 1000));
  // The code's lifetime as it was made, for the sentence under the QR.
  const [minutes] = useState(() =>
    Math.max(1, Math.round((expiresAt - Date.now()) / 60_000)),
  );

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="add-device-title"
      closeLabel={t("common.close")}
      centered
      size="max-w-sm"
    >
      <div className="flex flex-col items-center gap-3 px-3 py-4">
        <h2 id="add-device-title" className="text-base font-bold text-fg">
          {t("selfHosted.addDeviceTitle")}
        </h2>
        <div className="rounded-xl bg-white p-2" data-testid="add-device-qr">
          <QrCode
            value={payload}
            size={240}
            label={t("selfHosted.addDevice")}
          />
        </div>
        <p className="text-center text-xs text-muted">
          {left === 0
            ? t("selfHosted.expired")
            : t("selfHosted.expires", {
                time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`,
              })}
        </p>
        <p className="text-xs text-muted">
          {t("selfHosted.addDeviceHint", { minutes: String(minutes) })}
        </p>
        <input
          readOnly
          value={payload}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full min-w-0 rounded-md border border-line bg-surface-2 px-2 py-1.5 font-figures text-xs text-fg"
          data-testid="add-device-payload"
        />
        <Button onClick={onClose}>{t("selfHosted.done")}</Button>
      </div>
    </Modal>
  );
}
