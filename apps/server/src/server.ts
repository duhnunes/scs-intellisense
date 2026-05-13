import {
  createConnection,
  SemanticTokensBuilder,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind, type InitializeResult,
  type SemanticTokensLegend,
  type SemanticTokens
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseSii, provideCompletionItems } from './completion';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// # TOKEN TYPES
const tokenTypes = ['keyword', 'class', 'property', 'type', 'string', 'number', 'keyword', 'comment', 'variable'];
const tokenModifiers: string[] = [];

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes,
  tokenModifiers
};

// helper: calculates line starts
function computeLineStarts(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

// helper: offset -> {line, char} (uses binary search if file is large)
function offsetToPosition(lineStarts: number[], offset: number) {
  let low = 0, high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= offset) low = mid + 1;
    else high = mid - 1;
  }
  const line = Math.max(0, low - 1);
  const char = offset - lineStarts[line];
  return { line, char };
}

// helper: push token(s) whithout crossing lines
function pushTokenByRange(builder: SemanticTokensBuilder, lineStarts: number[], startOffset: number, endOffset: number, tokenTypeIndex: number) {
  if (startOffset >= endOffset) return;
  let cur = startOffset;
  while (cur < endOffset) {
    const startPos = offsetToPosition(lineStarts, cur);
    const lineEndOffset = (startPos.line + 1 < lineStarts.length) ? lineStarts[startPos.line + 1] : Number.MAX_SAFE_INTEGER;
    const chunkEnd = Math.min(endOffset, lineEndOffset);
    const length = chunkEnd - cur;
    builder.push(startPos.line, startPos.char, length, tokenTypeIndex, 0);
    cur = chunkEnd;
  }
}

export function provideSemanticTokensForDocument(documentText: string): SemanticTokens {
  const builder = new SemanticTokensBuilder();
  const lineStarts = computeLineStarts(documentText);

  // SiiNunit
  const magicIndex = documentText.indexOf('SiiNunit');
  if (magicIndex !== -1) {
    const p = offsetToPosition(lineStarts, magicIndex);
    builder.push(p.line, p.char, 'SiiNunit'.length, tokenTypes.indexOf('keyword'), 0);
  }

  // ParseSii
  const parsed = parseSii(documentText);

  for (const cls of parsed.classes) {
    const classIndex = documentText.indexOf(cls.className);
    if (classIndex !== -1) {
      const p = offsetToPosition(lineStarts, classIndex);
      builder.push(p.line, p.char, cls.className.length, tokenTypes.indexOf('class'), 0);
    }

    for (const attr of cls.attributes) {
      pushTokenByRange(builder, lineStarts, attr.keyRange.start, attr.keyRange.end, tokenTypes.indexOf('property'));

      const t = Array.isArray(attr.type) ? attr.type[0] : attr.type;
      let tokenTypeForValue = 'string';
      if (t === 'string' || t === 'resource_tie') tokenTypeForValue = 'string';
      else if (t.startsWith('float') || t.startsWith('fixed') || t === 'int2' || t.startsWith('s') || t.startsWith('u') || t === 'quaternion') tokenTypeForValue = 'number';
      else if (t === 'bool') tokenTypeForValue = 'keyword';
      else if (t === 'token' || t === 'owner_ptr' || t === 'link_ptr') tokenTypeForValue = 'variable';
      else tokenTypeForValue = 'string';

      pushTokenByRange(builder, lineStarts, attr.valueRange.start, attr.valueRange.end, tokenTypes.indexOf(tokenTypeForValue));
    }
  }

  // Comments
  const text = documentText;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      const start = i;
      i += 2;
      while (i < text.length && text[i] !== '\n') i++;
      pushTokenByRange(builder, lineStarts, start, i, tokenTypes.indexOf('comment'));
      continue;
    }
    if (ch === '#') {
      const start = i;
      i++;
      while (i < text.length && text[i] !== '\n') i++;
      pushTokenByRange(builder, lineStarts, start, i, tokenTypes.indexOf('comment'));
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      pushTokenByRange(builder, lineStarts, start, Math.min(i, text.length), tokenTypes.indexOf('comment'));
      continue;
    }
    i++;
  }

  return builder.build() as SemanticTokens;
}

// handler: retorna SemanticTokens diretamente
connection.languages.semanticTokens.on((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return { data: [] } as SemanticTokens;
  return provideSemanticTokensForDocument(doc.getText());
});

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
