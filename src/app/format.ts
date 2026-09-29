// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Durations, the recording timer, dates and sizes, in words. Pure; the
// locale is a parameter, and the clock comes in as `now`.

import { formatBytes, formatDate } from "@niclaslindstedt/oss-framework/format";

/** A length as `m:ss`, or `h:mm:ss` past an hour — how a player prints it. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** The recording timer: `m:ss.t`, tenths ticking, so the screen is seen to
 *  be counting. */
export function formatTimer(ms: number): string {
  const clamped = Math.max(0, ms);
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${formatDuration(Math.floor(clamped / 1000) * 1000)}.${tenths}`;
}

/** The day a recording was made, the way a list prints it: "Today",
 *  "Yesterday", a weekday within the week, else the date. `labels` are the
 *  two words, from the catalog. */
export function formatDay(
  iso: string,
  now: Date,
  locale: string,
  labels: { today: string; yesterday: string },
): string {
  const then = new Date(iso);
  const dayStart = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(then)) / 86_400_000);
  if (days === 0) return labels.today;
  if (days === 1) return labels.yesterday;
  if (days > 1 && days < 7)
    return formatDate(then, locale, { weekday: "long" });
  const sameYear = then.getFullYear() === now.getFullYear();
  return formatDate(then, locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** The time of day a recording was made. */
export function formatClock(iso: string, locale: string): string {
  return formatDate(new Date(iso), locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Day and time together, for the details line. */
export function formatWhen(iso: string, locale: string): string {
  return formatDate(new Date(iso), locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSize(bytes: number, locale: string): string {
  return formatBytes(bytes, locale);
}

/** A container's name for the details line: "Opus", "AAC", "FLAC"… */
export function formatContainer(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes("opus")) return "Opus";
  if (type.includes("mp4") || type.includes("aac") || type.includes("m4a"))
    return "AAC";
  if (type.includes("flac")) return "FLAC";
  if (type.includes("wav")) return "WAV";
  if (type.includes("mpeg")) return "MP3";
  if (type.includes("webm")) return "WebM";
  if (type.includes("ogg")) return "Ogg";
  return type.split(";")[0]?.split("/").pop()?.toUpperCase() || "—";
}

/** A sample rate as "48 kHz". */
export function formatRate(hz: number): string {
  if (!(hz > 0)) return "—";
  const khz = hz / 1000;
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`;
}
