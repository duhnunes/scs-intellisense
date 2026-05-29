import type { ParsedAttribute } from '../interfaces/parser'

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

    // @Include
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

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const afterColon = line.slice(colonIndex + 1)
    const leadingSpacesMatch = afterColon.match(/^\s*/)
    const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0

    // key e value raw
    const keyRaw = line.slice(0, colonIndex)
    const key = keyRaw.trim()
    const value = afterColon.trim()

    const keyStart = lineStartInDoc + line.indexOf(key)
    const keyEnd = keyStart + key.length

    const valueStart = lineStartInDoc + colonIndex + 1 + leadingSpaces
    const valueEnd =
      value.length > 0 ? lineStartInDoc + line.length : valueStart

    attrs.push({
      key,
      type: undefined,
      keyRange: { start: keyStart, end: keyEnd },
      valueRange: { start: valueStart, end: valueEnd },
      arrayElementType: undefined,
      isArray: false,
      description: '',
    })
  }
  return attrs
}
