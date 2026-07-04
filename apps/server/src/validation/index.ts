import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver'
import type { ParsedClass } from '../interfaces/parser'
import { validateClass } from './valClass'
import type { TextDocument } from 'vscode-languageserver-textdocument'

export function validateDocument(
  document: TextDocument,
  parsedClass: ParsedClass,
  diagnostics: Diagnostic[]
) {
  const errors = validateClass(parsedClass)

  errors.forEach((err) => {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: document.positionAt(err.start),
        end: document.positionAt(err.end),
      },
      message: err.message,
      source: 'sii.validation',
    })
  })
}
