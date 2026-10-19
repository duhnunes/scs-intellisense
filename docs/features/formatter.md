[Docs](../README.md) › Features › **Formatter**

# Formatter

Experimental, off by default (`scs-intellisense.formatter.enabled`). Code: `apps/server/src/formatter/`.

## Format Document (`format.ts`)

`formatSiiDocument()` rebuilds the file from the reader's tree instead of editing the text in place:

- Units, includes, attributes and comments are collected per nesting level and sorted by **position**, so a comment can't be lost because it isn't part of a unit.
- Every piece of content (class and unit names, keys, values, comments, include paths) is copied **verbatim** from the original text. Only the whitespace between pieces is generated, so values are never rewritten.
- Output: 2-space indent, `key: value`, `class : unit`, at most one blank line in a row, a final newline. `formatter.braceStyle` chooses `1tbs` (`{` on the header line, the default) or `allman` (`{` on the next line).
- `@include` always goes to column 0, because the game ignores an indented one.
- A comment that followed something on the same line stays on that line. A comment between the unit name and `{` stays on the header line (in `1tbs` it goes after the `{`, since before it a line comment would swallow the brace).
- A `.sui` never gets a `SiiNunit` wrapper.
- If the reader reported any structural issue, the file isn't formatted at all: the tree may be incomplete.

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
