// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, type ReactNode } from "react";

import { Button } from "@niclaslindstedt/oss-framework/components";

import { useT } from "./i18n/index.ts";
import { useModalSave } from "./useModalSave.ts";

// The top of every modal that is saved or abandoned: cancel on the left,
// the title between them, save on the right.
//
// They sit at the top because the bottom of the screen belongs to the nav —
// a row of buttons above it is a row of buttons next to the tabs, which on a
// phone is a mis-tap waiting to happen and a second bar's worth of height
// besides. Up here the title carries the row, so the modal spends no extra
// vertical space on it at all.
//
// It is a sibling of the modal's scrolling body rather than part of it, so
// it stays put while a long form scrolls underneath.
//
// It is also the modal's keyboard: Enter anywhere in the card is this row's
// Save, the way Escape is its Cancel (the framework's `Modal` owns that
// half). Both live here rather than in the five forms, so a modal that has
// this bar has the keys.

type Props = {
  /** The id the modal's `labelledBy` points at. */
  titleId: string;
  title: string;
  onCancel: () => void;
  onSave: () => void;
  /** Whether the form calls the draft savable. The save button is disabled
   *  while it is not — except while a field is still holding an edit the
   *  form has not been told about, which is when the answer is stale. */
  saveDisabled?: boolean;
  /** What the save button says, where "Save" is not what the modal does —
   *  a form that ends in a file says so. */
  saveLabel?: string;
  /** A second way out, beside the save: the modal that both downloads and
   *  prints has two outcomes rather than one, and they belong in this row
   *  together rather than in a second row at the foot of the sheet. */
  extra?: ReactNode;
};

export function ModalHeader({
  titleId,
  title,
  onCancel,
  onSave,
  saveDisabled = false,
  saveLabel,
  extra,
}: Props) {
  const t = useT();
  const row = useRef<HTMLDivElement>(null);

  // The button's own `disabled` rather than the form's verdict: while a
  // field is holding a typed edit, that verdict is out of date and painting
  // the button dead over a form the reader has plainly filled in is a lie the
  // press then contradicts. See `useModalSave`.
  const { disabled, save } = useModalSave({
    anchor: row,
    onSave,
    saveDisabled,
  });

  return (
    <div
      ref={row}
      className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-3 px-2 py-2"
    >
      <Button className="min-h-10 shrink-0" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
      <h2
        id={titleId}
        className="min-w-0 flex-1 truncate text-center text-sm font-bold text-fg-bright"
      >
        {title}
      </h2>
      {extra}
      <Button
        variant="primary"
        className="min-h-10 shrink-0 font-bold"
        disabled={disabled}
        onClick={save}
      >
        {saveLabel ?? t("common.save")}
      </Button>
    </div>
  );
}
