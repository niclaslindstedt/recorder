// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The spaces: separate libraries of recordings — Personal, Work, a client —
// each with its own document, its own files and its own file on a backend.
// The framework's namespaces module owns the list (slug, name, a glyph and
// a colour) and the two sheets that manage and switch it; this hook owns
// where the list is kept and which space is open.
//
// The list is per device, in localStorage: a space is a container, and the
// containers are found again on another device by the files a backend
// lists, not by syncing the list (`useSyncEngine.ts`'s `spacesOnBackend`).

import { useCallback, useMemo } from "react";

import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";
import {
  DEFAULT_NAMESPACE_SLUG,
  addNamespace,
  normalizeNamespaces,
  parseNamespaces,
  removeNamespace,
  renameNamespace,
  serializeNamespaces,
  setNamespaceAppearance,
  type Namespace,
  type NamespaceAppearance,
} from "@niclaslindstedt/oss-framework/namespaces";

export const LIST_KEY = "recorder:namespaces";
export const ACTIVE_KEY = "recorder:namespace:active";

/** What a fresh install starts with: one space, so the first recording has
 *  somewhere to go without a question first. */
export function defaultNamespaces(name: string): Namespace[] {
  return normalizeNamespaces([{ slug: DEFAULT_NAMESPACE_SLUG, name }]);
}

export type Namespaces = {
  list: Namespace[];
  activeSlug: string;
  active: Namespace;
  switchTo: (slug: string) => void;
  create: (name: string, appearance?: NamespaceAppearance) => Namespace;
  rename: (slug: string, name: string) => void;
  setAppearance: (slug: string, patch: NamespaceAppearance) => void;
  /** Forget a space on this device. Its document and files are the
   *  caller's to drop (`useDocStore`'s `dropSpace`) — the list does not
   *  know where they are. */
  remove: (slug: string) => void;
  /** Adopt a space found on a backend, under the slug its file carries. */
  adopt: (slug: string, name: string) => void;
};

export function useNamespaces(defaultName: string): Namespaces {
  const [list, setList] = useLocalStorageState<Namespace[]>(
    LIST_KEY,
    defaultNamespaces(defaultName),
    {
      parse: (raw) => {
        const parsed = parseNamespaces(raw);
        return parsed.length ? parsed : defaultNamespaces(defaultName);
      },
      serialize: serializeNamespaces,
    },
  );
  const [activeSlug, setActiveSlug] = useLocalStorageState<string>(
    ACTIVE_KEY,
    DEFAULT_NAMESPACE_SLUG,
    {
      parse: (raw) => raw.replace(/^"|"$/g, ""),
      serialize: (slug) => slug,
    },
  );

  const active = useMemo(
    () => list.find((ns) => ns.slug === activeSlug) ?? list[0]!,
    [list, activeSlug],
  );

  const switchTo = useCallback(
    (slug: string) => setActiveSlug(slug),
    [setActiveSlug],
  );

  const create = useCallback(
    (name: string, appearance?: NamespaceAppearance) => {
      const { list: next, created } = addNamespace(list, name);
      const withLook = appearance
        ? setNamespaceAppearance(next, created.slug, appearance)
        : next;
      setList(withLook);
      setActiveSlug(created.slug);
      return withLook.find((ns) => ns.slug === created.slug) ?? created;
    },
    [list, setList, setActiveSlug],
  );

  const rename = useCallback(
    (slug: string, name: string) =>
      setList((cur) => renameNamespace(cur, slug, name)),
    [setList],
  );

  const setAppearance = useCallback(
    (slug: string, patch: NamespaceAppearance) =>
      setList((cur) => setNamespaceAppearance(cur, slug, patch)),
    [setList],
  );

  const remove = useCallback(
    (slug: string) => {
      setList((cur) => {
        const next = removeNamespace(cur, slug);
        return next.length ? next : defaultNamespaces(defaultName);
      });
      setActiveSlug((cur) => (cur === slug ? DEFAULT_NAMESPACE_SLUG : cur));
    },
    [defaultName, setList, setActiveSlug],
  );

  const adopt = useCallback(
    (slug: string, name: string) =>
      setList((cur) =>
        cur.some((ns) => ns.slug === slug)
          ? cur
          : normalizeNamespaces([...cur, { slug, name }]),
      ),
    [setList],
  );

  return useMemo(
    () => ({
      list,
      activeSlug: active.slug,
      active,
      switchTo,
      create,
      rename,
      setAppearance,
      remove,
      adopt,
    }),
    [list, active, switchTo, create, rename, setAppearance, remove, adopt],
  );
}
