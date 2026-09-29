---
name: update-docs
description: "Use when source under src/ has changed and the docs/ topics that describe it may no longer be true. Re-reads the changed modules and rewrites the affected docs so every documented behaviour matches the code."
---

# Update docs

Keeps `docs/` honest. The docs in this repo describe _behaviour that is derived_, not stored — so a one-line change to a rule in `types.ts` or `folders.ts` (how long the trash keeps a recording, what a deleted folder's contents do) can silently falsify a paragraph in `docs/architecture.md` or a feature doc without breaking a single test. That is the specific drift this skill exists to catch.

## When to run

- Any change under `src/app/` that a `docs/` topic describes.
- A new `VITE_*` variable, a new setting, or a new storage key.
- Before a release, as part of the `maintenance` sweep.

## Tracking mechanism

`.agents/skills/update-docs/.last-updated` holds the commit this skill last ran against. Diff from it to find what moved:

```sh
BASELINE=$(cat .agents/skills/update-docs/.last-updated 2>/dev/null)
git diff --name-only "${BASELINE:-$(git rev-list --max-parents=0 HEAD)}"..HEAD -- src pwa-plugin.ts vite.config.ts
```

## Discovery process

1. List the changed source files with the command above.
2. For each, look up its row in the mapping table below.
3. Read the changed module — the **whole** module, not the diff — and then read the doc it maps to. The question is not "does the diff appear in the doc" but "is every sentence in the doc still true".
4. Pay special attention to numbers and rules quoted in prose: the trash and tombstone days, the bitrates and sample rates offered, the FLAC levels, the WAV depths, the skip lengths, the debounce interval, the file and folder names on a backend, the clip rule the framework's meter uses. These are the values most likely to be edited in code and forgotten in prose.

## Mapping

| Changed source                                       | Doc to update                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/app/types.ts`, `folders.ts`                     | `docs/architecture.md` ("The shape of the data"); `docs/features/library.md`; `docs/features/folders.md` |
| `src/app/takes.ts`, `RecordScreen.tsx`               | `docs/features/record.md`; the README's Usage table                                                      |
| `src/app/export.ts`, `ExportModal.tsx`               | `docs/features/export.md`; the README's Examples block if the plan's shape moved                         |
| `src/app/merge.ts`, `src/app/useSyncEngine.ts`       | `docs/sync.md`; `docs/features/cloud-sync.md`; `docs/features/encryption.md`                             |
| `src/app/useNamespaces.ts`                           | `docs/features/spaces.md`; `docs/sync.md`                                                                |
| `src/app/cloudHost.ts`, `native/`                    | `docs/sync.md`; `docs/features/native-app.md`; `native/README.md`                                        |
| `tauri/`                                             | `docs/features/desktop-app.md`; `tauri/README.md`                                                        |
| `src/app/migrations.ts`                              | `docs/architecture.md` ("The shape of the data")                                                         |
| `src/app/useAppSettings.ts`                          | `docs/configuration.md` (runtime settings table)                                                         |
| `src/vite-env.d.ts`, `vite.config.ts`                | `docs/configuration.md` (build-time table); the README's Configuration table                             |
| `src/app/*Screen.tsx`, `BottomNav.tsx`, `TopBar.tsx` | The matching `docs/features/*.md`; the README's Usage table                                              |
| `pwa-plugin.ts`, `src/app/pwa.ts`                    | `docs/architecture.md` (service worker section)                                                          |
| A new localStorage key anywhere                      | `docs/configuration.md` (storage keys table)                                                             |

## Update checklist

- [ ] Rewrite the affected prose so it states what the code now does
- [ ] Check every cross-link still resolves (`docs/` → `docs/`, README → `docs/`)
- [ ] Check the feature docs still match their `[Learn more](feature:<slug>)` slugs in `CHANGELOG.md`
- [ ] Leave no "TODO" or placeholder text behind
- [ ] `make fmt` (prettier formats markdown too)
- [ ] Record the marker:

      git rev-parse HEAD > .agents/skills/update-docs/.last-updated

## Verification

1. Every claim you left in the doc can be traced to a line of source you read this run.
2. No doc mentions a symbol, file, setting, or default that no longer exists — grep for the old name to be sure.
3. `make fmt-check` passes.
4. The diff touches `docs/`, the README, and the `.last-updated` marker only.

## Skill self-improvement

If a source change falsified a doc that this skill's mapping table does not cover, add the row before you finish. If you found yourself re-checking the same numbers by hand, add them to the Discovery process's list of values to watch.
