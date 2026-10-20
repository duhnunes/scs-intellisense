import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  CodeActionKind,
  CompletionItemKind,
  MarkupKind,
  type CodeAction,
  type CompletionItem,
  type DocumentSymbol,
  type Hover,
  type InitializeResult,
  type TextEdit,
} from 'vscode-languageserver/node'

import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  registerSemantic,
  semanticTokensLegend,
  setSemanticHighlighting,
} from './semantic'
import { describeError, getLogger, initLogger } from './logger'
import { getDiagnostics } from './diagnostic'
import { buildCodeActions } from './diagnostic/codeActions'
import { SchemaClient } from './schema/client'
import { normalizeSiiText, readScsDocument } from './sii'
import { detectExtFromUri, detectModeFromExt } from './parser/docParser'
import {
  buildClassNameCompletionItems,
  isClassNamePosition,
} from './completion/className'
import {
  buildAttributeKeyCompletionItems,
  findAttributeKeyPosition,
} from './completion/attributeKey'
import { buildClassNameHover, findClassNameAtPosition } from './hover/className'
import {
  buildAttributeKeyHover,
  findAttributeKeyAtPosition,
} from './hover/attributeKey'
import { buildDocumentSymbols } from './symbols/documentSymbols'
import { indentFromEditor, type FormatterOptions } from './formatter/format'
import {
  checkFormatting,
  formatFiles,
  type FileFormatResult,
  type FileToFormat,
  type FormatCheckResult,
} from './formatter/workspaceFormat'
import { formatRange, type FormatRangeResult } from './formatter/rangeFormat'
import {
  DEFAULT_SETTINGS,
  describeSettings,
  parseSettings,
  type ServerSettings,
} from './settings'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

initLogger(connection)
const logger = getLogger()

registerSemantic(connection, documents)

// The single schema fetch/cache instance for this server process.
// Completion, hover, and future attribute validation all consult this —
// none of them should ever call fetch() or touch the disk cache directly.
let schemaClient: SchemaClient | undefined

// The current scs-intellisense.* settings. Set in onInitialize and
// replaced on every scsIntellisense/updateSettings, so handlers must read
// it per request, never copy a value out of it at startup.
let settings: ServerSettings = DEFAULT_SETTINGS

let hasStoragePath = false

/** For other server modules (completion, hover, ...) to consult the
 *  schema once it's ready. Returns undefined until onInitialize has run
 *  and the client sent a usable storage path. */
export function getSchemaClient(): SchemaClient | undefined {
  return schemaClient
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const initOptions = params.initializationOptions as
    | { globalStoragePath?: string; settings?: unknown }
    | undefined
  settings = parseSettings(initOptions?.settings)
  setSemanticHighlighting(settings.semanticHighlighting)

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Not experimental, not schema-dependent — always on. Powers the
      // Outline view, breadcrumbs, and "Go to Symbol in Editor".
      documentSymbolProvider: true,
      // Quick fixes for diagnostics. Always on like diagnostics: a fix only
      // changes the file when the user picks it.
      codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
    },
  }

  // Every feature is declared, on or off, and each handler checks its
  // setting on every request: that's what lets a setting take effect
  // without a window reload. A feature that's off answers right away with
  // nothing, before reading the document. The formatter couldn't work any
  // other way anyway: the extension is the default formatter for
  // .sii/.sui (configurationDefaults in the client's package.json), and
  // VS Code flags a default formatter that declares no formatting as
  // unable to format these files, on every .sii.
  result.capabilities.completionProvider = {
    resolveProvider: false,
    triggerCharacters: [],
  }
  result.capabilities.hoverProvider = true
  result.capabilities.documentFormattingProvider = true
  result.capabilities.documentRangeFormattingProvider = true
  result.capabilities.semanticTokensProvider = {
    legend: semanticTokensLegend,
    full: true,
    range: false,
  }

  const globalStoragePath = initOptions?.globalStoragePath

  if (globalStoragePath) {
    schemaClient = new SchemaClient({
      cacheDir: globalStoragePath,
      logger,
      fetchTimeoutMs: settings.fetchTimeoutMs,
    })
    // Fire-and-forget: server startup (and the capabilities response
    // above) must never block on disk I/O or a network round-trip.
    // init() loads whatever's cached on disk first (near-instant), then
    // refreshManifest() checks for something newer in the background.
    void schemaClient
      .init()
      .then(() => schemaClient?.refreshManifest())
      .catch((err) => {
        logger.error(
          'SCHEMA_STARTUP_FAILED',
          'The schema database could not be loaded',
          describeError(err)
        )
      })
  }
  hasStoragePath = Boolean(initOptions?.globalStoragePath)

  return result
})

