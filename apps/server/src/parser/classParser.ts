import type { ParsedAttribute, ParsedClass } from '../interfaces/parser'
import { parseAttributes } from './attributeParser'

/**
 * parseClassesInto
 * - baseOffset: offset in the document where 'text' begins (to calculate absolute ranges)
 * - text: section to be parsed (this could be the SiiNunit body or the entire document)
 * - classesOut: array where the found classes will be pushed.
 */
export function parseClasses(
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

    const attributes: ParsedAttribute[] = parseAttributes(
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
