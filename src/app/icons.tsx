// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// App-owned glyphs. Everything the framework's set has — the microphone, the
// transport, folders, the cog — comes from
// `@niclaslindstedt/oss-framework/components`; what is here is the app's
// own mark, which the favicon and the install icon share, and the few the
// framework's set lacks.

import type { ReactNode } from "react";

export type IconProps = { className?: string };

function Glyph({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * The app mark — a recording dot inside a ring, with a sound wave leaving
 * it. Drawn in `currentColor` on nothing, so inside the app it is whatever
 * the element around it is; `public/icons/icon.svg` and
 * `scripts/generate-icons.mjs` paint the same geometry for the home screen.
 */
export function AppMarkIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="10" cy="12" r="7" />
      <circle cx="10" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M20 8.5a6 6 0 0 1 0 7" />
      <path d="M22.5 6a9.5 9.5 0 0 1 0 12" />
    </Glyph>
  );
}

export function StarFilledIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.3l-6 3.3 1.3-6.6L2.4 9.4l6.7-.8L12 2.5z" />
    </svg>
  );
}

/** Three dots: "more about this one" — a folder's menu in the picker. */
export function MoreIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

/** Stacked layers: the spaces — separate libraries laid over each other.
 *  The top bar draws it for a space that has no symbol of its own. */
export function SpacesIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </Glyph>
  );
}

/** Bars rising from a baseline: the spectrum. */
export function SpectrumIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 20v-5" />
      <path d="M8 20V8" />
      <path d="M12 20v-9" />
      <path d="M16 20V5" />
      <path d="M20 20v-7" />
    </Glyph>
  );
}

/** A bar across: lower a number by one. The framework's set has the plus
 *  but not its partner. */
export function MinusIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M5 12h14" />
    </Glyph>
  );
}

/** A grid lit in bands: the spectrogram — frequency over time. */
export function SpectrogramIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" opacity="0.5" />
      <path d="M3 14.5h18" opacity="0.5" />
      <path
        d="M7 7v0.01M11 12v0.01M15 7v0.01M15 17v0.01M19 12v0.01"
        strokeWidth={3}
      />
    </Glyph>
  );
}

/** Clipping: a wave whose tops are cut flat against the ceiling — what a
 *  signal too loud for the microphone looks like. The meter's lamp wears the
 *  same drawing (`.app-meter-big .oss-clip-lamp` in styles.css); keep the
 *  two paths in step. */
export function ClipIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M2 5h20" opacity="0.45" />
      <path d="M2 17c1.5 0 2.5-12 4-12h3c1.5 0 2.5 14 4.5 14S16 5 17.5 5H20c1 0 1.5 5 2 8" />
    </Glyph>
  );
}

/** Headphones: listening — the microphone open to be heard, nothing kept. */
export function HeadphonesIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </Glyph>
  );
}

/** A box with an arrow leaving it upward: share — the file handed on as it
 *  is, to whatever the device offers. */
export function ShareIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </Glyph>
  );
}

/** A code in a viewfinder's corners: scan — the camera reads a pairing code. */
export function ScanIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="4" height="4" rx="0.5" />
      <rect x="13" y="13" width="4" height="4" rx="0.5" />
      <path d="M13 7h4v2M7 17v-2h2" />
    </Glyph>
  );
}
