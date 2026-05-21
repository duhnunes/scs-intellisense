import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  type InitializeResult,
} from 'vscode-languageserver/node'

import { TextDocument } from 'vscode-languageserver-textdocument'
import { provideCompletionItems } from './completion'
import { registerSemantic, semanticTokensLegend } from './semantic'
import { getLogger, initLogger } from './logger'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

initLogger(connection)
const logger = getLogger()

registerSemantic(connection, documents)

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

  logger.info('SERVER_INIT', 'SCS Intellisense server intialized!')

  return result
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

    const offset = doc.offsetAt(params.position)
    const items = provideCompletionItems(doc.getText(), offset)

    return items
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
