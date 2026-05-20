import { SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend, type Connection, type TextDocuments } from "vscode-languageserver";
import { parseSii } from "../completion";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { getLogger } from "../logger";
import { computeLineStarts, findAllOccurrences, pushTokenByRange, rangeIntersectsComments } from "./helpers";

// # TOKEN TYPES
export const tokenTypes = ['keyword', 'class', 'property', 'parameter', 'type', 'string', 'number', 'comment', 'variable'];
const tokenModifiers: string[] = [];

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes,
  tokenModifiers
}

const logger = getLogger()

export function provideSemanticTokensForDocument(documentText: string): SemanticTokens {
  try {
    const builder = new SemanticTokensBuilder()
    const lineStarts = computeLineStarts(documentText)
    const textLength = documentText.length

    // Comments
    const commentRanges: { start: number, end: number }[] = []
    {
      const text = documentText
      let i = 0
      while (i < text.length) {
        const ch = text[i]
        if (ch === '/' && text[i + 1] === '/') {
          const start = i
          i += 2
          while (i < text.length && text[i] !== '\n') i++
          const end = i
          commentRanges.push({ start, end })
          continue
        }
        if (ch === '#') {
          const start = i
          i++
          while (i < text.length && text[i] !== '\n') i++
          const end = i
          commentRanges.push({ start, end })
          continue
        }
        if (ch === '/' && text[i + 1] === '*') {
          const start = i
          i += 2
          while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
          if (i < text.length) {
            i += 2
          } else {
            i = text.length
          }
          const end = Math.min(i, text.length)
          commentRanges.push({ start, end })
          continue
        }
        i++
      }
      commentRanges.sort((a, b) => a.start - b.start)
    }

    // Queue Tokens
    type TokenEntry = { start: number, end: number, tokenTypeIndex: number }
    const tokensToEmit: TokenEntry[] = []

    function queueToken(start: number, end: number, tokenTypeIndex: number) {
      if (typeof start !== 'number' || typeof end !== 'number') return
      if (tokenTypeIndex == null || tokenTypeIndex < 0) return
      if (start >= end) return
      if (start < 0) start = 0
      if (end > textLength) end = textLength
      tokensToEmit.push({ start, end, tokenTypeIndex })
    }

    // SiiNunit
    const magicIndex = documentText.indexOf('SiiNunit')
    if (magicIndex !== -1) {
      const start = magicIndex
      const end = magicIndex + 'SiiNunit'.length
      if (!rangeIntersectsComments(commentRanges, start, end)) {
        const idx = tokenTypes.indexOf('keyword')
        if (idx >= 0) queueToken(start, end, idx)
      }
    }

    // ParseSii
    const parsed = parseSii(documentText)
    for (const cls of parsed.classes) {
      // Class_name: determine search window
      let searchStart = 0
      let searchEnd = documentText.length
      if ((cls as any).classNameStart !== undefined && (cls as any).classNameEnd !== undefined) {
        searchStart = (cls as any).classNameStart
        searchEnd = (cls as any).classNameEnd + 1
      } else if ((cls as any).range && typeof (cls as any).range.start === 'number' && typeof (cls as any).range.end === 'number') {
        searchStart = (cls as any).range.start
        searchEnd = (cls as any).range.end
      } else if ((cls as any).bodyStart !== undefined && (cls as any).bodyEnd !== undefined) {
        searchStart = (cls as any).bodyStart - 50
        if (searchStart < 0) searchStart = 0
        searchEnd = (cls as any).bodyEnd + 50
        if (searchEnd > documentText.length) searchEnd = documentText.length
      }

      const occurrences = findAllOccurrences(documentText, cls.className, searchStart, searchEnd)
      const classTokenIdx = tokenTypes.indexOf('class')
      if (classTokenIdx >= 0 && occurrences.length > 0) {
        for (const occ of occurrences) {
          if (occ >= 0 && occ + cls.className.length <= textLength) {
            const start = occ
            const end = occ + cls.className.length
            if (!rangeIntersectsComments(commentRanges, start, end)) {
              queueToken(start, end, classTokenIdx)
            }
          }
        }
      }

      // Key & Value
      for (const attr of cls.attributes) {
        if (attr && attr.keyRange && typeof attr.keyRange.start === 'number' && typeof attr.keyRange.end === 'number') {
          const keyStart = attr.keyRange.start
          const keyEnd = attr.keyRange.end

          // @include or key
          if (attr.key === '@include') {
            const kwIdx = tokenTypes.indexOf('keyword')
            if (kwIdx >= 0 && !rangeIntersectsComments(commentRanges, keyStart, keyEnd))
              queueToken(keyStart, keyEnd, kwIdx)
          } else {
            const paramIdx = tokenTypes.indexOf('parameter')
            if (paramIdx >= 0 && !rangeIntersectsComments(commentRanges, keyStart, keyEnd))
              queueToken(keyStart, keyEnd, paramIdx)
          }
        }

        // Value Types
        const t = Array.isArray(attr.type) ? attr.type[0] : attr.type
        let tokenTypeForValue = 'string'
        if (t === 'string' || t === 'resource_tie') tokenTypeForValue = 'string';
        else if (typeof t === 'string' && (t.startsWith('float') || t.startsWith('fixed') || t === 'int2' || t.startsWith('s') || t.startsWith('u') || t === 'quaternion')) tokenTypeForValue = 'number';
        else if (t === 'bool') tokenTypeForValue = 'keyword';
        else if (t === 'token' || t === 'owner_ptr' || t === 'link_ptr') tokenTypeForValue = 'variable';
        else tokenTypeForValue = 'string';

        if (attr && attr.valueRange && typeof attr.valueRange.start === 'number' && typeof attr.valueRange.end === 'number') {
          const valStart = attr.valueRange.start
          const valEnd = attr.valueRange.end
          const tokIdx = tokenTypes.indexOf(tokenTypeForValue)
          if (tokIdx >= 0 && !rangeIntersectsComments(commentRanges, valStart, valEnd)) {
            queueToken(valStart, valEnd, tokIdx)
          }
        }
      }
    }

    // Queue Comment
    const commentTokenIdx = tokenTypes.indexOf('comment')
    if (commentTokenIdx >= 0) {
      for (const cr of commentRanges) {
        queueToken(cr.start, cr.end, commentTokenIdx)
      }
    }

    tokensToEmit.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      return a.end - b.end
    })

    for (const te of tokensToEmit) {
      pushTokenByRange(builder, lineStarts, te.start, te.end, te.tokenTypeIndex, textLength)
    }

    const result = builder.build() as SemanticTokens
    logger.info('SEMANTIC_TOKENS_COUNT', 'semantic tokens count', { count: result.data?.length ?? 0 })
    return result
  } catch (err) {
    const details = (err && (err as Error).stack ? (err as Error).stack : String(err))
    logger.error('SEMANTIC_ERROR', 'Failed to build semantic tokens', details)
    return { data: [] } as SemanticTokens
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
      const details = (err && (err as Error).stack ? (err as Error).stack : String(err))
      logger.error('SEMANTIC_HANDLER_ERROR', 'Semantic handler failed', details, params.textDocument.uri)
      return { data: [] } as SemanticTokens
    }
  })
}

