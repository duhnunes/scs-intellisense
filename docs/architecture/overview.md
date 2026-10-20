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

- `src/extension.ts` starts the `LanguageClient`, passes the storage folder and the settings in `initializationOptions` and prints the server's log notifications in the **SCS IntelliSense** Output channel.
- `src/configManager.ts` sends every setting to the server when any of them changes (`serverSettings()`, also used at startup), and registers **Refresh Schema Database**.
- `src/workspaceFormat.ts` implements **Check Formatting of All Files** and **Format All Files**: it finds the files, asks for confirmation, applies edits to open editors and writes the report. Reading, formatting and writing files happen in the server.
- `src/formatOnSave.ts` formats `.sii`/`.sui` on save, asking the server for the edits.
- `src/log.ts` is the **SCS IntelliSense** log channel (see [Logging](#logging)); `src/bugReport.ts` implements **Copy Bug Report Info**.
- `package.json` is the extension manifest: languages, grammars, settings, commands.
- `syntaxes/` holds a minimal TextMate grammar that only marks comments and strings. All real coloring comes from the server's semantic tokens; the grammar exists because VS Code's bracket pair colorization and bracket matching skip brackets inside comments and strings, and they learn what those are only from a TextMate grammar.

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
2. **Every feature reads the tree; none re-reads the text.** Highlighting, diagnostics, Outline, formatter, completion and hover all consume `SiiDocument`. A second tokenizer would sooner or later disagree with the reader. The one exception is the TextMate grammar in `apps/client/syntaxes/`, which VS Code requires for brackets: it is kept to comments and strings only, and must follow the same rules as `scanSiiComments()` (`#` and `//` to the end of the line, nestable `/* */`, quotes and escapes). Change both together.
3. **Ranges are offsets into the normalized text.** `parsed.text` has no BOM and LF line endings. Convert an offset to a line/column through `TextDocument.create(uri, languageId, version, parsed.text)`, never through the editor's original text, or positions drift on Windows (CRLF) files.
4. **Every capability is declared; settings are live.** Completion, hover, formatting and the rest are declared in `onInitialize` whether their feature is on or off, and each handler reads the current `settings` (`settings.ts`) on every request, answering with nothing right away when its feature is off. The client sends every `scs-intellisense.*` setting in `initializationOptions.settings` and again on any change (`scsIntellisense/updateSettings`, built by `serverSettings()` in `configManager.ts`), so no setting needs a window reload. Settings whose result is already on screen (diagnostic severities, highlighting) are redone when the notification arrives. Formatting couldn't be conditional anyway: the extension is the default formatter for `.sii`/`.sui` (`configurationDefaults` in the client manifest), and VS Code flags a default formatter that declares no formatting as a conflict on every file.
5. **Logging goes only through the logger.** In the server, `logger.ts` (sent as `scsIntellisense/log`); in the client, `log.ts`. Never `console.*` or `connection.console`: those end up somewhere the user never looks, or print a message twice. See [Logging](#logging).
6. **The extension never writes to the user's settings.** VS Code settings it needs for `.sii`/`.sui` (default formatter, semantic highlighting, no word-based suggestions) are language defaults in `configurationDefaults` in the client manifest. They apply only to these files and beat a global user value, without touching `settings.json`.

## Logging

Everything the extension logs lands in one place: the **SCS IntelliSense** channel of the Output panel. It's a VS Code *log* channel, so every line has a timestamp and a level, and users choose which levels they see (the level filter in the Output panel, or **Developer: Set Log Level**). VS Code shows `info` and above by default.

Every entry has:

| Field | Rule |
|---|---|
| level | `debug`: useful only when hunting a bug (a format skipped because the file is mid-edit, a cache that didn't change). `info`: something a user may want to know happened. `warning`: something didn't work, but the extension carries on. `error`: something broke. |
| code | `AREA_EVENT` in upper snake case: `SCHEMA_FETCH_FAILED`, `FORMAT_SKIPPED`. Stable and searchable, so a line in a bug report leads straight to the code that wrote it. |
| message | One sentence: what happened, and why when it's known. |
| details | Technical extra. For errors, the stack: pass the caught value through `describeError()`. |
| file | The URI of the file involved, when there is one. The client shows it relative to the workspace. |

```ts
logger.warn('SCHEMA_FETCH_FAILED', `Schema fetch failed for "${name}" (offline?)`, describeError(err))
```

Pick the level by who needs it: if a user who never had a problem would see the line on every save or every keystroke, it's `debug`.

The client keeps the last 200 entries of every level, including the ones filtered out of the channel. **Copy Bug Report Info** puts the last 50 into the report, with versions and settings.

## The reader in short

- `readSiiDocument(text)` reads a `.sii`: the `SiiNunit` marker, the root `{ }`, then units and top-level `@include`.
- `readScsDocument(text, 'sui')` reads a `.sui`: the same without the root. At the top level an item followed by `{` is a unit; anything else is a bare attribute (`document.attributes`), because a `.sui` can be a unit body fragment.
- Comments are found first and masked with spaces, so nothing inside a comment is parsed, while every offset stays the same.
- It never throws. Structural problems (a missing `:`, a header it can't read) become `SiiIssue`s in `document.issues`, and it recovers to keep reading.

The details, with a worked example and diagrams, are in [The reader](./reader.md). The formats it accepts are described in [File format](../reference/file-format.md).

---

[The reader](./reader.md) →
