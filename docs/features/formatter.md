[Docs](../README.md) › Features › **Formatter**

# Formatter

Experimental, off by default (`scs-intellisense.formatter.enabled`). Code: `apps/server/src/formatter/`.

The extension is the **default formatter** for `.sii`/`.sui`: `configurationDefaults` in `apps/client/package.json` sets `editor.defaultFormatter` for `[sii]` and `[sui]`. A language default from an extension beats a global `editor.defaultFormatter` (VS Code's settings precedence), so a user whose default is Prettier still gets this formatter for Shift+Alt+F and Format Selection, with nothing written to their `settings.json`. Without it VS Code asks to "Configure Default Formatter", because the global default can't format these files. Formatting is therefore declared even while the formatter is off (see rule 4 in [the overview](../architecture/overview.md)).

## Format Document (`format.ts`)

`formatSiiDocument()` rebuilds the file from the reader's tree instead of editing the text in place:

- Units, includes, attributes and comments are collected per nesting level and sorted by **position**, so a comment can't be lost because it isn't part of a unit.
- Every piece of content (class and unit names, keys, values, comments, include paths) is copied **verbatim** from the original text. Only the whitespace between pieces is generated, so values are never rewritten.
- Output: `key: value`, `class : unit`, at most one blank line in a row, a final newline. `formatter.braceStyle` chooses `1tbs` (`{` on the header line, the default) or `allman` (`{` on the next line).
- **Indentation follows the editor.** Every Format Document request carries VS Code's formatting options for the file (`editor.tabSize` and `editor.insertSpaces`, as detected from the content when `editor.detectIndentation` is on); `indentFromEditor()` turns them into a tab or N spaces. That keeps the formatter and the editor's own indent on Enter in step: with a fixed indent, a game file (tabs) was formatted with spaces and Enter then indented with a tab. Format on save sends the open editor's resolved options; Format All uses an open file's editor options, or the `[sii]` editor settings for files that aren't open.
- `formatter.indentUnits` (default on) indents units one level inside `SiiNunit { }`; off keeps them at column 0. Game files do both. A `.sui` has no wrapper, so it doesn't apply there.
- `@include` always goes to column 0, because the game ignores an indented one.
- A comment that followed something on the same line stays on that line. A comment between the unit name and `{` stays on the header line (in `1tbs` it goes after the `{`, since before it a line comment would swallow the brace).
- A `.sui` never gets a `SiiNunit` wrapper.
- If the reader reported any structural issue, the file isn't formatted at all: the tree may be incomplete.
- Format Document goes through `checkFormatting()` (see [the safety check](#the-safety-check)), so it returns no edit for a file that is already formatted, has structural issues, or would change content.
- Every outcome is logged with the file: `FORMAT_APPLIED`, `FORMAT_UNCHANGED` and `FORMAT_SKIPPED` at debug (they happen on every save), `FORMAT_UNSAFE_RESULT` as a warning (a formatter bug) and `FORMAT_FAILED` as an error. Only rule problems in a name (`a..b`, a duplicate) don't stop formatting: the file's structure is intact, and the name is copied as it is.

## Format Selection (`rangeFormat.ts`)

`Ctrl+K Ctrl+F`, or Format Selection in the context menu. VS Code also uses it for `editor.formatOnPaste`.

- `formatSiiRange()` in `format.ts` formats the **top-level items** (units, includes, comments, or a `.sui`'s bare attributes) the selection touches, each one whole, with the same emitters as Format Document. A selection, or just the cursor, inside a unit body formats that unit; nothing outside those items changes.
- Items on the same line go together (`} # end`, two units on one line), so a line is never split. If one shares its line with something outside them (`SiiNunit { truck : .a {`), nothing is formatted.
- The `SiiNunit` header and its closing `}` are never touched, and neither is the final newline.
- Same rules as Format Document: nothing happens in a file with structural issues, and `formatRange()` runs the result through the same safety check (`keepsContent()`).
- The edit returned is the smallest one (common start and end trimmed), so untouched lines aren't replaced.

## Format on save (`apps/client/src/formatOnSave.ts`)

`scs-intellisense.formatter.formatOnSave` (on by default) formats `.sii`/`.sui` files as they are saved, without asking users to set `editor.formatOnSave` or `editor.defaultFormatter`:

- The client listens to `onWillSaveTextDocument` and asks **this extension's server** for the edits (`textDocument/formatting`), so the result never depends on which formatter VS Code would pick. The edits become part of the save, and Ctrl+Z undoes them.
- It does nothing when the formatter is off, when the save is an auto-save after a delay (VS Code's own format on save skips those too), or when the user already turned on `editor.formatOnSave` for the file (VS Code formats it then).
- It's read on every save, like every other setting, so changing it needs no reload.

## Formatting many files (`workspaceFormat.ts`)

Backs **Check Formatting of All Files** and **Format All Files**. Most of those files aren't open, so the server reads and writes them itself:

- Files are decoded as UTF-8. Binary (`BSII`, `ScsC`, a NUL byte) and non-UTF-8 files are skipped, not guessed at. A BOM and CRLF line endings are kept as they were.
- Open files aren't written to disk: their new text goes back to the client and is applied as an editor edit (undoable, unsaved changes kept).

### The safety check

Before a result is written, `checkFormatting()` confirms it changed nothing but whitespace. The formatted text is read again, and:

1. it must parse with no structural issues;
2. its content pieces (comments, class and unit names, keys, values, includes) must be identical to the original's, in the same order;
3. its non-whitespace characters outside comments must be identical to the original's.

A file that fails is skipped and reported as a formatter bug. Check 2 catches changes *inside* a value or comment; check 3 catches anything the tree doesn't record as a piece.

Last full run: 44,503 `.sii`/`.sui` files of ATS 1.61 (16 of its 66 archives: the base game and 10 DLCs) pass the check, and formatting a second time changes nothing, in both brace styles, with tabs or spaces, units indented or not.

## Tests

`apps/server/test/features.test.ts` (formatter output), `rangeFormat.test.ts` (Format Selection), `workspaceFormat.test.ts` (safety check, encodings, writing) and `fixtures.test.ts` (every real-file excerpt must format to a stable result without losing a word).

---

← [Diagnostics](./diagnostics.md) · [File format](../reference/file-format.md) →
