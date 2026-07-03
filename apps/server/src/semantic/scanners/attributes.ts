import type { ParsedAttribute } from '@/src/interfaces/parser'
import { tokenTypes } from '..'
import { queueToken, rangeIntersectsComments } from '../helpers'
import type { CommentRange, TokenEntry } from '@/src/interfaces/token'
import type { AttributeType } from '@/src/interfaces/structure'
import { inferTypeFromValueText } from './valueType'

export function scanAttributes(
  text: string,
  attributes: ParsedAttribute[],
  comments: CommentRange[],
  textLength: number
): TokenEntry[] {
  const tokens: TokenEntry[] = []

  for (const attr of attributes) {
    // KEY
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
        if (kwIdx >= 0 && !rangeIntersectsComments(comments, keyStart, keyEnd))
          queueToken(tokens, keyStart, keyEnd, kwIdx, textLength)
      } else {
        const paramIdx = tokenTypes.indexOf('parameter')
        if (
          paramIdx >= 0 &&
          !rangeIntersectsComments(comments, keyStart, keyEnd)
        )
          queueToken(tokens, keyStart, keyEnd, paramIdx, textLength)
      }
    }

    // VALUE
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
    const effectiveType = declaredType ?? inferTypeFromValueText(rawValueText)

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

      // Adjust if have comment in same line
      const lineStart = text.lastIndexOf('\n', valStart) + 1
      const lineEnd = text.indexOf('\n', valStart)

      const idxComment = (() => {
        const lineEndOffset = lineEnd === -1 ? text.length : lineEnd

        for (let j = 0; j < comments.length; j++) {
          const cr = comments[j]
          if (!cr) continue
          if (cr.start >= lineStart && cr.start < lineEndOffset) return cr.start
          if (cr.start >= lineEndOffset) break
        }
        return -1
      })()

      if (idxComment !== -1 && idxComment > valStart && idxComment < valEnd) {
        valEnd = idxComment
      }

      // Adjust @include with ""
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
                  queueToken(tokens, numS, numE, tokIdx, textLength)
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
        } else {
          // If this is a token/owner ptr/link_ptr (mapped to 'method'), emit only
          // the alphanumeric/underscore segments and skip dots.
          const methodTokenIdx = tokenTypes.indexOf('method')
          if (tokIdx === methodTokenIdx) {
            // scan from valStart to valEnd and emit only [a-z0-9_]+ spans
            let p = valStart
            while (p < valEnd) {
              // skip non-token chars (dots, spaces, quotes, etc.)
              while (p < valEnd && !/[a-z0-9_]/.test(text.charAt(p))) p++
              if (p >= valEnd) break
              const s = p
              while (p < valEnd && /[a-z0-9_]/.test(text.charAt(p))) p++
              const e = p
              // emit only when we actually consumed at least one char
              if (e > s) queueToken(tokens, s, e, methodTokenIdx, textLength)
            }
          } else {
            queueToken(tokens, valStart, valEnd, tokIdx, textLength)
          }
        }
      }
    }
  }

  return tokens
}