// Logged here, not in onInitialize: the client only starts listening for
// notifications after it gets the initialize response, so an entry sent
// before that is dropped (and LSP doesn't allow it anyway).
connection.onInitialized(() => {
  logger.info(
    'SERVER_STARTED',
    `Server started (${describeSettings(settings)})`
  )
  if (!hasStoragePath) {
    logger.warn(
      'SCHEMA_NO_STORAGE_PATH',
      'No storage folder was given to the server, so the schema database is off for this session (no completion or hover data)'
    )
  }
})

// Backs the client's manual "force update" command — bypasses the
// version check that refreshManifest() normally does, since the user is
// explicitly asking to check right now regardless.
connection.onRequest('scsIntellisense/refreshSchema', async () => {
  if (!schemaClient) {
    return {
      ok: false,
      message: 'Schema cache is not initialized for this session',
    }
  }
  try {
    const changed = await schemaClient.refreshManifest(true)
    return { ok: true, changed }
  } catch (err) {
    logger.error(
      'SCHEMA_REFRESH_FAILED',
      'Refresh Schema Database failed',
      describeError(err)
    )
    return { ok: false, message: String(err) }
  }
})

// Backs the "Check Formatting" (write: false) and "Format All Files"
// (write: true) commands. The client finds the files and sends them in
// batches; see formatter/workspaceFormat.ts.
connection.onRequest(
  'scsIntellisense/formatFiles',
  async (params: {
    files: (FileToFormat & { editorOptions?: EditorIndentOptions })[]
    write: boolean
    /** The editor settings for .sii/.sui files that aren't open. Open
     *  files carry their own editorOptions, as VS Code resolved them. */
    editorOptions: EditorIndentOptions
  }): Promise<FileFormatResult[]> =>
    formatFiles(
      params.files.map(({ editorOptions, ...file }) => ({
        ...file,
        indent: indentFromEditor(editorOptions ?? params.editorOptions),
      })),
      params.write,
      {
        braceStyle: settings.formatterBraceStyle,
        indentUnits: settings.formatterIndentUnits,
      }
    )
)

