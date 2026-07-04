import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { ParsedAttribute, ParsedClass } from '../interfaces/parser'
import { parseAttributes } from './attributeParser'
import type { ValidationError } from '../interfaces/validation'

function parseClassHeader(text: string, offset: number) {
  const errors: ValidationError[] = []
  let i = 0
  while (i < text.length && /\s/.test(text.charAt(i))) i++

  const classStart = i
  while (i < text.length && /[A-Za-z0-9_.-]/.test(text.charAt(i))) i++
  if (i === classStart) {
    errors.push({
      message: 'Expected className',
      start: offset + classStart,
      end: offset + classStart + 1,
    })
  }
  const className = text.slice(classStart, i)

  while (i < text.length && /\s/.test(text.charAt(i))) i++
  if (i >= text.length || text[i] !== ':') {
    const colonPos = offset + i
    errors.push({
      message: "Expected ':' between className and unitName",
      start: colonPos,
      end: colonPos + 1,
    })
  }
  i++

  while (i < text.length && /\s/.test(text.charAt(i))) i++

  // unitName
  const unitStart = i
  while (
    i < text.length &&
    text[i] !== '{' &&
    text[i] !== ' ' &&
    text[i] !== '\t' &&
    text[i] !== '\n'
  )
    i++
  if (i === unitStart) {
    errors.push({
      message: 'Invalid unitName format',
      start: offset + unitStart,
      end: offset + unitStart + 1,
    })
  }

  const unitName = text.slice(unitStart, i)
  const tokens = unitName.split('.')

  let runningOffset = unitStart
  tokens.forEach((token, idx) => {
    const tokenStart = offset + runningOffset
    const tokenEnd = tokenStart + token.length

    if (token.length > 12) {
      errors.push({
        message: `UnitName token exceeds 12 characters: "${token}"`,
        start: tokenStart,
        end: tokenEnd,
      })
    }
    if (!/^[a-z0-9_]*$/.test(token)) {
      if (/[A-Z]/.test(token)) {
        errors.push({
          message: `UnitName token contains uppercase letters: "${token}"`,
          start: tokenStart,
          end: tokenEnd,
        })
      } else {
        errors.push({
          message: `UnitName token contains invalid characters: "${token}"`,
          start: tokenStart,
          end: tokenEnd,
        })
      }
    }
    if (token.length === 0 && idx !== 0) {
      errors.push({
        message: 'UnitName must not contain empty tokens (consecutive dots)',
        start: tokenStart,
        end: tokenEnd,
      })
    }

    runningOffset += token.length + 1
  })

  while (i < text.length && /\s/.test(text.charAt(i))) i++
  if (text[i] !== '{') {
    errors.push({
      message: "Expected '{' after unitName",
      start: offset + unitStart,
      end: offset + unitStart + 1,
    })
  }

  return {
    className,
    colonPos: offset + classStart + className.length,
    unitName,
    bodyStart: offset + i,
    errors,
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

    try {
      const header = parseClassHeader(headerText, baseOffset + cursor)

      header.errors.forEach((err) => {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: document.positionAt(err.start),
            end: document.positionAt(err.end),
          },
          message: err.message,
          source: 'sii.schema',
        })
      })

      if (header.errors.length > 0) {
        const bodyCloseInDoc = findMatchingBrace(
          document.getText(),
          header.bodyStart
        )
        const bodyEnd =
          bodyCloseInDoc !== -1 ? bodyCloseInDoc : document.getText().length
        cursor = bodyEnd - baseOffset + 1
        continue
      }

      // className
      const classNameStart = baseOffset + cursor
      const classNameEnd = classNameStart + header.className.length

      // unitName
      const unitNameIndexHeader = headerText.indexOf(header.unitName)
      const unitNameStart = baseOffset + cursor + unitNameIndexHeader
      const unitNameEnd = unitNameStart + header.unitName.length

      if (header.errors.length === 0) {
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
          colonPos: header.colonPos,
          bodyStart,
          bodyEnd,
        })

        cursor = bodyEnd - baseOffset + 1
      }
    } catch (err) {
      const e = err as Error
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: document.positionAt(baseOffset + cursor),
          end: document.positionAt(baseOffset + cursor + headerText.length),
        },
        message: e.message,
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
