// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The keys a modal answers: whether Enter, with what is focused, is asking
// for the modal's Save (`useModalSave.ts` binds it for `ModalHeader`).
// Pure and tested in `tests/shortcuts_test.ts`.

export type Modifiers = {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};

/** What has the keyboard when a key lands in a modal. */
export type Focused =
  /** A one-line field: a name, a number. */
  | "field"
  /** Something Enter already does a job in: a button, a link, a textarea, a
   *  select, a contenteditable. */
  | "control"
  /** Nothing in particular — the modal's own card. */
  | "card";

/** Whether a key press in a modal is asking for its Save: a bare Enter,
 *  anywhere but on a control that already answers Enter itself. */
export function savesModal(key: string, mods: Modifiers, on: Focused): boolean {
  if (key !== "Enter") return false;
  if (mods.alt || mods.ctrl || mods.meta || mods.shift) return false;
  return on !== "control";
}
