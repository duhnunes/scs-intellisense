import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { ParsedAttribute, ParsedClass } from '../interfaces/parser'
import { parseAttributes } from './attributeParser'

function parseClassHeader(text: string, offset: number) {
  let i = 0
  while (i < text.length && /\s/.test(text.charAt(i))) i++

  const classStart = i
  while (i < text.length && /[A-Za-z0-9_.-]/.test(text.charAt(i))) i++
  if (i === classStart) throw new Error('Expected className')
  const className = text.slice(classStart, i)

  while (i < text.length && /\s/.test(text.charAt(i))) i++
  if (i >= text.length || text[i] !== ':')
    throw new Error("Expected ':' between className and unitName")
  i++

  while (i < text.length && /\s/.test(text.charAt(i))) i++

  const unitStart = i
  while (i < text.length && /[a-z0-9_.]/.test(text.charAt(i))) i++
  if (i === unitStart) throw new Error('Invalid unitName format')
  const unitName = text.slice(unitStart, i)

  while (i < text.length && /\s/.test(text.charAt(i))) i++
  if (text[i] !== '{') throw new Error("Expected '{' after unitName")

  return {
    className,
    unitName,
    bodyStart: offset + i,
  }
}

export function parseClasses(
  document: TextDocument,
  baseOffset: number,
  text: string,
  classesOut: ParsedClass[],
  diagnostics: Diagnostic[]
) {
  // Scan to ClassName
  let cursor = 0
  while (cursor < text.length) {
    const braceIndex = text.indexOf('{', cursor)
    if (braceIndex === -1) break

    const headerText = text.slice(cursor, braceIndex + 1)

    const headerTrimmed = headerText.trimStart()

    try {
      const header = parseClassHeader(headerTrimmed, baseOffset + cursor)

      // className
      const classNameStart = baseOffset + cursor
      const classNameEnd = classNameStart + header.className.length

      // unitName
      const unitNameIndexHeader = headerText.indexOf(header.unitName)
      const unitNameStart = baseOffset + cursor + unitNameIndexHeader
      const unitNameEnd = unitNameStart + header.unitName.length

      const braceCloseInDoc = findMatchingBrace(
        document.getText(),
        header.bodyStart
      )
      const bodyStart = header.bodyStart + 1
      const bodyEnd =
        braceCloseInDoc !== -1 ? braceCloseInDoc : document.getText().length
      const body = document.getText().slice(bodyStart, bodyEnd)

      const attributes: ParsedAttribute[] = parseAttributes(
        document.getText(),
        body,
        bodyStart,
        header.className
      )

      classesOut.push({
        className: header.className,
        unitName: header.unitName,
        attributes,
        classNameStart,
        classNameEnd,
        unitNameStart,
        unitNameEnd,
        bodyStart,
        bodyEnd,
      })

      cursor = bodyEnd - baseOffset + 1
    } catch (err) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: document.positionAt(baseOffset + cursor),
          end: document.positionAt(baseOffset + cursor + headerText.length),
        },
        message: err instanceof Error ? err.message : String(err),
        source: 'sii.schema',
      })
      cursor = braceIndex + 1
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
