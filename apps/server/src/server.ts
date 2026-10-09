import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  CompletionItemKind,
  MarkupKind,
  type CompletionItem,
  type DocumentSymbol,
  type Hover,
  type InitializeResult,
  type TextEdit,
} from 'vscode-languageserver/node'

import { TextDocument } from 'vscode-languageserver-textdocument'
import { registerSemantic, semanticTokensLegend } from './semantic'
import { getLogger, initLogger } from './logger'
import { getDiagnostics } from './diagnostic'
import { SchemaClient, type SchemaClientLogger } from './schema/client'
import { readScsDocument } from './sii'
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
import { formatSiiDocument, type FormatterOptions } from './formatter/format'
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

/** For other server modules (completion, hover, ...) to consult the
 *  schema once it's ready. Returns undefined until onInitialize has run
 *  and the client sent a usable storage path. */
export function getSchemaClient(): SchemaClient | undefined {
  return schemaClient
}

const schemaLogger: SchemaClientLogger = {
  info: (message) => logger.info('SCHEMA', message),
  warn: (message) => logger.warn('SCHEMA', message),
  error: (message, details) => logger.error('SCHEMA', message, details),
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
      }
    | undefined

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Not experimental, not schema-dependent — always on. Powers the
      // Outline view, breadcrumbs, and "Go to Symbol in Editor".
      documentSymbolProvider: true,
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

  if (initOptions?.formatterEnabled) {
    result.capabilities.documentFormattingProvider = true
  }

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

  const globalStoragePath = initOptions?.globalStoragePath

  if (globalStoragePath) {
    schemaClient = new SchemaClient({
      cacheDir: globalStoragePath,
      logger: schemaLogger,
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
        schemaLogger.error('Schema client startup failed', String(err))
      })
  } else {
    logger.warn(
      'SCHEMA_NO_STORAGE_PATH',
      'No globalStoragePath in initializationOptions; schema fetch/cache disabled for this session'
    )
  }

  logger.info('SERVER_INIT', 'SCS Intellisense server intialized!')

  return result
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
    schemaLogger.error('Manual schema refresh failed', String(err))
    return { ok: false, message: String(err) }
  }
})

connection.onCompletion(async (params) => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) {
      logger.warn(
        'DOC_NOT_FOUND',
        'Document not found for completion',
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
      logger.warn(
        'COMPLETION_NO_SCHEMA_CLIENT',
        'Completion requested before schema client was ready'
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
    const details =
      error && (error as Error).stack ? (error as Error).stack : String(error)
    logger.error(
      'ON_COMPLETION_ERROR',
      'onCompletion error',
      details,
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
  const diagnostics = getDiagnostics(change.document, enabledSeverities)
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics })
})

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
    const details =
      error && (error as Error).stack ? (error as Error).stack : String(error)
    logger.error(
      'ON_HOVER_ERROR',
      'onHover error',
      details,
      params.textDocument?.uri
    )
    return null
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
    const details =
      error && (error as Error).stack ? (error as Error).stack : String(error)
    logger.error(
      'ON_DOCUMENT_SYMBOL_ERROR',
      'onDocumentSymbol error',
      details,
      params.textDocument?.uri
    )
    return []
  }
})

connection.onDocumentFormatting((params): TextEdit[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []

    const ext = detectExtFromUri(doc.uri)
    const mode = detectModeFromExt(ext)
    const parsed = readScsDocument(
      doc.getText(),
      mode === 'unknown' ? 'sii' : mode
    )

    // Structural issues (missing ':', missing '}', etc.) mean the tree
    // is genuinely incomplete somewhere — most commonly because the
    // user is mid-typing. Rewriting the whole file in that state is
    // exactly the wrong moment to do it, so formatting is skipped
    // entirely (no edits) rather than risking it on a tree that isn't
    // fully trustworthy yet. Business-rule issues (invalid className,
    // duplicate unit names, etc.) don't affect the structural ranges
    // the formatter relies on, so those alone don't block formatting.
    if (parsed.issues.length > 0) {
      logger.info(
        'FORMAT_SKIPPED_STRUCTURAL_ISSUES',
        `Skipped formatting ${params.textDocument.uri}: ${parsed.issues.length} structural issue(s) present`
      )
      return []
    }

    const formatted = formatSiiDocument(parsed, {
      braceStyle: formatterBraceStyle,
    })

    // The formatter reconstructs the whole file from the tree, so the
    // simplest and safest edit is "replace everything" — no need to
    // diff against the original to compute a minimal set of edits.
    const fullRange = {
      start: { line: 0, character: 0 },
      end: doc.positionAt(doc.getText().length),
    }

    return [{ range: fullRange, newText: formatted }]
  } catch (error) {
    const details =
      error && (error as Error).stack ? (error as Error).stack : String(error)
    logger.error(
      'ON_DOCUMENT_FORMATTING_ERROR',
      'onDocumentFormatting error',
      details,
      params.textDocument?.uri
    )
    return []
  }
})

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
    'UNCAUGHT_EXCEPTION',
    'Uncaught exception in server process',
    (err && (err as Error).stack) || String(err)
  )
})

process.on('unhandledRejection', (reason) => {
  logger.error(
    'UNHANDLED_REJECTION',
    'Unhandled promise rejection',
    String(reason)
  )
})

documents.listen(connection)
connection.listen()
