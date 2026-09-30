// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useRef, useState, type ReactNode } from "react";

import {
  CheckIcon,
  ConfirmDialog,
  ContextMenu,
  FolderIcon,
  IconButton,
  ListIcon,
  Modal,
  PlusIcon,
  SelectPicker,
  StarIcon,
  TrashIcon,
  type RowAction,
} from "@niclaslindstedt/oss-framework/components";

import {
  canNest,
  childrenByParent,
  countIn,
  folderTree,
  subtreeIds,
} from "./folders.ts";
import { MoreIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { ModalHeader, SheetTitle } from "./ModalHeader.tsx";
import { liveRecordings, trashedRecordings, type AppData } from "./types.ts";
import type { DocStore } from "./useDocStore.ts";

// The one folder picker. Three uses, one layout, so learning it once is
// enough (docs/design.md, "The folder picker"):
//
// - browsing: the library's scope — All, Favorites, the tree with counts,
//   New folder, Recently deleted — and each folder's menu (rename, a folder
//   inside, move, up, down, delete). This is everything the old Folders
//   page did, next to the recordings it is about.
// - choosing: where a recording goes (Move, and a take's destination) —
//   No folder, the tree, New folder. A new folder made here is chosen.
//
// Every use ends the tree in New folder, so nobody has to leave what they
// are doing to make one.

export type LibraryView =
  | { kind: "all" }
  | { kind: "folder"; folderId: string }
  | { kind: "favorites" }
  | { kind: "trash" };

type Common = {
  data: AppData;
  store: DocStore;
  onClose: () => void;
};

type BrowseProps = Common & {
  mode: "browse";
  view: LibraryView;
  now: Date;
  onView: (view: LibraryView) => void;
  onNotice: (message: string) => void;
};

type ChooseProps = Common & {
  mode: "choose";
  title: string;
  value: string | null;
  /** What choosing nothing is called: "No folder", or "Top level" when a
   *  folder is being moved. */
  noneLabel: string;
  /** A folder being moved: it and everything under it are not offered. */
  moving?: string;
  onChoose: (folderId: string | null) => void;
};

export function FolderPicker(props: BrowseProps | ChooseProps) {
  const t = useT();
  const { data, store, onClose } = props;
  const tree = useMemo(() => folderTree(data), [data]);
  const [naming, setNaming] = useState<
    | { kind: "new"; parentId: string | null }
    | { kind: "rename"; folderId: string }
    | null
  >(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    folderId: string;
    at: { x: number; y: number };
  } | null>(null);

  const browse = props.mode === "browse";
  const excluded = useMemo(
    () =>
      props.mode === "choose" && props.moving
        ? subtreeIds(data, props.moving)
        : new Set<string>(),
    [props, data],
  );
  const rows = tree.filter(({ folder }) => !excluded.has(folder.id));

  const selected = (folderId: string | null): boolean =>
    props.mode === "browse"
      ? folderId !== null &&
        props.view.kind === "folder" &&
        props.view.folderId === folderId
      : props.value === folderId;

  const pick = (folderId: string) => {
    if (props.mode === "browse") props.onView({ kind: "folder", folderId });
    else props.onChoose(folderId);
  };

  const menuActions = (folderId: string): RowAction[] => {
    const folder = data.folders[folderId];
    if (!folder) return [];
    const siblings = childrenByParent(data).get(folder.parentId) ?? [];
    const at = siblings.findIndex((s) => s.id === folderId);
    const swap = (to: number) => {
      const ids = siblings.map((s) => s.id);
      [ids[to], ids[at]] = [ids[at]!, ids[to]!];
      store.reorderFolders(folder.parentId, ids);
    };
    const actions: RowAction[] = [
      {
        label: t("common.rename"),
        onSelect: () => setNaming({ kind: "rename", folderId }),
      },
      {
        label: t("folders.addIn", { name: folder.name }),
        onSelect: () => setNaming({ kind: "new", parentId: folderId }),
      },
      { label: t("folders.move"), onSelect: () => setMoving(folderId) },
    ];
    if (at > 0)
      actions.push({ label: t("folders.up"), onSelect: () => swap(at - 1) });
    if (at >= 0 && at < siblings.length - 1)
      actions.push({ label: t("folders.down"), onSelect: () => swap(at + 1) });
    actions.push({
      label: t("folders.delete"),
      onSelect: () => setDeleting(folderId),
      danger: true,
    });
    return actions;
  };

  const title = props.mode === "browse" ? t("folders.show") : props.title;

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="folder-picker-title"
      centered
      closeLabel={t("common.close")}
    >
      <SheetTitle
        titleId="folder-picker-title"
        title={title}
        onClose={onClose}
      />
      <ul className="flex flex-col py-2" role="list">
        {props.mode === "browse" && (
          <>
            <Row
              icon={<ListIcon className="h-5 w-5" />}
              label={t("library.all")}
              count={liveRecordings(data).length}
              on={props.view.kind === "all"}
              onClick={() => props.onView({ kind: "all" })}
            />
            <Row
              icon={<StarIcon className="h-5 w-5" />}
              label={t("library.favorites")}
              count={liveRecordings(data).filter((r) => r.favorite).length}
              on={props.view.kind === "favorites"}
              onClick={() => props.onView({ kind: "favorites" })}
            />
            <li
              aria-hidden
              className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase"
            >
              {t("folders.title")}
            </li>
          </>
        )}
        {props.mode === "choose" && (
          <Row
            icon={<FolderIcon className="h-5 w-5 opacity-50" />}
            label={props.noneLabel}
            on={props.value === null}
            onClick={() => props.onChoose(null)}
          />
        )}
        {rows.map(({ folder, depth }) => (
          <Row
            key={folder.id}
            depth={depth}
            icon={<FolderIcon className="h-5 w-5 text-accent" />}
            label={folder.name}
            count={browse ? countIn(data, folder.id) : undefined}
            on={selected(folder.id)}
            onClick={() => pick(folder.id)}
            more={
              browse ? (at) => setMenu({ folderId: folder.id, at }) : undefined
            }
            moreLabel={t("folders.menu", { name: folder.name })}
          />
        ))}
        <Row
          icon={<PlusIcon className="h-5 w-5" />}
          label={t("folders.add")}
          accent
          onClick={() =>
            setNaming({
              kind: "new",
              parentId:
                props.mode === "browse" && props.view.kind === "folder"
                  ? props.view.folderId
                  : null,
            })
          }
        />
        {props.mode === "browse" && (
          <>
            <li aria-hidden className="mx-4 my-2 border-t border-line" />
            <Row
              icon={<TrashIcon className="h-5 w-5" />}
              label={t("library.trash")}
              count={trashedRecordings(data, props.now).length}
              on={props.view.kind === "trash"}
              onClick={() => props.onView({ kind: "trash" })}
            />
          </>
        )}
      </ul>

      {menu && (
        <ContextMenu
          position={menu.at}
          actions={menuActions(menu.folderId)}
          onClose={() => setMenu(null)}
          ariaLabel={data.folders[menu.folderId]?.name}
        />
      )}

      {naming && (
        <FolderNameSheet
          data={data}
          initial={
            naming.kind === "rename"
              ? (data.folders[naming.folderId]?.name ?? "")
              : ""
          }
          parentId={naming.kind === "new" ? naming.parentId : undefined}
          onSave={(name, parentId) => {
            const trimmed = name.trim();
            if (!trimmed) return;
            if (naming.kind === "rename") {
              store.renameFolder(naming.folderId, trimmed);
              setNaming(null);
              return;
            }
            const made = store.addFolder(trimmed, parentId ?? null);
            setNaming(null);
            // Made while choosing where something goes: that is where it goes.
            if (props.mode === "choose") props.onChoose(made.id);
          }}
          onClose={() => setNaming(null)}
        />
      )}

      {moving && (
        <FolderPicker
          mode="choose"
          data={data}
          store={store}
          title={t("folders.move")}
          noneLabel={t("folders.top")}
          value={data.folders[moving]?.parentId ?? null}
          moving={moving}
          onChoose={(parentId) => {
            if (parentId === null || canNest(data, moving, parentId))
              store.moveFolder(moving, parentId);
            setMoving(null);
          }}
          onClose={() => setMoving(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("folders.deleteConfirm", {
          name: (deleting && data.folders[deleting]?.name) || "",
        })}
        description={t("folders.deleteHint")}
        confirmLabel={t("common.delete")}
        tone="danger"
        labels={{ cancel: t("common.cancel"), close: t("common.close") }}
        onConfirm={() => {
          if (deleting) {
            if (
              props.mode === "browse" &&
              props.view.kind === "folder" &&
              subtreeIds(data, deleting).has(props.view.folderId)
            )
              props.onView({ kind: "all" });
            store.deleteFolder(deleting);
            if (props.mode === "browse") props.onNotice(t("folders.deleted"));
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </Modal>
  );
}

function Row({
  icon,
  label,
  count,
  on = false,
  depth = 0,
  accent = false,
  onClick,
  more,
  moreLabel,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  on?: boolean;
  depth?: number;
  accent?: boolean;
  onClick: () => void;
  more?: (at: { x: number; y: number }) => void;
  moreLabel?: string;
}) {
  const moreRef = useRef<HTMLButtonElement>(null);
  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={onClick}
        aria-current={on ? "true" : undefined}
        style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
        className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md py-2 pr-2 text-left transition-colors ${
          on ? "bg-accent/15 text-fg-bright" : "hover:bg-surface-2"
        } ${accent ? "text-accent" : on ? "" : "text-fg"}`}
      >
        <span
          className={`shrink-0 ${accent || on ? "text-accent" : "text-muted"}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {on && <CheckIcon className="h-4 w-4 shrink-0 text-accent" />}
        {count !== undefined && (
          <span className="shrink-0 font-figures text-xs text-muted tabular-nums">
            {count}
          </span>
        )}
      </button>
      {more && (
        <IconButton
          ref={moreRef}
          label={moreLabel ?? ""}
          className="border-transparent"
          onClick={() => {
            const r = moreRef.current?.getBoundingClientRect();
            more(r ? { x: r.right, y: r.bottom } : { x: 0, y: 0 });
          }}
        >
          <MoreIcon className="h-4 w-4" />
        </IconButton>
      )}
    </li>
  );
}

/** A folder's name, new or renamed — and for a new one, where it goes. */
function FolderNameSheet({
  data,
  initial,
  parentId,
  onSave,
  onClose,
}: {
  data: AppData;
  initial: string;
  /** Set for a new folder: the parent it starts under. Absent for a rename. */
  parentId?: string | null;
  onSave: (name: string, parentId: string | null | undefined) => void;
  onClose: () => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial);
  const [parent, setParent] = useState<string | null | undefined>(parentId);
  const tree = useMemo(() => folderTree(data), [data]);
  const creating = parentId !== undefined;
  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="folder-name-title"
      centered
      initialFocusRef={input}
      closeLabel={t("common.close")}
    >
      <ModalHeader
        titleId="folder-name-title"
        title={creating ? t("folders.add") : t("folders.rename")}
        onCancel={onClose}
        onSave={() => onSave(name, parent)}
        saveDisabled={!name.trim()}
        saveLabel={creating ? t("folders.create") : undefined}
      />
      <div className="flex flex-col gap-3 p-4">
        <input
          ref={input}
          type="text"
          value={name}
          maxLength={120}
          placeholder={t("folders.namePlaceholder")}
          aria-label={t("folders.name")}
          onInput={(e) => setName(e.currentTarget.value)}
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2.5 text-fg-bright outline-none focus:border-accent"
        />
        {creating && tree.length > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <span className="shrink-0 text-muted">{t("folders.inside")}</span>
            <div className="min-w-0 flex-1">
              <SelectPicker<string>
                value={parent ?? ""}
                options={[
                  { value: "", label: t("folders.top") },
                  ...tree.map(({ folder: f, depth }) => ({
                    value: f.id,
                    label: `${"  ".repeat(depth)}${f.name}`,
                  })),
                ]}
                onChange={(next) => setParent(next || null)}
                ariaLabel={t("folders.inside")}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
