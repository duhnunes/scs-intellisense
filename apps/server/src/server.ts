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
import { registerSemantic, semanticTokensLegend } from './semantic'
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
import type { SiiSeverity } from './interfaces/structure'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

initLogger(connection)
const logger = getLogger()

registerSemantic(connection, documents)

// The single schema fetch/cache instance for this server process.
// Completion, hover, and future attribute validation all consult this —
// none of them should ever call fetch() or touch the disk cache directly.
let schemaClient: SchemaClient | undefined

// Which diagnostic severities to actually report — controlled by the
// client's scs-intellisense.diagnostics.enabledSeverities setting.
// Starts with everything enabled; onInitialize overwrites this with the
// client's real starting value before any document is ever validated.
let enabledSeverities: SiiSeverity[] = [
  'error',
  'warning',
  'information',
  'hint',
]

// Static for the whole session — formatter.braceStyle isn't
// live-updatable (same reload-required pattern as schema.fetchTimeoutMs).
let formatterBraceStyle: FormatterOptions['braceStyle'] = '1tbs'
let formatterIndentUnits = true
let formatterEnabled = false

// Built in onInitialize, logged in onInitialized (see there why).
let startedMessage = 'Server started'
let hasStoragePath = false

/** For other server modules (completion, hover, ...) to consult the
 *  schema once it's ready. Returns undefined until onInitialize has run
 *  and the client sent a usable storage path. */
export function getSchemaClient(): SchemaClient | undefined {
  return schemaClient
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const initOptions = params.initializationOptions as
    | {
        globalStoragePath?: string
        enabledSeverities?: SiiSeverity[]
        fetchTimeoutMs?: number
        completionEnabled?: boolean
        hoverEnabled?: boolean
        formatterEnabled?: boolean
        formatterBraceStyle?: FormatterOptions['braceStyle']
        formatterIndentUnits?: boolean
      }
    | undefined

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

  // EXPERIMENTAL, off by default — the client only sends `true` here if
  // the user explicitly opted in via the matching
  // scs-intellisense.*.enabled setting. Not declaring a capability at
  // all (rather than declaring it and having the handler just return
  // [] / null) means VSCode never even sends that kind of request for
  // this language while the feature is off, instead of a wasted
  // round-trip.
  if (initOptions?.completionEnabled) {
    result.capabilities.completionProvider = {
      resolveProvider: false,
      triggerCharacters: [],
    }
  }

  if (initOptions?.hoverEnabled) {
    result.capabilities.hoverProvider = true
  }

  // The one exception to "declared only when enabled": the extension is
  // the default formatter for .sii/.sui (configurationDefaults in the
  // client's package.json, which beats a global editor.defaultFormatter
  // such as Prettier). If it then declared no formatter, VS Code would
  // flag it as a formatter that "cannot format SII-files" on every .sii,
  // formatter off being the default. So the formatter is always declared
  // and does nothing while it's off.
  formatterEnabled = initOptions?.formatterEnabled ?? false
  result.capabilities.documentFormattingProvider = true
  result.capabilities.documentRangeFormattingProvider = true

  result.capabilities.semanticTokensProvider = {
    legend: semanticTokensLegend,
    full: true,
    range: false,
  }

  if (initOptions?.enabledSeverities) {
    enabledSeverities = initOptions.enabledSeverities
  }

  if (initOptions?.formatterBraceStyle) {
    formatterBraceStyle = initOptions.formatterBraceStyle
  }
  formatterIndentUnits = initOptions?.formatterIndentUnits ?? true

  const globalStoragePath = initOptions?.globalStoragePath

  if (globalStoragePath) {
    schemaClient = new SchemaClient({
      cacheDir: globalStoragePath,
      logger,
      fetchTimeoutMs: initOptions?.fetchTimeoutMs,
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

  startedMessage = `Server started (completion: ${onOff(initOptions?.completionEnabled)}, hover: ${onOff(initOptions?.hoverEnabled)}, formatter: ${onOff(initOptions?.formatterEnabled)})`

  return result
})

// Logged here, not in onInitialize: the client only starts listening for
// notifications after it gets the initialize response, so an entry sent
// before that is dropped (and LSP doesn't allow it anyway).
connection.onInitialized(() => {
  logger.info('SERVER_STARTED', startedMessage)
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
      { braceStyle: formatterBraceStyle, indentUnits: formatterIndentUnits }
    )
)

connection.onCompletion(async (params) => {
  try {
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

// Live update from the client whenever
// scs-intellisense.diagnostics.enabledSeverities changes — re-runs
// diagnostics for every currently-open document immediately, rather
// than waiting for the next edit to each one.
connection.onNotification(
  'scsIntellisense/updateDiagnosticSettings',
  (payload: { enabledSeverities?: SiiSeverity[] }) => {
    if (!payload?.enabledSeverities) return
    enabledSeverities = payload.enabledSeverities

    for (const doc of documents.all()) {
      connection.sendDiagnostics({
        uri: doc.uri,
        diagnostics: getDiagnostics(doc, enabledSeverities),
      })
    }
  }
)

documents.onDidChangeContent((change) => {
  try {
    const diagnostics = getDiagnostics(change.document, enabledSeverities)
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

function onOff(enabled: boolean | undefined): string {
  return enabled ? 'on' : 'off'
}

connection.onHover(async (params): Promise<Hover | null> => {
  try {
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
    return buildCodeActions(doc, params, enabledSeverities)
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
  if (formatterEnabled) return true
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
    braceStyle: formatterBraceStyle,
    indentUnits: formatterIndentUnits,
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
    `Formatted ${'edit' in result ? 'the selection' : 'the file'} (${formatterBraceStyle} braces, indent ${describeIndent(editorOptions)}, units ${formatterIndentUnits ? 'indented' : 'at column 0'})`,
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