// export function provideSemanticTokensForDocument(documentText: string): SemanticTokens {
//   try {
//     const builder = new SemanticTokensBuilder();
//     const lineStarts = computeLineStarts(documentText);
//     const textLength = documentText.length;

//     // Comments
//     const commentRanges: { start: number, end: number }[] = []
//     {
//       const text = documentText
//       let i = 0
//       while (i < text.length) {
//         const ch = text[i]
//         if (ch === '/' && text[i + 1] === '/') {
//           const start = i
//           i += 2
//           while (i < text.length && text[i] !== '\n') i++
//           const end = i
//           commentRanges.push({ start, end })
//           continue
//         }
//         if (ch === '#') {
//           const start = i
//           i++
//           while (i < text.length && text[i] !== '\n') i++
//           const end = i
//           commentRanges.push({ start, end })
//           continue
//         }
//         if (ch === '/' && text[i + 1] === '*') {
//           const start = i
//           i += 2
//           while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
//           if (i < text.length) {
//             i +=2
//           } else {
//             i = text.length
//           }
//           const end = Math.min(i, text.length)
//           commentRanges.push({ start, end })
//           continue
//         }
//         i++
//       }
//       commentRanges.sort((a, b) => a.start - b.start)
//     }

//     const commentTokenIdx = tokenTypes.indexOf('comment')
//     if (commentTokenIdx >= 0) {
//       for (const cr of commentRanges) {
//         pushTokenByRange(builder, lineStarts, cr.start, cr.end, commentTokenIdx, textLength)
//       }
//     }

//     // SiiNunit
//     const magicIndex = documentText.indexOf('SiiNunit');
//     if (magicIndex !== -1) {
//       const start = magicIndex;
//       const end = magicIndex + 'SiiNunit'.length;
//       if (!rangeIntersectsComments(commentRanges, start, end)) {
//         const p = offsetToPosition(lineStarts, magicIndex);
//         const idx = tokenTypes.indexOf('keyword');
//         if (idx >= 0) builder.push(p.line, p.char, 'SiiNunit'.length, idx, 0);
//       }
//     }

//     // ParseSii
//     const parsed = parseSii(documentText);

