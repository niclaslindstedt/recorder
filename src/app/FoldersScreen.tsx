// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useMemo, useState } from "react";

import {
  Button,
  ConfirmDialog,
  FolderIcon,
  InlineEditField,
  Modal,
  PlusIcon,
  ReorderButtons,
  RowActionMenu,
  SelectPicker,
  type RowAction,
} from "@niclaslindstedt/oss-framework/components";

import { canNest, childrenByParent, countIn, folderTree } from "./folders.ts";
import { useT } from "./i18n/index.ts";
import { ModalHeader } from "./ModalHeader.tsx";
import type { AppData, Folder } from "./types.ts";
import type { DocStore } from "./useDocStore.ts";

// The Folders screen: the tree, indented, with how many recordings each
// holds (its own and everything under it). A tap opens the folder's
// recordings; a hold renames, moves, deletes or makes a subfolder; the
// arrows arrange siblings by hand.

type Props = {
  data: AppData;
  store: DocStore;
  onOpen: (folderId: string) => void;
  onNotice: (message: string) => void;
};

export function FoldersScreen({ data, store, onOpen, onNotice }: Props) {
  const t = useT();
  const tree = useMemo(() => folderTree(data), [data]);
  const children = useMemo(() => childrenByParent(data), [data]);
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState<Folder | null>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);

  const siblingsOf = (f: Folder) => children.get(f.parentId) ?? [];

  return (
    <div className="flex min-h-full flex-1 flex-col gap-3 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-fg-bright">
          {t("folders.title")}
        </h2>
        <Button variant="primary" onClick={() => setAdding({ parentId: null })}>
          <PlusIcon className="h-4 w-4" />
          {t("folders.add")}
        </Button>
      </div>

      {adding && adding.parentId === null && (
        <NewFolderRow
          onCommit={(name) => {
            if (name.trim()) store.addFolder(name, null);
            setAdding(null);
          }}
          onCancel={() => setAdding(null)}
        />
      )}

      {tree.length === 0 && !adding ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-12 text-center">
          <p className="text-fg">{t("folders.empty")}</p>
          <p className="max-w-xs text-sm text-muted">
            {t("folders.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tree.map(({ folder, depth }) => {
            const siblings = siblingsOf(folder);
            const at = siblings.findIndex((s) => s.id === folder.id);
            const actions: RowAction[] = [
              {
                label: t("common.rename"),
                onSelect: () => setRenaming(folder.id),
              },
              {
                label: t("folders.addIn", { name: folder.name }),
                onSelect: () => setAdding({ parentId: folder.id }),
              },
              { label: t("folders.move"), onSelect: () => setMoving(folder) },
              {
                label: t("folders.delete"),
                onSelect: () => setDeleting(folder),
                danger: true,
              },
            ];
            return (
              <li key={folder.id} style={{ paddingLeft: `${depth * 1.25}rem` }}>
                <RowActionMenu actions={actions} ariaLabel={folder.name}>
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => onOpen(folder.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                    >
                      <FolderIcon className="h-5 w-5 shrink-0 text-accent" />
                      {renaming === folder.id ? (
                        <InlineEditField
                          initial={folder.name}
                          selectOnFocus
                          ariaLabel={t("folders.rename")}
                          onCommit={(value) => {
                            if (value.trim())
                              store.renameFolder(folder.id, value);
                            setRenaming(null);
                          }}
                          onCancel={() => setRenaming(null)}
                        />
                      ) : (
                        <span className="truncate text-fg-bright">
                          {folder.name}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 rounded-full bg-surface-2 px-2 text-xs text-muted">
                        {t("folders.count", {
                          count: String(countIn(data, folder.id)),
                        })}
                      </span>
                    </button>
                    <ReorderButtons
                      upLabel={t("folders.up")}
                      downLabel={t("folders.down")}
                      canMoveUp={at > 0}
                      canMoveDown={at >= 0 && at < siblings.length - 1}
                      onMoveUp={() => {
                        const ids = siblings.map((s) => s.id);
                        [ids[at - 1], ids[at]] = [ids[at]!, ids[at - 1]!];
                        store.reorderFolders(folder.parentId, ids);
                      }}
                      onMoveDown={() => {
                        const ids = siblings.map((s) => s.id);
                        [ids[at + 1], ids[at]] = [ids[at]!, ids[at + 1]!];
                        store.reorderFolders(folder.parentId, ids);
                      }}
                    />
                  </div>
                </RowActionMenu>
                {adding && adding.parentId === folder.id && (
                  <div className="mt-1.5 pl-6">
                    <NewFolderRow
                      onCommit={(name) => {
                        if (name.trim()) store.addFolder(name, folder.id);
                        setAdding(null);
                      }}
                      onCancel={() => setAdding(null)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {moving && (
        <MoveFolderSheet
          data={data}
          folder={moving}
          onMove={(parentId) => {
            store.moveFolder(moving.id, parentId);
            setMoving(null);
          }}
          onClose={() => setMoving(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("folders.deleteConfirm", { name: deleting?.name ?? "" })}
        description={t("folders.deleteHint")}
        confirmLabel={t("common.delete")}
        tone="danger"
        labels={{ cancel: t("common.cancel"), close: t("common.close") }}
        onConfirm={() => {
          if (deleting) {
            store.deleteFolder(deleting.id);
            onNotice(t("common.done"));
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function NewFolderRow({
  onCommit,
  onCancel,
}: {
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-accent bg-surface px-3 py-2">
      <FolderIcon className="h-5 w-5 shrink-0 text-accent" />
      <InlineEditField
        placeholder={t("folders.namePlaceholder")}
        ariaLabel={t("folders.name")}
        onCommit={(value) => onCommit(value)}
        onCancel={onCancel}
      />
    </div>
  );
}

/** Where a folder, or a recording, goes: every folder it may go under, and
 *  the top level. Shared with the library's Move action. */
export function MoveFolderSheet({
  data,
  folder,
  recordingId,
  onMove,
  onClose,
}: {
  data: AppData;
  folder?: Folder;
  recordingId?: string;
  onMove: (parentId: string | null) => void;
  onClose: () => void;
}) {
  const t = useT();
  const tree = useMemo(() => folderTree(data), [data]);
  const current = folder
    ? folder.parentId
    : recordingId
      ? (data.recordings[recordingId]?.folderId ?? null)
      : null;
  const [target, setTarget] = useState<string | null>(current);
  const options = useMemo(
    () => [
      { value: "", label: t("folders.top") },
      ...tree
        .filter(({ folder: f }) => !folder || canNest(data, folder.id, f.id))
        .map(({ folder: f, depth }) => ({
          value: f.id,
          label: `${"  ".repeat(depth)}${f.name}`,
        })),
    ],
    [tree, data, folder, t],
  );
  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="move-title"
      centered
      closeLabel={t("common.close")}
    >
      <ModalHeader
        titleId="move-title"
        title={folder ? t("folders.move") : t("library.move")}
        onCancel={onClose}
        onSave={() => onMove(target)}
      />
      <div className="flex flex-col gap-2 p-4">
        <span className="text-xs font-medium text-fg">
          {t("folders.moveTo")}
        </span>
        <SelectPicker<string>
          value={target ?? ""}
          options={options}
          onChange={(next) => setTarget(next || null)}
          ariaLabel={t("folders.moveTo")}
        />
      </div>
    </Modal>
  );
}
