import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  type InitializeResult,
} from 'vscode-languageserver/node'

import { TextDocument } from 'vscode-languageserver-textdocument'
import { registerSemantic, semanticTokensLegend } from './semantic'
import { getLogger, initLogger } from './logger'
import { validateDocument } from './validation'
import { SchemaClient, type SchemaClientLogger } from './schema/client'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

initLogger(connection)
const logger = getLogger()

registerSemantic(connection, documents)

// The single schema fetch/cache instance for this server process.
// Completion, hover, and future attribute validation all consult this —
// none of them should ever call fetch() or touch the disk cache directly.
let schemaClient: SchemaClient | undefined

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
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [],
      },
    },
  }
  result.capabilities.semanticTokensProvider = {
    legend: semanticTokensLegend,
    full: true,
    range: false,
  }

  const globalStoragePath = (
    params.initializationOptions as { globalStoragePath?: string } | undefined
  )?.globalStoragePath

  if (globalStoragePath) {
    schemaClient = new SchemaClient({
      cacheDir: globalStoragePath,
      logger: schemaLogger,
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

connection.onCompletion((params) => {
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

    // const offset = doc.offsetAt(params.position)
    // const items = provideCompletionItems(doc.getText(), offset)

    // return items
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

documents.onDidChangeContent((change) => {
  const diagnostics = validateDocument(change.document)
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics })
})

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
