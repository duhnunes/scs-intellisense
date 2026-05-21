import {
  extractAttributesFromBody,
  type ParsedAttribute,
  type ParsedClass,
} from '.'

// detect comment to not completions inside
export function isOffsetInsideComment(text: string, offset: number): boolean {
  if (offset < 0) return false

  // check line comments '//' and '#'
  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1
  const lineEnd = text.indexOf('\n', offset)
  const lineSlice = text.slice(
    lineStart,
    lineEnd === -1 ? text.length : lineEnd
  )

  const idxSlash = lineSlice.indexOf('//')
  if (idxSlash !== -1) {
    const commentStartInDoc = lineStart + idxSlash
    if (offset >= commentStartInDoc) return true
  }
  const idxHash = lineSlice.indexOf('#')
  if (idxHash !== -1) {
    const commentStartInDoc = lineStart + idxHash
    if (offset >= commentStartInDoc) return true
  }

  const lastOpen = text.lastIndexOf('/*', offset)
  if (lastOpen === -1) return false
  const nextClose = text.indexOf('*/', lastOpen + 2)
  if (nextClose === -1 || nextClose >= offset) return true

  return false
}

/**
 * parseClassesInto
 * - baseOffset: offset in the document where 'text' begins (to calculate absolute ranges)
 * - text: section to be parsed (this could be the SiiNunit body or the entire document)
 * - classesOut: array where the found classes will be pushed.
 */
export function parseClassesInto(
  documentText: string,
  baseOffset: number,
  text: string,
  classesOut: ParsedClass[]
) {
  // Scan to ClassName
  const classHeaderRegex = /([A-Za-z0-9_.-]+)\s*:\s*([A-Za-z0-9_.-]+)\s*\{/g
  let match
  while ((match = classHeaderRegex.exec(text)) !== null) {
    const [full, className, unitName] = match
    const headerIndexInText = match.index
    const headerIndexInDoc = baseOffset + headerIndexInText

    if (!className || !unitName) continue

    const classNameIndexInHeader = full.indexOf(className)
    const unitNameIndexInHeader = full.indexOf(
      unitName,
      classNameIndexInHeader + className.length
    )

    const classNameStart = headerIndexInDoc + classNameIndexInHeader
    const classNameEnd = classNameStart + className.length

    const unitNameStart = headerIndexInDoc + unitNameIndexInHeader
    const unitNameEnd = unitNameStart + unitName.length

    const braceOpenInText = headerIndexInText + full.lastIndexOf('{')
    const braceOpenInDoc = baseOffset + braceOpenInText
    const braceCloseInDoc = findMatchingBrace(documentText, braceOpenInDoc)
    const bodyStart = braceOpenInDoc + 1
    const bodyEnd =
      braceCloseInDoc !== -1 ? braceCloseInDoc : documentText.length
    const body = documentText.slice(bodyStart, bodyEnd)

    const attributes: ParsedAttribute[] = extractAttributesFromBody(
      documentText,
      body,
      bodyStart,
      className
    )

    classesOut.push({
      className,
      unitName,
      attributes,
      classNameStart,
      classNameEnd,
      unitNameStart,
      unitNameEnd,
      bodyStart,
      bodyEnd,
    })

    if (braceCloseInDoc !== -1) {
      const nextPos = braceCloseInDoc - baseOffset + 1
      classHeaderRegex.lastIndex = nextPos
    }
  }
}

/**
 * findMatchingBrace
 * - given an index of '{' in the document, find the corresponding index of '}' (balancing)
 * - returns -1 if not found.
 */
export function findMatchingBrace(text: string, openIndex: number): number {
  if (openIndex < 0 || text[openIndex] !== '{') return -1
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
