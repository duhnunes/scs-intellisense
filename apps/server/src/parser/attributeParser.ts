import type { ParsedAttribute } from '../interfaces/parser'
import { findColonOutsideString, findInlineCommentIndex } from './helpers'

/**
 * parseAttributes
 * - documentText: full document (used to compute absolute ranges)
 * - body: block text (content inside { ... })
 * - bodyStartOffset: absolute offset where body begins
 * - className: name of the class being parsed
 *
 * NOTE: This function returns raw ParsedAttribute entries with ranges and key/value text.
 */

export function parseAttributes(
  documentText: string,
  body: string,
  bodyStartOffset: number,
  className: string
): ParsedAttribute[] {
  const lines = body.split(/\r?\n/)
  const attrs: ParsedAttribute[] = []
  let cursor = 0
  for (const rawLine of lines) {
    const line = rawLine
    const lineStartInDoc = bodyStartOffset + cursor
    cursor += rawLine.length + 1

    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue

    // @Include - global attribute
    if (trimmed.startsWith('@include')) {
      const includeIndex = line.indexOf('@include')
      const keyStart = lineStartInDoc + includeIndex
      const keyEnd = keyStart + '@include'.length

      const after = line.slice(includeIndex + '@include'.length)
      const m = after.match(/^\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
      let valueStart = keyEnd
      let valueEnd = keyEnd
      if (m) {
        const valueTextFound = m[1] ?? m[2] ?? m[3] ?? ''
        const matchIndexInAfter = after.indexOf(m[0])
        const rawValueIndexInAfter =
          matchIndexInAfter + m[0].indexOf(valueTextFound)
        valueStart =
          lineStartInDoc +
          includeIndex +
          '@include'.length +
          rawValueIndexInAfter
        valueEnd = valueStart + valueTextFound.length
      }

      attrs.push({
        key: '@include',
        type: 'resource_tie',
        keyRange: { start: keyStart, end: keyEnd },
        valueRange: { start: valueStart, end: valueEnd },
        description: '',
        isArray: false,
        arrayElementType: undefined,
      })
      continue
    }

    // find colon outside strings
    const colonIndex = findColonOutsideString(line)
    if (colonIndex === -1) continue

    const afterColon = line.slice(colonIndex + 1)
    const leadingSpacesMatch = afterColon.match(/^\s*/)
    const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0

    // key e value raw
    const keyRaw = line.slice(0, colonIndex)
    const key = keyRaw.trim()

    const keyStart = lineStartInDoc + line.indexOf(key)
    let keyEnd = keyStart + key.length
    const relKeyEndInline = line.indexOf(key) + key.length
    const postKey = line.slice(relKeyEndInline)
    const bracketMatch = postKey.match(/^\s*\[\s*\]/)
    let isArrayKey = false
    if (bracketMatch) {
      keyEnd += bracketMatch[0].length
      isArrayKey = true
    }

    // compute valueStart absolute
    const valueStart = lineStartInDoc + colonIndex + 1 + leadingSpaces

    // compute valueEnd
    // - if value starts with quote, find closing quote (respecting escapes) on same line
    // - otherwise, value ends at first inline comment or at first whitespace after token
    let valueEnd = valueStart
    const relValueStartInLine = colonIndex + 1 + leadingSpaces
    if (relValueStartInLine < line.length) {
      const firstChar = line[relValueStartInLine]
      if (firstChar === '"' || firstChar === "'") {
        // find closing quote on same line
        const quote = firstChar
        let escaped = false
        let found = -1
        for (let i = relValueStartInLine + 1; i < line.length; i++) {
          const ch = line[i]
          if (escaped) {
            escaped = false
            continue
          }
          if (ch === '\\') {
            escaped = true
            continue
          }
          if (ch === quote) {
            found = i
            break
          }
        }
        if (found !== -1) {
          // include closing quote
          valueEnd = lineStartInDoc + found + 1
        } else {
          // no closing quote on same line: take until line end (safe fallback)
          valueEnd = lineStartInDoc + line.length
        }
      } else {
        // non-quoted value: end at inline comment or at first whitespace after token
        const inlineCommentIdx = findInlineCommentIndex(line)
        const tokenEndInLine = (() => {
          // scan from relValueStartInLine until whitespace or comment
          let i = relValueStartInLine
          while (i < line.length) {
            const ch = line[i]
            if (ch === ' ' || ch === '\t') break
            // stop if comment start (// or #)
            if (ch === '/' && i + 1 < line.length && line[i + 1] === '/') break
            if (ch === '#') break
            i++
          }
          return i
        })()

        const endCandidate =
          inlineCommentIdx !== -1
            ? Math.min(tokenEndInLine, inlineCommentIdx)
            : tokenEndInLine
        valueEnd = lineStartInDoc + endCandidate
      }
    } else {
      valueEnd = valueStart
    }

    attrs.push({
      key,
      type: undefined,
      keyRange: { start: keyStart, end: keyEnd },
      valueRange: { start: valueStart, end: valueEnd },
      arrayElementType: undefined,
      isArray: isArrayKey,
      description: '',
    })
  }
  return attrs
}