connection.onCompletion(async (params) => {
  try {
    // Asked on every keystroke: off answers before any work, and quietly.
    if (!settings.completionEnabled) return []
    const doc = documents.get(params.textDocument.uri)
    if (!doc) {
      logger.debug(
        'DOC_NOT_FOUND',
        'Completion requested for a document the server does not have open',
        undefined,
        params.textDocument.uri
      )
      return []
    }

    const ext = detectExtFromUri(doc.uri)
    const mode = detectModeFromExt(ext)
    const parsed = readScsDocument(
      doc.getText(),
      mode === 'unknown' ? 'sii' : mode
    )

    // Same reasoning as diagnostic/index.ts: `parsed`'s ranges are
    // relative to the normalized (CRLF -> LF) text, so the client's
    // position has to be resolved against that same normalized text —
    // not against `doc` directly — or the position drifts on any
    // Windows-saved .sii file.
    const normalizedDoc = TextDocument.create(
      doc.uri,
      doc.languageId,
      doc.version,
      parsed.text
    )
    const offset = normalizedDoc.offsetAt(params.position)

    if (!schemaClient) {
      logger.debug(
        'COMPLETION_NO_SCHEMA',
        'Completion requested before the schema database was ready'
      )
      return []
    }

    if (isClassNamePosition(parsed, offset)) {
      return buildClassNameCompletionItems(schemaClient.getManifest()).map(
        (item): CompletionItem => ({
          label: item.label,
          kind: CompletionItemKind.Class,
          detail: item.detail,
          documentation: item.documentation,
        })
      )
    }

    const unit = findAttributeKeyPosition(parsed, offset)
    if (unit) {
      // First real (non-mocked) use of the lazy per-class fetch: this
      // is the only completion path that ever needs a specific class's
      // full attribute list, not just what's already in the manifest.
      const schema = await schemaClient.getSchemaContent(unit.className)
      return buildAttributeKeyCompletionItems(schema).map(
        (item): CompletionItem => ({
          label: item.label,
          kind: CompletionItemKind.Property,
          detail: item.detail,
          documentation: item.documentation,
        })
      )
    }

    return []
  } catch (error) {
    logger.error(
      'COMPLETION_FAILED',
      'Completion failed',
      describeError(error),
      params.textDocument?.uri
    )
    return []
  }
})

// The client sends every setting again whenever any scs-intellisense.*
// setting changes. Most take effect on the next request by themselves;
// the ones whose result is already on screen are redone here.
connection.onNotification('scsIntellisense/updateSettings', (raw: unknown) => {
  const previous = settings
  settings = parseSettings(raw)
  logger.info(
    'SETTINGS_UPDATED',
    `Settings changed (${describeSettings(settings)})`
  )

  schemaClient?.setFetchTimeout(settings.fetchTimeoutMs)

  // Diagnostics already shown are re-sent with the new severities, for
  // every open document, instead of waiting for the next edit to each.
  if (previous.enabledSeverities.join() !== settings.enabledSeverities.join()) {
    for (const doc of documents.all()) {
      connection.sendDiagnostics({
        uri: doc.uri,
        diagnostics: getDiagnostics(doc, settings.enabledSeverities),
      })
    }
  }

  // Asks VS Code to request the colors again, which now come back empty
  // (or full).
  if (previous.semanticHighlighting !== settings.semanticHighlighting) {
    setSemanticHighlighting(settings.semanticHighlighting)
    connection.languages.semanticTokens.refresh()
  }
})

documents.onDidChangeContent((change) => {
  try {
    const diagnostics = getDiagnostics(
      change.document,
      settings.enabledSeverities
    )
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics })
  } catch (error) {
    logger.error(
      'DIAGNOSTICS_FAILED',
      'Checking the file for problems failed',
      describeError(error),
      change.document.uri
    )
  }
})

interface EditorIndentOptions {
  tabSize: number
  insertSpaces: boolean
}

function describeIndent(options: EditorIndentOptions): string {
  return options.insertSpaces ? `${options.tabSize} spaces` : 'tab'
}