//     for (const cls of parsed.classes) {
//       // Class_name: determine search window (prefer parser-provided offsets)
//       let searchStart = 0;
//       let searchEnd = documentText.length;
//       if ((cls as any).classNameStart !== undefined && (cls as any).classNameEnd !== undefined) {
//         searchStart = (cls as any).classNameStart;
//         searchEnd = (cls as any).classNameEnd + 1;
//       } else if ((cls as any).range && typeof (cls as any).range.start === 'number' && typeof (cls as any).range.end === 'number') {
//         searchStart = (cls as any).range.start;
//         searchEnd = (cls as any).range.end;
//       } else if ((cls as any).bodyStart !== undefined && (cls as any).bodyEnd !== undefined) {
//         searchStart = (cls as any).bodyStart - 50;
//         if (searchStart < 0) searchStart = 0;
//         searchEnd = (cls as any).bodyEnd + 50;
//         if (searchEnd > documentText.length) searchEnd = documentText.length;
//       }

//       const occurrences = findAllOccurrences(documentText, cls.className, searchStart, searchEnd);
//       const classTokenIdx = tokenTypes.indexOf('class');
//       if (classTokenIdx >= 0 && occurrences.length > 0) {
//         for (const occ of occurrences) {
//           if (occ >= 0 && occ + cls.className.length <= textLength) {
//             const start = occ
//             const end = occ + cls.className.length
//             if (!rangeIntersectsComments(commentRanges, start, end)) {
//               const p = offsetToPosition(lineStarts, occ)
//               builder.push(p.line, p.char, cls.className.length, classTokenIdx, 0)
//             }
//           }
//         }
//       }

//       // Keys & Values
//       for (const attr of cls.attributes) {
//         if (attr && attr.keyRange && typeof attr.keyRange.start === 'number' && typeof attr.keyRange.end === 'number') {
//           const keyStart = attr.keyRange.start
//           const keyEnd = attr.keyRange.end
          
//           //@include
//           if (attr.key === '@include') {
//             const kwIdx = tokenTypes.indexOf('keyword')
//             if (kwIdx >= 0 && !rangeIntersectsComments(commentRanges, keyStart, keyEnd))
//               pushTokenByRange(builder, lineStarts, keyStart, keyEnd, kwIdx, textLength)
//           } else {
//             const paramIdx = tokenTypes.indexOf('parameter')
//             if (paramIdx >= 0 && !rangeIntersectsComments(commentRanges, keyStart, keyEnd))
//               pushTokenByRange(builder, lineStarts, keyStart, keyEnd, paramIdx, textLength)
//           }
//         }

//         // Value Types
//         const t = Array.isArray(attr.type) ? attr.type[0] : attr.type
//         let tokenTypeForValue = 'string'
//         if (t === 'string' || t === 'resource_tie') tokenTypeForValue = 'string';
//         else if (typeof t === 'string' && (t.startsWith('float') || t.startsWith('fixed') || t === 'int2' || t.startsWith('s') || t.startsWith('u') || t === 'quaternion')) tokenTypeForValue = 'number';
//         else if (t === 'bool') tokenTypeForValue = 'keyword';
//         else if (t === 'token' || t === 'owner_ptr' || t === 'link_ptr') tokenTypeForValue = 'variable';
//         else tokenTypeForValue = 'string';

//         if (attr && attr.valueRange && typeof attr.valueRange.start === 'number' && typeof attr.valueRange.end === 'number') {
//           const valStart = attr.valueRange.start;
//           const valEnd = attr.valueRange.end;
//           const tokIdx = tokenTypes.indexOf(tokenTypeForValue);
//           if (tokIdx >= 0 && !rangeIntersectsComments(commentRanges, valStart, valEnd)) {
//             pushTokenByRange(builder, lineStarts, valStart, valEnd, tokIdx, textLength);
//           }
//         }
//       }
//     }


    

//     return builder.build() as SemanticTokens;
//   } catch (err) {
//     const details = (err && (err as Error).stack) ? (err as Error).stack : String(err)
//     logger.error('SEMANTIC_ERROR', 'Failed to build semantic tokens', details)
//     return { data: [] } as SemanticTokens;
//   }
// }

// export function registerSemantic (connection: Connection, documents: TextDocuments<TextDocument>) {
//   (globalThis as any).connection = connection

//   connection.languages.semanticTokens.on((params) => {
//     try {
//       const doc = documents.get(params.textDocument.uri)
//       if (!doc) {
//         logger.warn('DOC_NOT_FOUND', 'Document not found for semantic tokens request', undefined, params.textDocument.uri)
//         return { data: [] } as SemanticTokens
//       }

//       return provideSemanticTokensForDocument(doc.getText())
//     } catch (err) {
//       const details = (err && (err as Error).stack) ? (err as Error).stack : String(err)
//       logger.error('SEMANTIC_HANDLER_ERROR', 'Semantic handler failed', details, params.textDocument.uri)
//       return { data: [] } as SemanticTokens
//     }
//   })
// }
