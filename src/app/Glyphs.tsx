// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import {
  ChevronRightIcon,
  FolderIcon,
} from "@niclaslindstedt/oss-framework/components";

// The app's glyph-shaped controls (docs/design.md, "Glyphs first"): a
// choice as a tile, the same choice as a round glyph, a round glyph with
// its word under it, a toolbar of them, and the chips a fact or a folder is
// shown in. Every one carries an accessible name; the word drawn under a
// glyph is the caption a sighted reader gets, never the only name.

/** A choice made before a take, as a square tile: a small caption, the
 *  glyph, and the value in a word or two. `lit` when it is not the
 *  default — an EQ on, a trigger armed, a microphone chosen — so a glance
 *  at the row says what is out of the ordinary. */
export function ChoiceTile({
  icon,
  caption,
  value,
  detail,
  label,
  lit = false,
  onClick,
}: {
  icon: ReactNode;
  caption: string;
  value: string;
  /** A second fact under the value — a bitrate, "Low cut". */
  detail?: string;
  /** The accessible name: "Quality: High, 256 kbit/s". */
  label: string;
  lit?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1.5 pt-2 pb-2.5 text-center shadow-sm transition-colors ${
        lit
          ? "border-accent/50 bg-accent/10 hover:bg-accent/15"
          : "border-line bg-surface hover:border-accent/60 hover:bg-surface-2"
      }`}
    >
      <span className="max-w-full truncate text-[0.625rem] font-semibold tracking-wide text-muted uppercase">
        {caption}
      </span>
      <span
        className={`flex h-8 items-center justify-center ${lit ? "text-accent" : "text-fg"}`}
      >
        {icon}
      </span>
      <span className="max-w-full truncate text-xs leading-tight font-semibold text-fg-bright">
        {value}
      </span>
      <span className="max-w-full truncate text-[0.625rem] leading-tight text-muted">
        {detail ?? " "}
      </span>
    </button>
  );
}

/** The same choice, smaller: a round glyph with its value under it, for a
 *  mode where the choices are still in reach but no longer the subject
 *  (Listening). */
export function ChoiceGlyph({
  icon,
  value,
  label,
  lit = false,
  onClick,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  lit?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      className="group flex min-w-0 flex-1 flex-col items-center gap-1"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
          lit
            ? "border-accent/50 bg-accent/10 text-accent group-hover:bg-accent/15"
            : "border-line bg-surface text-fg group-hover:bg-surface-2"
        }`}
      >
        {icon}
      </span>
      <span className="max-w-full truncate text-[0.625rem] text-muted">
        {value}
      </span>
    </button>
  );
}

/** A round glyph button beside the big one — Listen, Pause, Discard — with
 *  its word under it when `caption` is given. The name is the accessible
 *  name and the tooltip; the caption is drawn for the eye only. `pressed`
 *  makes it a toggle, lit while on. */
export function RoundGlyph({
  label,
  onClick,
  disabled,
  children,
  caption,
  pressed,
  tone = "plain",
  size = "md",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  caption?: string;
  pressed?: boolean;
  tone?: "plain" | "danger" | "accent";
  size?: "sm" | "md";
}) {
  const face =
    tone === "danger"
      ? "border-line bg-surface text-danger hover:border-danger/60 hover:bg-danger/10"
      : tone === "accent" || pressed
        ? "border-accent/60 bg-accent/15 text-accent hover:bg-accent/20"
        : "border-line bg-surface text-fg hover:bg-surface-2";
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex ${size === "sm" ? "h-11 w-11" : "h-14 w-14"} shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${face}`}
    >
      {children}
    </button>
  );
  if (!caption) return button;
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      {button}
      <span
        aria-hidden
        className={`max-w-full truncate text-[0.6875rem] ${
          tone === "danger" ? "text-danger" : "text-muted"
        }`}
      >
        {caption}
      </span>
    </div>
  );
}

/** One button in a toolbar of labelled glyphs (the player's foot): the
 *  glyph in a circle, its word under it. `primary` is the one the bar is
 *  for, filled in the accent. */
export function ToolGlyph({
  label,
  caption,
  onClick,
  disabled,
  tone = "plain",
  children,
}: {
  label: string;
  caption: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "plain" | "primary" | "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1 disabled:opacity-40"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
          tone === "primary"
            ? "bg-accent text-page-bg group-active:scale-95"
            : tone === "danger"
              ? "border border-line text-danger group-hover:border-danger/60 group-hover:bg-danger/10"
              : "border border-line text-fg group-hover:bg-surface-2"
        }`}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={`max-w-full truncate text-xs ${tone === "danger" ? "text-danger" : "text-muted"}`}
      >
        {caption}
      </span>
    </button>
  );
}

/** A fact as a small pill, with a glyph in front when it has one. `tone`
 *  colours the clip count — never the only signal: the words say it too. */
export function Chip({
  icon,
  children,
  tone = "plain",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "plain" | "danger";
}) {
  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
        tone === "danger"
          ? "border-danger/50 bg-danger/10 font-medium text-danger"
          : "border-line bg-surface-2 text-fg"
      }`}
    >
      {icon && <span className="shrink-0 text-muted">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Where a recording is filed, as a chip that opens the folder picker —
 *  the player's and Review's, so filing is one tap from the take. */
export function FolderChip({
  name,
  label,
  onClick,
  disabled,
}: {
  name: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label={label}
      className="flex max-w-full items-center gap-1 rounded-full border border-line px-2.5 py-1 text-sm text-fg transition-colors hover:border-accent/60 hover:bg-surface-2 disabled:opacity-50"
    >
      <FolderIcon className="h-4 w-4 shrink-0 text-accent" />
      <span className="truncate">{name}</span>
      <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
    </button>
  );
}