connection.onHover(async (params): Promise<Hover | null> => {
  try {
    if (!settings.hoverEnabled) return null
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null

    const ext = detectExtFromUri(doc.uri)
    const mode = detectModeFromExt(ext)
    const parsed = readScsDocument(
      doc.getText(),
      mode === 'unknown' ? 'sii' : mode
    )

    // Same CRLF-safety reasoning as onCompletion and getDiagnostics:
    // `parsed`'s ranges are relative to the normalized text, so the
    // position has to be resolved against that same text.
    const normalizedDoc = TextDocument.create(
      doc.uri,
      doc.languageId,
      doc.version,
      parsed.text
    )
    const offset = normalizedDoc.offsetAt(params.position)

    const className = findClassNameAtPosition(parsed, offset)
    if (className) {
      // class_name hover only ever needs the manifest, already in
      // memory — no fetch, same data completion already uses for
      // class_name.
      const hover = buildClassNameHover(className, schemaClient?.getManifest())
      return hover ? toHoverResult(hover.markdown) : null
    }

    const attribute = findAttributeKeyAtPosition(parsed, offset)
    if (attribute) {
      if (!schemaClient) return null
      // Same lazy per-class fetch completion's attribute_key path
      // already uses — cached after the first hover/completion for
      // this class, whichever happens first.
      const schema = await schemaClient.getSchemaContent(attribute.className)
      const hover = buildAttributeKeyHover(attribute.key, schema)
      return hover ? toHoverResult(hover.markdown) : null
    }

    return null
  } catch (error) {
    logger.error(
      'HOVER_FAILED',
      'Hover failed',
      describeError(error),
      params.textDocument?.uri
    )
    return null
  }
})

connection.onCodeAction((params): CodeAction[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []
    return buildCodeActions(doc, params, settings.enabledSeverities)
  } catch (error) {
    logger.error(
      'QUICKFIX_FAILED',
      'Finding quick fixes failed',
      describeError(error),
      params.textDocument.uri
    )
    return []
  }
})

connection.onDocumentSymbol((params): DocumentSymbol[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []

    const ext = detectExtFromUri(doc.uri)
    const mode = detectModeFromExt(ext)
    const parsed = readScsDocument(
      doc.getText(),
      mode === 'unknown' ? 'sii' : mode
    )

    // Same CRLF-safety reasoning as every other handler here.
    const normalizedDoc = TextDocument.create(
      doc.uri,
      doc.languageId,
      doc.version,
      parsed.text
    )

    return buildDocumentSymbols(parsed, normalizedDoc)
  } catch (error) {
    logger.error(
      'SYMBOLS_FAILED',
      'Building the Outline (document symbols) failed',
      describeError(error),
      params.textDocument?.uri
    )
    return []
  }
})

connection.onDocumentFormatting((params): TextEdit[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc || !isFormatterOn(params.textDocument.uri)) return []

    const mode = detectModeFromExt(detectExtFromUri(doc.uri))

    // checkFormatting() is the same path the workspace commands use, so
    // Format Document and format on save get its safety check too: the
    // result is applied only if nothing but whitespace changed. It also
    // skips files with structural issues (missing ':', missing '}',
    // etc.): the tree is incomplete there, most often because the user
    // is mid-typing, and rebuilding the file from it isn't safe.
    // Business-rule issues (invalid className, duplicates...) don't
    // affect the ranges the formatter uses, so they don't block it.
    const result = checkFormatting(
      doc.getText(),
      mode === 'sui' ? 'sui' : 'sii',
      formatterOptions(params.options)
    )
    logFormatOutcome(result, params.options, params.textDocument.uri)
    if (result.status !== 'changed') return []

    // The formatter reconstructs the whole file from the tree, so the
    // simplest and safest edit is "replace everything" — no need to
    // diff against the original to compute a minimal set of edits.
    const fullRange = {
      start: { line: 0, character: 0 },
      end: doc.positionAt(doc.getText().length),
    }
    return [{ range: fullRange, newText: result.formatted }]
  } catch (error) {
    logger.error(
      'FORMAT_FAILED',
      'Format Document failed',
      describeError(error),
      params.textDocument?.uri
    )
    return []
  }
})

