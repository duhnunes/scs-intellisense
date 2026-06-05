import {
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  type Connection,
  type TextDocuments,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getLogger } from '../logger'
import {
  computeLineStarts,
  findAllOccurrences,
  pushTokenByRange,
  rangeIntersectsComments,
} from './helpers'
import {
  detectExtFromUri,
  detectModeFromExt,
  normalizeText,
  parseDocument,
} from '../parser/docParser'
import type { ParsedAttribute, ParsedClass } from '../interfaces/parser'
import type { AttributeType } from '../interfaces/structure'

// # TOKEN TYPES
export const tokenTypes = [
  'keyword',
  'class',
  'parameter',
  'string',
  'number',
  'comment',
  'method',
]
const tokenModifiers: string[] = []

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes,
  tokenModifiers,
}

const logger = getLogger()

export function provideSemanticTokensForDocument(
  documentText: string,
  documentUri?: string
): SemanticTokens {
  try {
    const text = normalizeText(documentText)

    const ext = detectExtFromUri(documentUri)
    const mode = detectModeFromExt(ext)
    void mode // waiting to use

    const builder = new SemanticTokensBuilder()
    const lineStarts = computeLineStarts(text)
    const textLength = text.length

    // Comments
    const commentRanges: { start: number; end?: number }[] = []
    {
      let i = 0
      const len = text.length
      let inSingle = false
      let inDouble = false
      let inBlock = false

      while (i < len) {
        const ch = text[i]
        const next = i + 1 < len ? text[i + 1] : ''

        if (inBlock) {
          if (ch === '*' && next === '/') {
            const end = i + 2
            // close the last opened block comment only if it is still open
            const last =
              commentRanges.length > 0
                ? commentRanges[commentRanges.length - 1]
                : undefined
            if (last && last.end === undefined) {
              last.end = end
            }
            // if there is no open block comment, ignore stray '*/'
            inBlock = false
            i += 2
            continue
          }
          i++
          continue
        }

        // handle string toggles (respect escapes)
        if (!inSingle && ch === '"' && text[i - 1] !== '\\') {
          inDouble = !inDouble
          i++
          continue
        }
        if (!inDouble && ch === "'" && text[i - 1] !== '\\') {
          inSingle = !inSingle
          i++
          continue
        }

        // if inside any string, skip comment detection
        if (inSingle || inDouble) {
          i++
          continue
        }

        // line comment //
        if (ch === '/' && next === '/') {
          const start = i
          i += 2
          while (i < len && text[i] !== '\n') i++
          const end = i
          commentRanges.push({ start, end })
          continue
        }

        // block comment /*
        if (ch === '/' && next === '*') {
          const start = i
          inBlock = true
          // push start with temporary end; will be closed when '*/' found
          commentRanges.push({ start })
          i += 2
          continue
        }

        // hash comment #
        if (ch === '#') {
          const start = i
          i++
          while (i < len && text[i] !== '\n') i++
          const end = i
          commentRanges.push({ start, end })
          continue
        }

        i++
      }

      // finalize any unterminated block comments: set end to text.length
      for (const cr of commentRanges) {
        if (cr.end === undefined) cr.end = len
      }

      // sort ranges by start
      commentRanges.sort((a, b) => a.start - b.start)
    }

    // Queue Tokens
    type TokenEntry = { start: number; end: number; tokenTypeIndex: number }
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
    const magicIndex = text.indexOf('SiiNunit')
    if (magicIndex !== -1) {
      const start = magicIndex
      const end = magicIndex + 'SiiNunit'.length
      if (!rangeIntersectsComments(commentRanges, start, end)) {
        const idx = tokenTypes.indexOf('keyword')
        if (idx >= 0) queueToken(start, end, idx)
      }
    }

    // ParseSii
    const parsed =
      parseDocument(text, { uri: documentUri }) ??
      ({
        magicMark: '',
        classes: [],
      } as { magicMark: string; classes: ParsedClass[] })
    for (const cls of parsed.classes as ParsedClass[]) {
      // Class_name: determine search window
      let searchStart = 0
      let searchEnd = text.length
      if (
        typeof cls.classNameStart === 'number' &&
        typeof cls.classNameEnd === 'number'
      ) {
        searchStart = cls.classNameStart
        searchEnd = cls.classNameEnd + 1
      } else if (
        cls.range &&
        typeof cls.range.start === 'number' &&
        typeof cls.range.end === 'number'
      ) {
        searchStart = cls.range.start
        searchEnd = cls.range.end
      } else if (cls.bodyStart !== undefined && cls.bodyEnd !== undefined) {
        searchStart = cls.bodyStart - 50
        if (searchStart < 0) searchStart = 0
        searchEnd = cls.bodyEnd + 50
        if (searchEnd > text.length) searchEnd = text.length
      }

      const occurrences = findAllOccurrences(
        text,
        cls.className,
        searchStart,
        searchEnd
      )
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
      for (const attr of cls.attributes as ParsedAttribute[]) {
        if (
          attr &&
          attr.keyRange &&
          typeof attr.keyRange.start === 'number' &&
          typeof attr.keyRange.end === 'number'
        ) {
          const keyStart = attr.keyRange.start
          const keyEnd = attr.keyRange.end

          // @include or key
          if (attr.key === '@include') {
            const kwIdx = tokenTypes.indexOf('keyword')
            if (
              kwIdx >= 0 &&
              !rangeIntersectsComments(commentRanges, keyStart, keyEnd)
            )
              queueToken(keyStart, keyEnd, kwIdx)
          } else {
            const paramIdx = tokenTypes.indexOf('parameter')
            if (
              paramIdx >= 0 &&
              !rangeIntersectsComments(commentRanges, keyStart, keyEnd)
            )
              queueToken(keyStart, keyEnd, paramIdx)
          }
        }

        // Value Types
        function inferTypeFromValueText(raw: string): string {
          const v = raw.trim()
          if (!v) return 'string'
          // string
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          )
            return 'string'
          // boolean
          if (v === 'true' || v === 'false') return 'bool'
          // vector (x, y, z)
          if (v.startsWith('(') && v.endsWith(')')) {
            const inner = v.slice(1, -1).trim()
            const parts = inner
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
            const ishexElement = (p: string) =>
              /^&[0-9a-fA-F]{8}$/.test(p) || /^&[0-9a-fA-F]+$/.test(p)
            const allHexOrFloatLike = parts.every(
              (p) => ishexElement(p) || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(p)
            )
            const allFloatLike = parts.every((p) =>
              /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(p)
            )
            const allIntLike = parts.every((p) => /^-?\d+$/.test(p))

            if (allHexOrFloatLike) {
              if (parts.length === 2) return 'float2'
              if (parts.length === 3) return 'float3'
              if (parts.length === 4) return 'float4'
              return 'float'
            }
            if (allFloatLike) {
              if (parts.length === 2) return 'float2'
              if (parts.length === 3) return 'float3'
              if (parts.length === 4) return 'float4'
              return 'float'
            }
            if (allIntLike) {
              if (parts.length === 2) return 'fixed2'
              if (parts.length === 3) return 'fixed3'
              if (parts.length === 4) return 'fixed4'
              return 'fixed'
            }
            if (v.startsWith('(') && v.includes(')(')) {
              return 'placement'
            }
            return 'string'
          }
          // IEEE754 hex float: &3f800000 (common form) or &<hex+>
          if (/^&[0-9a-fA-F]{8}$/.test(v) || /^&[0-9a-fA-F]+$/.test(v))
            return 'float'
          // fixed  - decimal float: 1.0
          if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return 'float'
          // token
          if (/^[a-z0-9_.]+$/.test(v)) return 'token'
          return 'string'
        }

        let rawValueText = ''
        if (
          attr &&
          attr.valueRange &&
          typeof attr.valueRange.start === 'number' &&
          typeof attr.valueRange.end === 'number'
        ) {
          rawValueText = text.slice(attr.valueRange.start, attr.valueRange.end)
        }

        const declaredType = Array.isArray(attr.type)
          ? attr.type[0]
          : (attr.type as AttributeType | undefined)
        const effectiveType =
          declaredType ?? inferTypeFromValueText(rawValueText)

        let tokenTypeForValue = 'string'
        if (effectiveType === 'string' || effectiveType === 'resource_tie')
          tokenTypeForValue = 'string'
        else if (
          typeof effectiveType === 'string' &&
          (effectiveType.startsWith('float') ||
            effectiveType.startsWith('fixed') ||
            effectiveType === 'int2' ||
            effectiveType.startsWith('s') ||
            effectiveType.startsWith('u') ||
            effectiveType === 'quaternion' ||
            effectiveType === 'placement')
        )
          tokenTypeForValue = 'number'
        else if (effectiveType === 'bool') tokenTypeForValue = 'keyword'
        else if (
          effectiveType === 'token' ||
          effectiveType === 'owner_ptr' ||
          effectiveType === 'link_ptr'
        )
          tokenTypeForValue = 'method'
        else tokenTypeForValue = 'string'

        if (
          attr &&
          attr.valueRange &&
          typeof attr.valueRange.start === 'number' &&
          typeof attr.valueRange.end === 'number'
        ) {
          let valStart = attr.valueRange.start
          let valEnd = attr.valueRange.end

          const lineStart = text.lastIndexOf('\n', valStart) + 1
          const lineEnd = text.indexOf('\n', valStart)

          const idxComment = (() => {
            const lineEndOffset = lineEnd === -1 ? text.length : lineEnd

            for (let j = 0; j < commentRanges.length; j++) {
              const cr = commentRanges[j]
              if (!cr) continue
              if (cr.start >= lineStart && cr.start < lineEndOffset)
                return cr.start
              if (cr.start >= lineEndOffset) break
            }
            return -1
          })()

          if (
            idxComment !== -1 &&
            idxComment > valStart &&
            idxComment < valEnd
          ) {
            valEnd = idxComment
          }

          if (attr.key === '@include') {
            if (valStart - 1 >= 0) {
              const chBefore = text[valStart - 1]
              if (chBefore === '"' || chBefore === "'") {
                valStart = valStart - 1
              }
            }

            if (valEnd < text.length) {
              const chAfter = text[valEnd]
              if (chAfter === '"' || chAfter === '"') {
                valEnd = valEnd + 1
              }
            }
          }

          const tokIdx = tokenTypes.indexOf(tokenTypeForValue)
          if (tokIdx >= 0 && valEnd > valStart) {
            // If the value is a parenthesized tuple and token type is number,
            // emit numeric tokens for each numeric element inside parentheses.
            const raw = text.slice(valStart, valEnd)
            if (raw.startsWith('(')) {
              // Walk the raw alue and emit numeric tokens for any numeric substrings.
              // Accept separators: comma, semicolon, whitepsace, and allow multiple groups like (a)(b)
              let i = valStart
              const end = valEnd
              while (i < end) {
                const ch = text.charAt(i)
                if (ch === '(') {
                  // enter group: scan until matching ')' and parse numbers inside
                  let depth = 0
                  const gStart = i + 1
                  let gEnd = -1
                  for (let k = i; k < end; k++) {
                    const c = text.charAt(k)
                    if (c === '(') depth++
                    else if (c === ')') {
                      depth--
                      if (depth === 0) {
                        gEnd = k
                        break
                      }
                    } else if (c === '"' || c === "'") {
                      const q = c
                      k++
                      while (k < end) {
                        const c2 = text.charAt(k)
                        if (c2 === '\\') {
                          k += 2
                          continue
                        }
                        if (c2 === q) break
                        k++
                      }
                    }
                  }
                  // unterminated group: stop scanning
                  if (gEnd === -1) break

                  // scan numbers inside [gStart, gEnd]
                  let j = gStart
                  while (j < gEnd) {
                    // skip whitespace and separators
                    while (j < gEnd && /[,\s;]/.test(text.charAt(j))) j++
                    if (j >= gEnd) break
                    const numS = j
                    let seenNum = false
                    // If strats with '&', consume hex digits (IEEE hex float)
                    if (j < gEnd && text.charAt(j) === '&') {
                      let k = j + 1
                      // consume 1+ hex digits (prefer 8 but accept variable length)
                      while (k < gEnd && /[0-9a-fA-F]/.test(text.charAt(k))) k++
                      if (k > j + 1) {
                        seenNum = true
                        j = k
                      }
                    } else {
                      // decimal/float with optional sign and exponent
                      while (j < gEnd && /[0-9+\-.eE]/.test(text.charAt(j))) {
                        seenNum = true
                        j++
                      }
                    }
                    const numE = j
                    if (seenNum && numE > numS) {
                      queueToken(numS, numE, tokIdx)
                    } else {
                      // skip non-number char
                      j++
                    }
                  }
                  // advance i after this group
                  i = gEnd + 1
                  continue
                }
                // skip anything outside groups (commas, spaces, etc.)
                i++
              }
            } else if (!raw.startsWith('(')) {
              // default: emit whole value range
              queueToken(valStart, valEnd, tokIdx)
            }
          }
        }
      }
    }

    // Queue Comment
    const commentTokenIdx = tokenTypes.indexOf('comment')
    if (commentTokenIdx >= 0) {
      for (const cr of commentRanges) {
        const start = cr.start
        const end = typeof cr.end === 'number' ? cr.end : textLength
        if (start < end) queueToken(start, end, commentTokenIdx)
      }
    }

    tokensToEmit.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      if (a.end !== b.end) return a.end - b.end
      // If same span, prefer non-comment tokens first, comment tokens last
      if (
        a.tokenTypeIndex === commentTokenIdx &&
        b.tokenTypeIndex !== commentTokenIdx
      )
        return 1
      if (
        b.tokenTypeIndex === commentTokenIdx &&
        a.tokenTypeIndex !== commentTokenIdx
      )
        return -1
      return a.tokenTypeIndex - b.tokenTypeIndex
    })

    for (const te of tokensToEmit) {
      pushTokenByRange(
        builder,
        lineStarts,
        te.start,
        te.end,
        te.tokenTypeIndex,
        textLength
      )
    }

    return builder.build() as SemanticTokens
  } catch (err) {
    const details =
      err && (err as Error).stack ? (err as Error).stack : String(err)
    logger.error('SEMANTIC_ERROR', 'Failed to build semantic tokens', details)
    return { data: [] } as SemanticTokens
  }
}

export function registerSemantic(
  connection: Connection,
  documents: TextDocuments<TextDocument>
) {
  globalThis.connection = connection

  connection.languages.semanticTokens.on((params) => {
    try {
      const doc = documents.get(params.textDocument.uri)
      if (!doc) {
        logger.warn(
          'DOC_NOT_FOUND',
          'Document not found for semantic tokens request',
          undefined,
          params.textDocument.uri
        )
        return { data: [] } as SemanticTokens
      }

      return provideSemanticTokensForDocument(doc.getText(), doc.uri)
    } catch (err) {
      const details =
        err && (err as Error).stack ? (err as Error).stack : String(err)
      logger.error(
        'SEMANTIC_HANDLER_ERROR',
        'Semantic handler failed',
        details,
        params.textDocument.uri
      )
      return { data: [] } as SemanticTokens
    }
  })
}
