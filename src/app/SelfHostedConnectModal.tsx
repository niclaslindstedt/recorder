// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState } from "react";

import {
  LABELED_FIELD_CLASS,
  Modal,
} from "@niclaslindstedt/oss-framework/components";
import { canScanQrCode } from "@niclaslindstedt/oss-framework/qr";
import { describeStorageError } from "@niclaslindstedt/oss-framework/storage";

import { useT } from "./i18n/index.ts";
import { ModalHeader } from "./ModalHeader.tsx";
import {
  checkPairing,
  defaultDeviceName,
  pairingHintKey,
  scanPairing,
  scanProblemKey,
} from "./selfHosted.ts";
import type { SelfHosted } from "./useSelfHosted.ts";

// Connecting a device to the reader's own server, one step at a time:
//
//   code      — the pairing code, pasted, scanned with the phone app's camera
//               (Scan, only where the shell offers a scanner) or handed over
//               by an app link, and what this device will be called in the
//               server's device list;
//   new       — the account's first device: make the account key, here;
//   recovery  — show the recovery key, once, and hold the sheet open until
//               the reader says it is stored (it is the only way back);
//   existing  — the account has keys on another device: wait for that device
//               to approve this one (both show the same safety code), or take
//               the recovery key instead.
//
// A code another device made carries the account key sealed inside it, so
// that path goes straight from `code` to connected. Every step's action is
// the header's button, like every other sheet in the app.

type Step = "code" | "new" | "recovery" | "existing";

type Props = {
  selfHosted: SelfHosted;
  /** A code an app link opened the page with. */
  initialPayload: string;
  /** Adopt the backend once the device is ready (the engine's
   *  `adoptSelfHosted`). */
  onConnected: () => void;
  onClose: () => void;
};

const TEXT_CLASS =
  "w-full min-w-0 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent";

