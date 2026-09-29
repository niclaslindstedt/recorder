// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Identifiers for recordings and folders. Random rather than sequential so
// two devices creating things between syncs cannot collide (see `merge.ts`);
// short rather than a full UUID because a recording's id is also its file
// name on every backend. Lowercase letters and digits only, so the name is
// safe on every file system and in every URL (`isFileName` in
// `migrations.ts` pins the shape).
//
// The pure domain modules never call this — they take the id through a
// `ctx` argument (`folders.ts`) — so a test can name its ids.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A fresh 16-character id from the platform's random source. */
export function makeId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** The `ctx` the edits take: fresh ids and the clock. */
export function liveCtx() {
  return { id: makeId, now: () => new Date().toISOString() };
}