// Format Selection: the units the selection touches, with the same
// structural-issue rule and safety check as Format Document.
connection.onDocumentRangeFormatting((params): TextEdit[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc || !isFormatterOn(params.textDocument.uri)) return []

    const mode = detectModeFromExt(detectExtFromUri(doc.uri))
    // Offsets go through the normalized text (no BOM, LF only), like
    // every other handler; line and column are the same in both.
    const normalizedDoc = TextDocument.create(
      doc.uri,
      doc.languageId,
      doc.version,
      normalizeSiiText(doc.getText())
    )
    const result = formatRange(
      doc.getText(),
      mode === 'sui' ? 'sui' : 'sii',
      {
        start: normalizedDoc.offsetAt(params.range.start),
        end: normalizedDoc.offsetAt(params.range.end),
      },
      formatterOptions(params.options)
    )
    logFormatOutcome(result, params.options, params.textDocument.uri)
    if (result.status !== 'changed') return []

    const eol = doc.getText().includes('\r\n') ? '\r\n' : '\n'
    return [
      {
        range: {
          start: normalizedDoc.positionAt(result.edit.range.start),
          end: normalizedDoc.positionAt(result.edit.range.end),
        },
        newText: result.edit.newText.replace(/\n/g, eol),
      },
    ]
  } catch (error) {
    logger.error(
      'FORMAT_FAILED',
      'Format Selection failed',
      describeError(error),
      params.textDocument?.uri
    )
    return []
  }
})

/** The formatter is always declared (see onInitialize), so every request
 *  checks the setting first. */
function isFormatterOn(uri: string): boolean {
  if (settings.formatterEnabled) return true
  logger.debug(
    'FORMAT_DISABLED',
    'Not formatted: the formatter is off (scs-intellisense.formatter.enabled)',
    undefined,
    uri
  )
  return false
}

function formatterOptions(editorOptions: {
  tabSize: number
  insertSpaces: boolean
}): FormatterOptions {
  return {
    braceStyle: settings.formatterBraceStyle,
    indentUnits: settings.formatterIndentUnits,
    // What VS Code sends with the request: editor.tabSize and
    // editor.insertSpaces as they apply to this file (detected from its
    // content when editor.detectIndentation is on). Using them keeps
    // formatting and the editor's own indent on Enter in step.
    indent: indentFromEditor(editorOptions),
  }
}

/**
 * Every outcome is logged, at debug for the routine ones, so a bug report
 * can tell whether the formatter ran on a file and what it did.
 */
function logFormatOutcome(
  result: FormatCheckResult | FormatRangeResult,
  editorOptions: { tabSize: number; insertSpaces: boolean },
  uri: string
): void {
  if (result.status === 'unchanged') {
    logger.debug(
      'FORMAT_UNCHANGED',
      'Already formatted, nothing to change',
      undefined,
      uri
    )
    return
  }
  if (result.status === 'skipped') {
    // A structural issue is normal while typing (format on save hits it
    // all the time), so it's debug. A content mismatch is a formatter
    // bug: a warning, so it shows up in bug reports.
    if (result.reason === 'structural') {
      logger.debug(
        'FORMAT_SKIPPED',
        `Not formatted: structural issue at line ${result.line} (${result.message})`,
        undefined,
        uri
      )
    } else {
      logger.warn(
        'FORMAT_UNSAFE_RESULT',
        'Not formatted: the result would change content, not just whitespace. This is a formatter bug, please report it',
        undefined,
        uri
      )
    }
    return
  }
  logger.debug(
    'FORMAT_APPLIED',
    `Formatted ${'edit' in result ? 'the selection' : 'the file'} (${settings.formatterBraceStyle} braces, indent ${describeIndent(editorOptions)}, units ${settings.formatterIndentUnits ? 'indented' : 'at column 0'})`,
    undefined,
    uri
  )
}

function toHoverResult(markdown: string): Hover {
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: markdown,
    },
  }
}

process.on('uncaughtException', (err) => {
  logger.error(
    'SERVER_UNCAUGHT_EXCEPTION',
    'Uncaught exception in the server',
    describeError(err)
  )
})

process.on('unhandledRejection', (reason) => {
  logger.error(
    'SERVER_UNHANDLED_REJECTION',
    'Unhandled promise rejection in the server',
    describeError(reason)
  )
})

documents.listen(connection)
connection.listen()
