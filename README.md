<div align="center">
  <img src="./apps/client/public/icon.png" width="160" alt="SCS IntelliSense logo" />
  <h1>SCS IntelliSense</h1>
  <p>VS Code support for SCS Software mod files (American Truck Simulator / Euro Truck Simulator 2)</p>
</div>

<div align="center">
  <a href="./LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-FF6A00?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=DuHNunes.scs-intellisense"><img src="https://img.shields.io/github/v/release/duhnunes/scs-intellisense?display_name=tag&style=for-the-badge" alt="Latest release" /></a>
  <a href="https://scs-intellisense.vercel.app/docs"><img src="https://img.shields.io/badge/docs-scs--intellisense-FF6A00?style=for-the-badge" alt="Documentation" /></a>
  <img src="https://img.shields.io/badge/status-beta-FF6A00?style=for-the-badge" alt="Status: beta" />
</div>

> **Unofficial community project.** SCS IntelliSense is not affiliated with or endorsed by SCS Software. Euro Truck Simulator 2, American Truck Simulator and SCS Software are trademarks of their respective owners.

## What it is

**SCS IntelliSense** is a VS Code extension for the `.sii` and `.sui` files used by SCS Software games and mods. These files are usually edited as plain text; the extension adds highlighting, error checking and navigation, so mistakes show up while you type instead of when the game fails to load.

**Install it** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=DuHNunes.scs-intellisense), or search for **SCS IntelliSense** in the Extensions view (`Ctrl+Shift+X`).

## Features

Always on:

- 🎨 **Semantic highlighting**: class names (including namespaces such as `ui::`), unit names, attribute keys, values, comments and `@include`.
- 🔍 **Diagnostics**: structural errors (missing `:`, `{` or `}`), invalid class and unit names, duplicate unit names in a file, misplaced `@include`, missing final newline, and, from the schema database, attribute keys the class doesn't have and `enum` values it doesn't list (typos).
- 🔧 **Quick fixes** (light bulb, `Ctrl+.`) for problems with one obvious fix: a missing `:` or final newline, `a..b` in a unit name, an unmatched quote, an indented `@include`, a misspelled attribute key or `enum` value.
- 📎 **`@include` paths**: type `@include "` to pick a `.sui` file or folder.
- 🧭 **Outline, breadcrumbs and Go to Symbol** for units, attributes and includes.
- 🧩 **`.sui` fragments** (bare attributes pasted into a unit by `@include`) get completion, hover and the same checks as the unit that includes them.
- 🔗 **Go to Definition, Find References and Rename (F2)** for unit names, across every file of the open folder: Ctrl+click a pointer to jump to its unit, and renaming a unit updates every pointer to it. Ctrl+click a path (`model: "/vehicle/..."`, `@include`) to open the file, Shift+F12 to see who else uses it.
- 📦 **Paths follow your files:** rename or move a file or folder in VS Code, and every `@include`, file path (`model: "/vehicle/..."`) and texture path in `.mat`/`.tobj` files pointing to it is updated, with the changed lines marked until you save. `.mat` files are saved right away, and so is everything past 6 other files (settings), instead of leaving dozens of tabs open.
- 📂 **File icons** for SCS file types.

Experimental (off by default):

- 💡 **Completion** for `class_name`, attribute keys, `enum` values (`part_type: ` → `factory`, `aftermarket`...), units for pointers, from the same file and the rest of the mod (filtered by the class the attribute expects), and the mod's own files for attributes that take one (`model: "/vehicle/..."` lists only `.pmd`).
- 🖱️ **Hover** with descriptions of classes and attributes.
- ✨ **Formatter**: Format Document and Format Selection, plus **Check Formatting of All Files** and **Format All Files** for the whole workspace.

To turn experimental features on, open the Settings (`Ctrl+,`), search for `@ext:DuHNunes.scs-intellisense`, and check the ones you want. They take effect right away. See the [documentation](https://scs-intellisense.vercel.app/docs) for how to use every feature, every setting and every command.

## Tested against the game

The diagnostics are checked against **73,224 `.sii`/`.sui` files of American Truck Simulator 1.61** (the base game and 56 DLCs), with no false errors, and the formatter was run over the same files without changing any content.

SCS's [modding wiki](https://modding.scssoft.com/wiki/Main_Page) is incomplete, and in some places the game's own files differ from it: unit names with uppercase letters or in double quotes, class names such as `ui::text`, `.sui` files that hold only attributes. When the game and the wiki disagree, the extension follows the game.

The extension hasn't been checked against Euro Truck Simulator 2's files yet.

## Schema database

Completion and hover read class and attribute information from a separate repository, [scs-schema](https://github.com/duhnunes/scs-schema). It lists every class of the game (1,327 in ATS 1.61) with the attribute names and types the game uses; most classes have no descriptions yet. Contributions there are welcome: see its [contributing guide](https://github.com/duhnunes/scs-schema/blob/master/CONTRIBUTING.md).

## Reporting problems

Open an [issue](https://github.com/duhnunes/scs-intellisense/issues). The most useful report is an error on a file that **the game loads fine**: include the part of the file and its path (for example `def/world/mover.allflags.sii`).

## Development

Requirements: [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) 11.

```bash
pnpm install
pnpm test
```

| Command | What it does |
|---|---|
| `pnpm test` | Runs the test suite (Vitest, in `apps/server/test`) |
| `pnpm compile` | Builds everything and creates the `.vsix` in `release/latest`, without publishing |
| `pnpm release` | Maintainer only: tests, version bump, changelog, `.vsix`, GitHub release and Marketplace publish |

To run the extension from source, open the repository in VS Code and press `F5` (**Run Extension**). It builds the server and the client first, with source maps for debugging.

### Project structure

- `apps/client`: the VS Code extension. Starts the language server, handles settings and commands.
- `apps/server`: the language server. A tolerant parser reads each file into a tree; highlighting, diagnostics, Outline, formatter, completion and hover all work from that tree.
- `config`: shared ESLint and TypeScript settings.

Want to help? Start with [CONTRIBUTING.md](./CONTRIBUTING.md). The [developer docs](./docs/README.md) cover:

- [Architecture overview](./docs/architecture/overview.md)
- [The reader](./docs/architecture/reader.md): how a file becomes a tree
- [Diagnostics](./docs/features/diagnostics.md): where the rules are and how to add one
- [File format](./docs/reference/file-format.md): what the parser accepts, and where the game differs from the wiki
- [Formatter](./docs/features/formatter.md)

## License

[MIT](./LICENSE.md)
