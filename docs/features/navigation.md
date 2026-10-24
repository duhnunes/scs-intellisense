[Docs](../README.md) › Features › **Navigation**

# Navigation: the workspace index

Go to Definition, Find References and Rename Symbol (F2) for unit names, across every `.sii`/`.sui` of the folders open in VS Code. Pointer completion uses the same index to offer units of other files. Always on, like quick fixes: they only act when the user asks.

| File | What it does |
|---|---|
| `apps/server/src/index/workspaceIndex.ts` | Reads the folders and keeps, per file, the units it defines, its values that could be unit names, and its `@include`s |
| `apps/server/src/index/navigation.ts` | The queries: what is under the cursor, definitions, references, rename edits, and whether a new name is valid |
| `apps/server/src/index/handlers.ts` | The LSP side: keeping the index current and answering the requests |

## Keeping it current

On startup the server reads every `.sii`/`.sui` under the workspace folders (hidden folders and `node_modules` skipped), a batch at a time, so other requests are still answered meanwhile. 13,114 files (`def/def/sign` of ATS 1.61) take about 6 seconds.

- An open file is indexed from the editor's text on every change, saved or not.
- Closing it reads it again from disk.
- Files changed outside the editor (git, a converter) arrive through the client's file watcher (`synchronize.fileEvents` in `extension.ts`).
- Added or removed workspace folders are read again.

## What a name means

A name starting with `.` is a nameless unit: it exists only in its file (wiki). `_nameless.*` names are treated the same way: that is how SCS's tools write nameless units out, and in ATS 1.61 the same `_nameless.*` name is defined in dozens of files with different content (`_nameless._.window`: 39), so it can't be one unit. This part is inferred from the files, not documented.

Every other name is global. The same name in several files gives several definitions, and Go to Definition shows them all: which one the user means is the user's call. In ATS 1.61, 9,181 names are defined in more than one file, nearly all of them identical copies of one file shipped in two archives (`base/effect/def/eut2_interfaces.sui` and `effect/effect/eut2_interfaces.sui`).

Quotes don't count: `"a.b"` and `a.b` are the same name here.

## What a pointer is

A value is a pointer when its class's schema types the key `owner_ptr` or `link_ptr`. The index keeps every value that could be a unit name, and the schema decides at query time. Two cases need care:

- **Array counts.** `items: 5` on an array attribute is how many elements follow (`items[0]: ...`), not a pointer. Ignoring this gave 30,482 false pointers in ATS 1.61.
- **`.sui` fragments.** Bare attributes in a `.sui` have no class of their own: they take the class of every unit that `@include`s the file. Without this, a rename would miss the pointers inside fragments.

## .sui fragments

A `.sui` of bare attributes is a unit body fragment: `@include` pastes it into a unit whose class is in another file. The index gives it that class (`classesOf()`), and `index/fragments.ts` shows its attributes to completion, hover, the schema rules and their quick fixes as the body of a nameless unit of that class (`asFragmentDocument()`). Highlighting, Outline and the structure rules still see the file as written.

- **Nested fragments:** a fragment included by another fragment takes that one's classes (`goal_bonus_time_limit.sui` → `goal_bonus.sui` in ATS 1.61).
- **`/` includes** resolve from the mod's root or part, like completion does.
- **Several classes:** a fragment included by units of different classes gets them all (`a|b`), and its schema is their union (`mergeSchemas()`): a key is unknown only when no class has it, and an enum accepts the values of all. While one of the classes is still loading there is no union, so its keys never show as unknown for a moment.
- **No includer:** a fragment nothing includes in the open folders gets nothing, as before.

On ATS 1.61, the 469 fragments (7,961 attributes) get no unknown-attribute or invalid-enum-value warning; 2 are included by units of two classes. Those of ATS Expansion (10, written by Mods Studio 2) get none either.

## Rename

F2 on a unit's name, in its header or in a pointer to it, renames the definitions and every pointer in the open folders. The quotes stay as written. The new name goes through the same rules as the diagnostics (`validateUnitName`), so `a..b` is refused with the diagnostic's message. Renaming `.a` to `a.b` makes the unit global; that's the user's call.

A name that isn't defined in the open folders (a unit of the game, or of another mod) can't be renamed: only the pointers would change.

**What it can't see:** only the text files of the open folders. A map (binary `.base`/`.data` files) or another mod that uses the old name keeps it. For example, the prefab units of a map mod are used by its map, not by any `.sii`.

