[Docs](../README.md) › Features › **Formatter**

# Formatter

Experimental, off by default (`scs-intellisense.formatter.enabled`). Code: `apps/server/src/formatter/`.

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

## Format on save (`apps/client/src/formatOnSave.ts`)

`scs-intellisense.formatter.formatOnSave` (on by default) formats `.sii`/`.sui` files as they are saved, without asking users to set `editor.formatOnSave` or `editor.defaultFormatter`:

- The client listens to `onWillSaveTextDocument` and asks **this extension's server** for the edits (`textDocument/formatting`), so the result never depends on which formatter VS Code would pick. The edits become part of the save, and Ctrl+Z undoes them.
- It does nothing when the formatter is off, when the save is an auto-save after a delay (VS Code's own format on save skips those too), or when the user already turned on `editor.formatOnSave` for the file (VS Code formats it then).
- Unlike `formatter.enabled`, it's read on every save, so changing it needs no reload. If the formatter was enabled without a reload, the server has no formatter yet and the file is simply saved as it is.

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

Last full run: all 34,843 `.sii`/`.sui` files of ATS 1.61 pass the check, and formatting a second time changes nothing, in both brace styles.

## Tests

`apps/server/test/features.test.ts` (formatter output), `workspaceFormat.test.ts` (safety check, encodings, writing) and `fixtures.test.ts` (every real-file excerpt must format to a stable result without losing a word).

---

← [Diagnostics](./diagnostics.md) · [File format](../reference/file-format.md) →
