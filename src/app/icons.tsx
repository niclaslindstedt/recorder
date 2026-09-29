// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// App-owned glyphs. Everything the framework's set has — the microphone, the
// transport, folders, the cog — comes from
// `@niclaslindstedt/oss-framework/components`; what is here is the app's
// own mark, which the favicon and the install icon share.

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
