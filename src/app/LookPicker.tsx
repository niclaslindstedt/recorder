// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { KeyboardEvent } from "react";

import type { CustomThemeColors } from "@niclaslindstedt/oss-framework/theme";

import { useT } from "./i18n/index.ts";
import {
  DARK_LOOKS,
  LIGHT_LOOKS,
  colorsFor,
  type DarkLook,
  type LightLook,
} from "./look.ts";

// The looks for one side of the day, as cards: each drawn in its own
// colours as a little of this app — a take's shape, the meter's three
// zones, the record button — so a reader chooses by what their recordings
// will sit in, not by a programmer's palette name (`look.ts`).

/** The take's shape in a swatch: a phrase, a breath, a louder phrase. */
const SHAPE = [
  0.25, 0.45, 0.7, 0.55, 0.8, 0.6, 0.35, 0.15, 0.1, 0.3, 0.6, 0.9, 0.75, 0.95,
  0.65, 0.4, 0.2,
];

type Props =
  | {
      side: "light";
      value: LightLook;
      onChange: (look: LightLook) => void;
      label: string;
    }
  | {
      side: "dark";
      value: DarkLook;
      onChange: (look: DarkLook) => void;
      label: string;
    };

export function LookPicker(props: Props) {
  const t = useT();
  const looks: readonly string[] =
    props.side === "light" ? LIGHT_LOOKS : DARK_LOOKS;
  const pick = (look: string) =>
    props.side === "light"
      ? props.onChange(look as LightLook)
      : props.onChange(look as DarkLook);

  // Arrow keys move the choice, as in any radio group.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const at = looks.indexOf(props.value);
    const next = looks[(at + step + looks.length) % looks.length]!;
    pick(next);
    e.currentTarget
      .querySelector<HTMLButtonElement>(`[data-look="${next}"]`)
      ?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={props.label}
      onKeyDown={onKeyDown}
      className="grid grid-cols-2 gap-2"
    >
      {looks.map((look) => {
        const on = look === props.value;
        const words =
          props.side === "light"
            ? {
                name: t(`look.light.${look as LightLook}.name`),
                mood: t(`look.light.${look as LightLook}.mood`),
              }
            : {
                name: t(`look.dark.${look as DarkLook}.name`),
                mood: t(`look.dark.${look as DarkLook}.mood`),
              };
        return (
          <button
            key={look}
            type="button"
            role="radio"
            aria-checked={on}
            data-look={look}
            tabIndex={on ? 0 : -1}
            title={words.mood}
            onClick={() => pick(look)}
            className={`flex flex-col gap-1.5 rounded-md border p-1.5 text-left transition-colors ${
              on
                ? "border-accent bg-accent/10 ring-1 ring-accent"
                : "border-line hover:bg-surface-2"
            }`}
          >
            <Swatch
              colors={colorsFor(props.side, look as LightLook | DarkLook)}
            />
            <span className="flex flex-col px-0.5">
              <span className="text-sm font-semibold text-fg-bright">
                {words.name}
              </span>
              <span className="line-clamp-2 text-[11px] leading-snug text-muted">
                {words.mood}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A look, drawn in its own colours: a card on the page with a take's
 *  shape in the accent, the meter's green, amber and red, and the record
 *  button. */
function Swatch({ colors }: { colors: CustomThemeColors }) {
  return (
    <span
      aria-hidden
      className="flex h-16 flex-col justify-between gap-1 rounded-sm p-1.5"
      style={{ background: colors.pageBg, border: `1px solid ${colors.line}` }}
    >
      <span
        className="flex flex-1 items-center gap-[2px] rounded-sm px-1.5"
        style={{ background: colors.surface }}
      >
        {SHAPE.map((h, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full"
            style={{
              height: `${Math.round(h * 80)}%`,
              background: i < 11 ? colors.accent : colors.muted,
            }}
          />
        ))}
        <span
          className="ml-auto h-3 w-3 shrink-0 rounded-full"
          style={{ background: colors.danger }}
        />
      </span>
      <span className="flex h-1.5 gap-[2px] overflow-hidden rounded-full">
        <span className="flex-[6]" style={{ background: colors.accent }} />
        <span className="flex-[2]" style={{ background: colors.flag }} />
        <span className="flex-1" style={{ background: colors.danger }} />
        <span className="flex-[3]" style={{ background: colors.surface2 }} />
      </span>
    </span>
  );
}
