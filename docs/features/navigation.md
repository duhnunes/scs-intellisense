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

## Rename

F2 on a unit's name, in its header or in a pointer to it, renames the definitions and every pointer in the open folders. The quotes stay as written. The new name goes through the same rules as the diagnostics (`validateUnitName`), so `a..b` is refused with the diagnostic's message. Renaming `.a` to `a.b` makes the unit global; that's the user's call.

A name that isn't defined in the open folders (a unit of the game, or of another mod) can't be renamed: only the pointers would change.

**What it can't see:** only the text files of the open folders. A map (binary `.base`/`.data` files) or another mod that uses the old name keeps it. For example, the prefab units of a map mod are used by its map, not by any `.sii`.

---

← [Formatter](./formatter.md) · [File format](../reference/file-format.md) →
