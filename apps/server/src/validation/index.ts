import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { readScsDocument } from '../sii'
import { detectExtFromUri, detectModeFromExt } from '../parser/docParser'
import type { SiiIssue } from '../interfaces/structure'
import { validateSiiDocument } from './rules'

export function validateDocument(doc: TextDocument): Diagnostic[] {
  const ext = detectExtFromUri(doc.uri)
  const mode = detectModeFromExt(ext)
  const parsed = readScsDocument(
    doc.getText(),
    mode === 'unknown' ? 'sii' : mode
  )

  const normalizedDoc = TextDocument.create(
    doc.uri,
    doc.languageId,
    doc.version,
    parsed.text
  )

  // Structural issues come straight from the reader (e.g. a missing '{');
  // business-rule issues come from rules.ts, running against the tree the
  // reader already built. This is the merge point for both.
  const issues: SiiIssue[] = [...parsed.issues, ...validateSiiDocument(parsed)]

  return issues.map((issue) => ({
    severity: DiagnosticSeverity.Error,
    range: {
      start: normalizedDoc.positionAt(issue.range.start),
      end: normalizedDoc.positionAt(issue.range.end),
    },
    message: issue.message,
    source: 'sii.reader',
  }))
}
