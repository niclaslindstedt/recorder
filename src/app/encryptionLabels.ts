// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  PASSPHRASE_MIN_LENGTH,
  type EncryptionLabels,
} from "@niclaslindstedt/oss-framework/encryption";

import { useT } from "./i18n/index.ts";

// The app's words for the framework's encryption kit. The machinery —
// `useEncryption` (wired in `useSyncEngine.ts`), the `EncryptionGate` in
// the shell and `EncryptionSettings` under Storage — is the framework's;
// this file only translates it, so every string still goes through `t()`.

export function useEncryptionLabels(providerName: string): EncryptionLabels {
  const t = useT();
  const name = { name: providerName };
  return {
    on: t("encryption.headline"),
    requiredHint: t("encryption.required", name),
    rememberedHint: t("encryption.on"),
    checking: t("encryption.checking", name),
    setupNeeded: t("encryption.paused"),
    lockedStatus: t("encryption.paused"),
    changedStatus: t("encryption.changedHint"),
    unreachable: t("encryption.unreachable", name),
    setPassphrase: t("encryption.set"),
    unlock: t("encryption.unlockSubmit"),
    changePassphrase: t("encryption.change"),
    retry: t("encryption.retry"),
    cancel: t("common.cancel"),
    close: t("common.close"),
    createTitle: t("encryption.createTitle"),
    createHint: t("encryption.createHint", name),
    unlockTitle: t("encryption.unlockTitle"),
    unlockHint: t("encryption.unlockHint", name),
    unlockHintRemote: t("encryption.unlockHint", name),
    changedTitle: t("encryption.changedTitle"),
    changedHint: t("encryption.changedHint"),
    changeTitle: t("encryption.changeTitle"),
    changeHint: t("encryption.changeHint", name),
    noRecovery: t("encryption.noRecovery", name),
    passphrase: t("encryption.passphrase"),
    confirm: t("encryption.confirm"),
    createSubmit: t("encryption.createSubmit"),
    changeSubmit: t("encryption.changeSubmit"),
    tooShort: t("encryption.tooShort", { min: PASSPHRASE_MIN_LENGTH }),
    mismatch: t("encryption.mismatch"),
    wrong: t("encryption.wrong"),
    offline: t("encryption.offline", name),
    failed: t("encryption.failed"),
    steps: {
      reading: t("encryption.working"),
      derivingKey: t("encryption.working"),
      encrypting: t("encryption.working"),
      decrypting: t("encryption.working"),
      saving: t("encryption.working"),
      finalizing: t("encryption.working"),
    },
  };
}
