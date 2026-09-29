// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import { blurActiveField } from "@niclaslindstedt/oss-framework/hooks";

import { savesModal, type Focused } from "./shortcuts.ts";

// The modal's Save: what it does, and when it is allowed to look dead.
//
// Enter, inside a modal, is this button. The listener is on the document
// rather than on the header, because the header is a *sibling* of the form it
// saves — a press in a field never bubbles through it. What keeps one modal
// from answering another's keys is the card: each hook finds the `aria-modal`
// card it is drawn inside and stands down unless the press came from within
// it. A modal stacked over another is portalled to the body, so it is not
// inside the one underneath and only the top one ever answers.
//
// The save is deferred a tick, and that is not a flourish. A field that
// commits on blur — which is most of them, since `LabeledInput` holds its own
// draft and hands it over on blur or Enter — has not committed yet at the
// moment the save is asked for: the value is still the input's own. So the
// field is blurred first, which commits it, and the save waits for the render
// that commit causes. By then `onSave` is the closure over the *committed*
// draft, which is why it is read back off a ref rather than captured here.
// The press goes through the same door as Enter for exactly that reason.
//
// The same seam is why the button's `disabled` is this hook's and not the
// form's. A form's `valid` is read off the committed draft, so while a name
// is being typed into it the draft is still empty and the button paints
// itself dead over a form that is plainly filled in — and then saves anyway
// when it is pressed, because the press commits the field on its way in. The
// button was lying, not broken. So: while a field inside this card is holding
// an edit it has not committed, the form's verdict is known to be stale and
// the button is not painted disabled. Pressing it commits the field and reads
// the verdict again a tick later, which is the only moment either is true.

/** Reads a press's target as one of the three kinds `savesModal` knows. */
function focusedKind(target: Node, card: Element): Focused {
  if (target === card || !(target instanceof HTMLElement)) return "card";
  if (target.isContentEditable) return "control";
  if (target.getAttribute("role") === "button") return "control";
  switch (target.tagName) {
    case "BUTTON":
    case "A":
    case "TEXTAREA":
    case "SELECT":
      return "control";
    case "INPUT": {
      const type = (target as HTMLInputElement).type;
      const pressable =
        type === "button" || type === "submit" || type === "reset";
      return pressable ? "control" : "field";
    }
    default:
      return "card";
  }
}

/**
 * Whether an element is the kind of field that keeps its own draft until it
 * is left — so a keystroke in it has changed what the reader sees without
 * changing what the form has been told.
 *
 * Typed rather than taking an element, so the rule is a rule rather than a
 * DOM query, and a test can walk it.
 *
 * A checkbox, a radio and a select commit as they are pressed, so nothing
 * about them is ever uncommitted; the pressable inputs are buttons wearing an
 * input's tag. What is left is text, numbers, times, dates and a textarea —
 * every field the forms in this app are made of.
 */
export function holdsEdit(tag: string, type?: string): boolean {
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  switch (type) {
    case "button":
    case "submit":
    case "reset":
    case "checkbox":
    case "radio":
      return false;
    default:
      return true;
  }
}

type Params = {
  /** Anything drawn inside the modal's card — the card is found from it. */
  anchor: { current: HTMLElement | null };
  onSave: () => void;
  /** Whether the form calls the draft savable. Read at the moment of the
   *  save, after the focused field has committed, never before. */
  saveDisabled: boolean;
};

type Save = {
  /** Whether the save button is painted dead — the form's verdict, less the
   *  moments it is known to be out of date. */
  disabled: boolean;
  /** Commit whatever field is focused, then save if the form still says so. */
  save: () => void;
};

export function useModalSave({ anchor, onSave, saveDisabled }: Params): Save {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const disabledRef = useRef(saveDisabled);
  disabledRef.current = saveDisabled;
  const alive = useRef(true);
  /** Whether a field in this card is holding an edit it has not handed over
   *  yet, which is what makes `saveDisabled` stale. */
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const save = useCallback(() => {
    blurActiveField();
    setTimeout(() => {
      if (alive.current && !disabledRef.current) onSaveRef.current();
    }, 0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing) return;
      const card = anchor.current?.closest('[aria-modal="true"]');
      if (!card || !(e.target instanceof Node) || !card.contains(e.target)) {
        return;
      }
      const on = focusedKind(e.target, card);
      const mods = {
        alt: e.altKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
      };
      if (!savesModal(e.key, mods, on)) return;
      e.preventDefault();
      save();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anchor, save]);

  // Whether a field is mid-edit. Both listeners are on the document and both
  // are scoped to this card, the way the keys are. `focusout` runs after the
  // field's own handler — the commit — has already gone, so the draft and
  // this flag land in the same render and the button never blinks.
  useEffect(() => {
    const within = (target: EventTarget | null): HTMLElement | null => {
      const card = anchor.current?.closest('[aria-modal="true"]');
      if (!card || !(target instanceof Node) || !card.contains(target)) {
        return null;
      }
      return target instanceof HTMLElement ? target : null;
    };
    const onInput = (e: Event) => {
      const el = within(e.target);
      if (el && holdsEdit(el.tagName, (el as HTMLInputElement).type)) {
        setEditing(true);
      }
    };
    const onOut = (e: FocusEvent) => {
      if (within(e.target)) setEditing(false);
    };
    document.addEventListener("input", onInput);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("input", onInput);
      document.removeEventListener("focusout", onOut);
    };
  }, [anchor]);

  return { disabled: saveDisabled && !editing, save };
}
