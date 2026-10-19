[Docs](../README.md) › Architecture › **Overview**

# Overview

SCS IntelliSense is a [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) extension: a small VS Code client starts a language server, and every language feature lives in the server.

```
VS Code ── apps/client ──(LSP over IPC)── apps/server
                                            │
                              sii/reader.ts │ text → tree
                                            ▼
             ┌──────────────┬───────────────┼──────────────┬───────────┬─────────┐
         semantic/     diagnostic/      symbols/       formatter/   completion/  hover/
       (highlighting)   (rules.ts)      (Outline)                   (schema)    (schema)
```

## Client (`apps/client`)

- `src/extension.ts` starts the `LanguageClient`, passes the startup settings in `initializationOptions` and prints the server's log notifications in the **SCS IntelliSense** Output channel.
- `src/configManager.ts` mirrors `semanticHighlighting` into VS Code's own setting, forwards `diagnostics.enabledSeverities` to the server when it changes, and registers **Refresh Schema Database**.
- `src/workspaceFormat.ts` implements **Check Formatting of All Files** and **Format All Files**: it finds the files, asks for confirmation, applies edits to open editors and writes the report. Reading, formatting and writing files happen in the server.
- `package.json` is the extension manifest: languages, settings, commands.

## Server (`apps/server/src`)

| Path | Role |
|---|---|
| `server.ts` | LSP wiring: capabilities, request and notification handlers |
| `sii/reader.ts` | The parser. Turns text into a tree (`SiiDocument`) with offset ranges |
| `interfaces/structure.ts` | The tree's types: `SiiDocument`, `SiiUnit`, `SiiAttribute`, `SiiIssue`... |
| `diagnostic/rules.ts` | Business rules: is this class name, unit name, include... allowed? See [diagnostics.md](../features/diagnostics.md) |
| `diagnostic/index.ts` | `getDiagnostics()`: merges reader and rule issues, filters by severity, converts to LSP |
| `semantic/` | Semantic tokens (highlighting) |
| `symbols/documentSymbols.ts` | Outline, breadcrumbs, Go to Symbol |
| `formatter/format.ts` | Format Document. See [formatter.md](../features/formatter.md) |
| `formatter/workspaceFormat.ts` | Format/check many files, including the ones that aren't open |
| `completion/`, `hover/` | Class name and attribute key completion and hover |
| `schema/client.ts` | `SchemaClient`: fetches and caches the [scs-schema](https://github.com/duhnunes/scs-schema) database |
| `logger.ts` | Logging, sent to the client as `scsIntellisense/log` notifications |

## Rules that keep it working

These are deliberate. A change that breaks one of them usually breaks something far away.

1. **The reader only builds the tree; it never judges.** It reads class and unit names "raw" (greedily, whatever characters they contain) and records their ranges. Whether a name is *valid* is decided afterwards in `diagnostic/rules.ts`. If the reader stopped at the first invalid character, the cursor would get stuck, the rest of the line would be misread and every brace after it would be matched wrong.
2. **Every feature reads the tree; none re-reads the text.** Highlighting, diagnostics, Outline, formatter, completion and hover all consume `SiiDocument`. A second tokenizer would sooner or later disagree with the reader.
3. **Ranges are offsets into the normalized text.** `parsed.text` has no BOM and LF line endings. Convert an offset to a line/column through `TextDocument.create(uri, languageId, version, parsed.text)`, never through the editor's original text, or positions drift on Windows (CRLF) files.
4. **Capabilities are declared only when their feature is on.** Completion, hover and the formatter are registered in `onInitialize` only if enabled. Startup settings travel in `initializationOptions` and need a window reload; only `diagnostics.enabledSeverities` updates live (`scsIntellisense/updateDiagnosticSettings`).
5. **Logging goes only through `scsIntellisense/log`.** Don't also write to `connection.console`.

## The reader in short

- `readSiiDocument(text)` reads a `.sii`: the `SiiNunit` marker, the root `{ }`, then units and top-level `@include`.
- `readScsDocument(text, 'sui')` reads a `.sui`: the same without the root. At the top level an item followed by `{` is a unit; anything else is a bare attribute (`document.attributes`), because a `.sui` can be a unit body fragment.
- Comments are found first and masked with spaces, so nothing inside a comment is parsed, while every offset stays the same.
- It never throws. Structural problems (a missing `:`, a header it can't read) become `SiiIssue`s in `document.issues`, and it recovers to keep reading.

The details, with a worked example and diagrams, are in [The reader](./reader.md). The formats it accepts are described in [File format](../reference/file-format.md).

---

[The reader](./reader.md) →
