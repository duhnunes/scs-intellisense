import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { readScsDocument } from '../sii'
import { detectExtFromUri, detectModeFromExt } from '../parser/docParser'

export function validateDocument(doc: TextDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const ext = detectExtFromUri(doc.uri)
  const mode = detectModeFromExt(ext)
  const parsed = readScsDocument(
    doc.getText(),
    mode === 'unknown' ? 'sii' : mode
  )

  for (const issue of parsed.issues) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: doc.positionAt(issue.range.start),
        end: doc.positionAt(issue.range.end),
      },
      message: issue.message,
      source: 'sii.reader',
    })
  }

  return diagnostics
}
