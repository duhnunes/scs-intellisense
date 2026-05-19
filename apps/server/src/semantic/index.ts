import { SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend, type Connection, type TextDocuments } from "vscode-languageserver";
import { parseSii } from "../completion";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { getLogger } from "../logger";

// # TOKEN TYPES
export const tokenTypes = ['keyword', 'class', 'property', 'parameter', 'type', 'string', 'number', 'comment', 'variable'];
const tokenModifiers: string[] = [];

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes,
  tokenModifiers
}

const logger = getLogger()

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
function pushTokenByRange(builder: SemanticTokensBuilder, lineStarts: number[], startOffset: number, endOffset: number, tokenTypeIndex: number, textLength: number) {
  if (typeof startOffset !== 'number' || typeof endOffset !== 'number') return;
  if (tokenTypeIndex == null || tokenTypeIndex < 0) return;
  if (startOffset >= endOffset) return;
  if (startOffset < 0) startOffset = 0;
  if (endOffset > textLength) endOffset = textLength;
  let cur = startOffset;
  while (cur < endOffset) {
    const startPos = offsetToPosition(lineStarts, cur);
    const lineEndOffset = (startPos.line + 1 < lineStarts.length) ? lineStarts[startPos.line + 1] : Number.MAX_SAFE_INTEGER;
    const chunkEnd = Math.min(endOffset, lineEndOffset);
    const length = chunkEnd - cur;
    if (length > 0) builder.push(startPos.line, startPos.char, length, tokenTypeIndex, 0);
    cur = chunkEnd;
  }
}

// helper: find all occurrences from substring between startOffset and endOffset
function findAllOccurrences(text: string, substr: string, startOffset = 0, endOffset = text.length) {
  const results: number[] = []
  if (!substr) return results
  let idx = text.indexOf(substr, startOffset)
  while (idx !== -1 && idx < endOffset) {
    results.push(idx)
    idx = text.indexOf(substr, idx + substr.length)
  }
  return results
}

export function provideSemanticTokensForDocument(documentText: string): SemanticTokens {
  try {
    const builder = new SemanticTokensBuilder();
    const lineStarts = computeLineStarts(documentText);
    const textLength = documentText.length;

    // SiiNunit
    const magicIndex = documentText.indexOf('SiiNunit');
    if (magicIndex !== -1) {
      const p = offsetToPosition(lineStarts, magicIndex);
      const idx = tokenTypes.indexOf('keyword');
      if (idx >= 0) builder.push(p.line, p.char, 'SiiNunit'.length, idx, 0);
    }

    // ParseSii
    const parsed = parseSii(documentText);

    for (const cls of parsed.classes) {
      // Class_name: determine search window (prefer parser-provided offsets)
      let searchStart = 0;
      let searchEnd = documentText.length;
      if ((cls as any).classNameStart !== undefined && (cls as any).classNameEnd !== undefined) {
        searchStart = (cls as any).classNameStart;
        searchEnd = (cls as any).classNameEnd + 1;
      } else if ((cls as any).range && typeof (cls as any).range.start === 'number' && typeof (cls as any).range.end === 'number') {
        searchStart = (cls as any).range.start;
        searchEnd = (cls as any).range.end;
      } else if ((cls as any).bodyStart !== undefined && (cls as any).bodyEnd !== undefined) {
        searchStart = (cls as any).bodyStart - 50;
        if (searchStart < 0) searchStart = 0;
        searchEnd = (cls as any).bodyEnd + 50;
        if (searchEnd > documentText.length) searchEnd = documentText.length;
      }

      const occurrences = findAllOccurrences(documentText, cls.className, searchStart, searchEnd);
      const classTokenIdx = tokenTypes.indexOf('class');
      if (classTokenIdx >= 0 && occurrences.length > 0) {
        for (const occ of occurrences) {
          if (occ >= 0 && occ + cls.className.length <= textLength) {
            const p = offsetToPosition(lineStarts, occ);
            builder.push(p.line, p.char, cls.className.length, classTokenIdx, 0);
          }
        }
      }

      // Keys & Values
      for (const attr of cls.attributes) {
        if (attr && attr.keyRange && typeof attr.keyRange.start === 'number' && typeof attr.keyRange.end === 'number') {
          pushTokenByRange(builder, lineStarts, attr.keyRange.start, attr.keyRange.end, tokenTypes.indexOf('parameter'), textLength);
        }

        // Value Types
        const t = Array.isArray(attr.type) ? attr.type[0] : attr.type;
        let tokenTypeForValue = 'string';
        if (t === 'string' || t === 'resource_tie') tokenTypeForValue = 'string';
        else if (typeof t === 'string' && (t.startsWith('float') || t.startsWith('fixed') || t === 'int2' || t.startsWith('s') || t.startsWith('u') || t === 'quaternion')) tokenTypeForValue = 'number';
        else if (t === 'bool') tokenTypeForValue = 'keyword';
        else if (t === 'token' || t === 'owner_ptr' || t === 'link_ptr') tokenTypeForValue = 'variable';
        else tokenTypeForValue = 'string';

        if (attr && attr.valueRange && typeof attr.valueRange.start === 'number' && typeof attr.valueRange.end === 'number') {
          pushTokenByRange(builder, lineStarts, attr.valueRange.start, attr.valueRange.end, tokenTypes.indexOf(tokenTypeForValue), textLength);
        }
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
        pushTokenByRange(builder, lineStarts, start, i, tokenTypes.indexOf('comment'), textLength);
        continue;
      }
      if (ch === '#') {
        const start = i;
        i++;
        while (i < text.length && text[i] !== '\n') i++;
        pushTokenByRange(builder, lineStarts, start, i, tokenTypes.indexOf('comment'), textLength);
        continue;
      }
      if (ch === '/' && text[i + 1] === '*') {
        const start = i;
        i += 2;
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
        i += 2;
        pushTokenByRange(builder, lineStarts, start, Math.min(i, text.length), tokenTypes.indexOf('comment'), textLength);
        continue;
      }
      i++;
    }

    return builder.build() as SemanticTokens;
  } catch (err) {
    const details = (err && (err as Error).stack) ? (err as Error).stack : String(err)
    logger.error('SEMANTIC_ERROR', 'Failed to build semantic tokens', details)
    return { data: [] } as SemanticTokens;
  }
}

export function registerSemantic (connection: Connection, documents: TextDocuments<TextDocument>) {
  (globalThis as any).connection = connection

  connection.languages.semanticTokens.on((params) => {
    try {
      const doc = documents.get(params.textDocument.uri)
      if (!doc) {
        logger.warn('DOC_NOT_FOUND', 'Document not found for semantic tokens request', undefined, params.textDocument.uri)
        return { data: [] } as SemanticTokens
      }

      return provideSemanticTokensForDocument(doc.getText())
    } catch (err) {
      const details = (err && (err as Error).stack) ? (err as Error).stack : String(err)
      logger.error('SEMANTIC_HANDLER_ERROR', 'Semantic handler failed', details, params.textDocument.uri)
      return { data: [] } as SemanticTokens
    }
  })
}
