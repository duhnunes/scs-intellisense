import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  CompletionItemKind,
  type InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideCompletionItems } from './completion';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

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
  connection.console.log(`Params: ${params}`);
  return result;
});

// documents.onDidChangeContent(change => {
//   connection.console.log(`File changed: ${change.document.uri}`);
// });

connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return []
  
  const items = provideCompletionItems(doc.getText(), doc.offsetAt(params.position))
  return items
})

documents.listen(connection);
connection.listen();