## Paths

Go to Definition on a path (`model: "/vehicle/truck/cabin.pmd"`, `@include "parts/cab.sui"`, after a `name|` too) opens the file it names; Find References on it lists every path in the open folders naming the same file, `.mat` and text `.tobj` included (`index/filePaths.ts`). A `/` path resolves from the mod's root or whichever `base/`/`dlc_*` part has the file; a relative one from the file's folder. A path to one of the game's files has nowhere to go, like a pointer to one of its units. The link covers the whole path, as with unit names. On ATS Expansion, the references of `ai_comp_cust.pmd` (4 files, the same as a search) come in 11 ms: a path ends with its file's name, so most are skipped without resolving.

## Moving files

Renaming or moving a file or folder in VS Code (Explorer, drag and drop) updates every path that points to it, in the same step and without asking, like TypeScript does with imports. `index/fileMoves.ts` computes the edits on `workspace/willRenameFiles`, which VS Code sends before the move.

- **What is updated:** `@include` paths, and the quoted file paths of attributes (`model: "/vehicle/truck/cabin.pmd"`), including after a `name|` (`sounds[]: "OY|/sound/horn.soundref"`), in every `.sii`/`.sui` of the open folders. The texture paths of `.mat` files and of text `.tobj` files too (`index/texturePaths.ts`). A path to anything inside a moved folder is updated too. So are the relative paths of a moved file itself.
- **`.mat` and `.tobj`:** not SII, so each has a small line scanner of its own, for paths only. A `.mat` comes in two formats: the game's (`texture : "texture_base" { source : "/material/.../x.tobj" }`, 67,089 files in ATS 1.61) and the older one mods still write (`texture : "welker.tobj"`, `texture[0] : "/material/..."`). A path is the value of `source`, `texture` or `texture[n]` that ends in a texture's extension: `texture` also holds names, and `material : "eut2.dif"` is a shader. A text `.tobj`, as SCS Blender Tools exports it (`map 2d house_a.tga`), has its files after `map <type>`. A compiled `.tobj` is binary and is left out.
- **How paths are written:** a `/` path stays a `/` path, from the mod's root or its `base/`/`dlc_*` part (`findPathRoots`). A relative one stays relative while it can. None of the 2,814 `@include`s of ATS 1.61 uses `../`, so one that would need it becomes a `/` path instead.
- **Marks:** VS Code opens the changed files unsaved. The client (`apps/client/src/pathEditMarks.ts`) sees the edits through the language client's `willRenameFiles` middleware and marks those lines with a bar at the start of the line and on the scrollbar, in the theme's color for lines git marks as modified, so they're easy to find in a long file. The bar is a left border on the whole line: a gutter icon (an SVG data URI on an empty range) showed nothing. The marks follow lines added above them, and go when the line no longer holds the path written there (Ctrl+Z on the move, or edited by hand) or when the file is saved or closed. Not on "the file is no longer dirty": a file VS Code opens to apply the edits reports the change before it counts as unsaved, so the marks went at once. Each move logs `PATH_MARKS_ADDED`.
- **Undo:** VS Code puts the path edits in the move's undo group, but undoing a folder rename put the folder back and left the edits (ATS Expansion: 61 `.mat` kept the new folder name, so every path broke). The client (`apps/client/src/moveUndo.ts`) remembers the last move's edits with the text they replaced; when that move is reversed, each line still holding the new text gets the old one back (`PATHS_RESTORED` in the log). Where VS Code did undo them, nothing is left to do.
- **Unsaved `.mat`/`.tobj`:** they aren't the extension's languages, so VS Code doesn't send their text to the server. The client sends it (`scsIntellisense/textureFileChanged`/`textureFileClosed`), so a second move before saving sees the paths the first one wrote.
- **What is left alone:** a path that can't be written either way (the file moved out of the mod), and moves made outside VS Code (another program, the command line), which VS Code doesn't announce.

VS Code waits for the edits before moving, so most paths are skipped with a string check: a path can only reach a moved item through its name. Renaming the `f350_heavy_duty` folder of ATS Expansion (16,990 indexed files, 11,345 of them `.mat`) gives 105 edits in 66 files, the same as a search for the path, in under 0.1 s. Indexing those files takes about 12 s, in the background.

---

← [Formatter](./formatter.md) · [File format](../reference/file-format.md) →