export function SelfHostedConnectModal({
  selfHosted,
  initialPayload,
  onConnected,
  onClose,
}: Props) {
  const t = useT();
  const { client } = selfHosted;
  const [step, setStep] = useState<Step>(
    // Closed halfway through last time: pick up where it stood.
    selfHosted.phase === "needs-keys" ? "existing" : "code",
  );
  const [payload, setPayload] = useState(initialPayload);
  const [deviceName, setDeviceName] = useState(() =>
    defaultDeviceName(navigator.userAgent),
  );
  const [recoveryKey, setRecoveryKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [typedKey, setTypedKey] = useState("");
  const [safetyCode, setSafetyCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const waiting = useRef<AbortController | null>(null);

  const check = checkPairing(payload);
  // Only the phone app's shell offers a scanner; it says so before the page
  // loads, so this holds for the sheet's life. Everywhere else: paste.
  const canScan = canScanQrCode();

  async function finish(): Promise<void> {
    await selfHosted.activate();
    onConnected();
    onClose();
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error && !("status" in err)
          ? err.message
          : describeStorageError(err),
      );
    } finally {
      setBusy(false);
    }
  }

  async function connect(code: string): Promise<void> {
    if (!checkPairing(code).ok) return;
    const state = await client.pair(code.trim(), {
      name: deviceName.trim() || defaultDeviceName(navigator.userAgent),
      platform: "web",
    });
    if (state === "ready") return finish();
    setStep((await client.accountHasKeys()) ? "existing" : "new");
  }

  const pair = () => run(() => connect(payload));

  // A scanned code takes the pasted one's path: into the field, then
  // connected at once — the tap on Scan was the reader's go-ahead.
  const scan = () =>
    run(async () => {
      const outcome = await scanPairing({
        hint: t("selfHosted.scanHint"),
        cancel: t("common.cancel"),
      });
      if (outcome.kind === "cancelled") return;
      if (outcome.kind === "code") {
        setPayload(outcome.code);
        return connect(outcome.code);
      }
      throw new Error(t(scanProblemKey(outcome)));
    });

  const makeKeys = () =>
    run(async () => {
      setRecoveryKey(await client.createAccountKeys());
      setStep("recovery");
    });

  const recover = () =>
    run(async () => {
      try {
        await client.recover(typedKey);
      } catch {
        throw new Error(t("selfHosted.recoverFailed"));
      }
      await finish();
    });

  // Waiting for another device: show the safety code both screens must agree
  // on, and poll until the approval lands (or the sheet closes).
  useEffect(() => {
    if (step !== "existing") return;
    const abort = new AbortController();
    waiting.current = abort;
    void (async () => {
      try {
        setSafetyCode(await client.safetyCode());
        const state = await client.waitForApproval({ signal: abort.signal });
        if (state === "ready" && !abort.signal.aborted) await finish();
      } catch (err) {
        if (!abort.signal.aborted) setError(describeStorageError(err));
      }
    })();
    return () => abort.abort();
    // `finish` closes over props that do not change while the sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, client]);

  const close = () => {
    waiting.current?.abort();
    // Paired but not finished: let the rest of the app know where it stands.
    void selfHosted.activate();
    onClose();
  };

  const header = {
    code: {
      title: t("selfHosted.title"),
      save: t("selfHosted.connect"),
      onSave: pair,
      disabled: busy || !check.ok,
    },
    new: {
      title: t("selfHosted.newAccountTitle"),
      save: t("selfHosted.makeKeys"),
      onSave: makeKeys,
      disabled: busy,
    },
    recovery: {
      title: t("selfHosted.recoveryTitle"),
      save: t("selfHosted.done"),
      onSave: () => void run(finish),
      disabled: busy || !saved,
    },
    existing: {
      title: t("selfHosted.existingTitle"),
      save: t("selfHosted.recover"),
      onSave: recover,
      disabled: busy || typedKey.trim().length < 20,
    },
  }[step];

  const codeProblem =
    payload.trim() === "" || check.ok
      ? null
      : check.reason === "invite"
        ? t("selfHosted.codeInvite")
        : check.reason === "invalid" && check.message
          ? t("selfHosted.codeInvalid", { reason: check.message })
          : t("selfHosted.codeInvalidPlain");

  return (
    <Modal
      open
      onClose={close}
      labelledBy="selfhosted-title"
      closeLabel={t("common.close")}
      centered
      size="max-w-md"
    >
      <ModalHeader
        titleId="selfhosted-title"
        title={header.title}
        onCancel={close}
        onSave={() => void header.onSave()}
        saveDisabled={header.disabled}
        saveLabel={header.save}
      />

      <div
        className="flex flex-col gap-4 overflow-y-auto px-3 py-4"
        data-testid={`selfhosted-step-${step}`}
      >
        {step === "code" && (
          <>
            <p className="text-xs text-muted">{t("selfHosted.intro")}</p>
            {canScan && (
              <button
                type="button"
                onClick={() => void scan()}
                disabled={busy}
                className="min-h-11 rounded-xl border border-line bg-surface-3 px-3 text-sm font-bold text-fg hover:bg-surface-2 disabled:opacity-50"
              >
                {t("selfHosted.scan")}
              </button>
            )}
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted">
                {t("selfHosted.codeLabel")}
              </span>
              <textarea
                value={payload}
                onInput={(e) => setPayload(e.currentTarget.value)}
                placeholder={t("selfHosted.codePlaceholder")}
                rows={3}
                spellcheck={false}
                autoComplete="off"
                className={`${TEXT_CLASS} font-figures text-xs`}
              />
            </label>
            <p className="text-xs text-muted">{t(pairingHintKey(canScan))}</p>
            {codeProblem && (
              <p className="text-xs text-danger" role="alert">
                {codeProblem}
              </p>
            )}
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted">
                {t("selfHosted.deviceLabel")}
              </span>
              <input
                value={deviceName}
                onInput={(e) => setDeviceName(e.currentTarget.value)}
                maxLength={64}
                className={LABELED_FIELD_CLASS}
              />
            </label>
            {busy && check.ok && (
              <p className="text-xs text-muted">
                {t("selfHosted.pairing", {
                  server: check.serverName ?? check.server,
                })}
              </p>
            )}
          </>
        )}

        {step === "new" && (
          <p className="text-sm text-fg">{t("selfHosted.newAccount")}</p>
        )}

        {step === "recovery" && (
          <>
            <p className="text-xs text-muted">{t("selfHosted.recovery")}</p>
            <div className="flex items-start gap-2">
              <code
                className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-2 font-figures text-sm break-all text-fg-bright"
                data-testid="recovery-key"
              >
                {recoveryKey}
              </code>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(recoveryKey)
                    .then(() => setCopied(true))
                }
                className="min-h-11 rounded-xl border border-line bg-surface-3 px-3 text-sm font-bold text-fg hover:bg-surface-2"
              >
                {copied ? t("selfHosted.copied") : t("selfHosted.copy")}
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.currentTarget.checked)}
              />
              {t("selfHosted.savedIt")}
            </label>
          </>
        )}

        {step === "existing" && (
          <>
            <p className="text-xs text-muted">{t("selfHosted.existing")}</p>
            <p
              className="text-center font-figures text-2xl font-bold tracking-wider text-fg-bright tabular-nums"
              data-testid="safety-code"
            >
              {safetyCode ?? "…"}
            </p>
            <p className="text-center text-xs text-muted">
              {t("selfHosted.waiting")}
            </p>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted">
                {t("selfHosted.orRecovery")}
              </span>
              <input
                value={typedKey}
                onInput={(e) => setTypedKey(e.currentTarget.value)}
                placeholder={t("selfHosted.recoveryPlaceholder")}
                autoComplete="off"
                spellcheck={false}
                className={`${TEXT_CLASS} font-figures`}
              />
            </label>
          </>
        )}

        {error && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
