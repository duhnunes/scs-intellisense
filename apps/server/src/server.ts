import {
  createConnection, TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind, type InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideCompletionItems } from './completion';
import { registerSemantic, semanticTokensLegend } from './semantic';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

registerSemantic(connection, documents)

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: []
      }
    }
  };
  result.capabilities.semanticTokensProvider = {
    legend: semanticTokensLegend,
    full: true,
    range: false
  }
  return result;
});

// documents.onDidChangeContent(change => {
//   connection.console.log(`File changed: ${change.document.uri}`);
// });

connection.onCompletion((params) => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) {
      connection.console.log('[sii] onCpletion: document not found for ' + params.textDocument.uri)
      return []
    }

    connection.console.log(`[sii] onCompletion: uri=${params.textDocument.uri} langueId=${doc.languageId}`)
    const offset = doc.offsetAt(params.position)
    connection.console.log(`[sii] onCompletion: position=${JSON.stringify(params.position)} offset=${offset}`)

    const items = provideCompletionItems(doc.getText(), offset)
    connection.console.log(`[sii] onCompletion: returned ${items?.length ?? 0} items`)
    return items
  } catch (error) {
    connection.console.error('[sii] onCompletion error: ' + (error && (error as Error).message))
    return []
  }
})

documents.listen(connection);
connection.listen();
