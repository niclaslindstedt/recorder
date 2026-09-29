// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

// Holding a control rather than tapping it. The Today screen's pills are the
// one place it is used: a tap says what you are doing, a hold opens the kind
// itself.
//
// One hook for a screen rather than one per button, because the pills are a
// list that grows and shrinks and a hook may not be called in a loop. It
// hands back a factory — `press({ press, hold })` returns the handlers to
// spread on a button — and the press in flight is the screen's one press,
// because a finger is one finger.
//
// Three things make a hold behave: the click the press ends with is
// swallowed, so holding "Lunch" opens its form rather than also starting one;
// a pointer that wanders is a scroll rather than a hold and calls it off; and
// under a mouse the right button is the same gesture, which is where a desk
// looks for it. Nothing under the finger is selectable (`html` in
// `styles.css`), which is what keeps the phone from putting a selection handle
// over the pill while it is held — and, on iOS, what keeps it from raising the
// glass lens it places a text caret with over the hold.

/** How long a press is held before it counts as one. Long enough not to fire
 *  on a slow tap, short enough to be found by accident. */
const HOLD_MS = 500;

/** How far the pointer may wander while held before the press is a scroll. */
const SLOP_PX = 10;

/** How long after the finger comes up a hold goes on swallowing the click it
 *  is owed. The click follows the release by a browser's own delay, so the
 *  flag cannot simply be cleared on release — and it cannot be left standing
 *  either, or the *next* gesture inherits it and the control ignores a press
 *  it should have taken. */
const FORGET_MS = 400;

export type PressHandlers = {
  /** The plain tap. */
  press?: () => void;
  /** The hold — and the right button, which means the same thing. */
  hold: () => void;
};

/** The handlers a held control needs, as they are spread on a `<button>`. */
export type PressProps = {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
};

export function useLongPress(): (on: PressHandlers) => PressProps {
  const timer = useRef<number | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  /** Whether a hold has just fired, so the click it is followed by belongs to
   *  nobody. */
  const held = useRef(false);
  /** The wait that forgets that, once the gesture is over. */
  const grace = useRef<number | null>(null);

  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };
  const cancelGrace = () => {
    if (grace.current !== null) window.clearTimeout(grace.current);
    grace.current = null;
  };
  /** The hold is over: its click has a moment to arrive and be swallowed, and
   *  then it is nobody's. */
  const forget = () => {
    cancelGrace();
    grace.current = window.setTimeout(() => {
      grace.current = null;
      held.current = false;
    }, FORGET_MS);
  };
  // A screen left mid-press leaves no timer behind.
  useEffect(
    () => () => {
      stop();
      cancelGrace();
    },
    [],
  );

  return (on) => ({
    onPointerDown: (e) => {
      // The right button is the hold's own gesture and arrives as a context
      // menu; anything but the primary button starts no press.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stop();
      cancelGrace();
      held.current = false;
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        from.current = null;
        held.current = true;
        on.hold();
      }, HOLD_MS);
    },
    onPointerMove: (e) => {
      const start = from.current;
      if (!start) return;
      if (
        Math.abs(e.clientX - start.x) > SLOP_PX ||
        Math.abs(e.clientY - start.y) > SLOP_PX
      )
        stop();
    },
    onPointerUp: () => {
      stop();
      if (held.current) forget();
    },
    onPointerCancel: () => {
      stop();
      if (held.current) forget();
    },
    onPointerLeave: () => {
      stop();
      if (held.current) forget();
    },
    onClick: (e) => {
      if (held.current) {
        held.current = false;
        cancelGrace();
        e.preventDefault();
        return;
      }
      on.press?.();
    },
    onContextMenu: (e) => {
      e.preventDefault();
      stop();
      // A phone that answers a long press with a context menu of its own has
      // already been answered by the timer above.
      if (held.current) return;
      held.current = true;
      on.hold();
      forget();
    },
  });
}
