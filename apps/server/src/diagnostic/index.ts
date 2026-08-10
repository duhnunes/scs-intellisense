import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { readScsDocument } from '../sii'
import { detectExtFromUri, detectModeFromExt } from '../parser/docParser'
import type { SiiIssue, SiiSeverity } from '../interfaces/structure'
import { validateSiiDocument } from './rules'

const DEFAULT_ENABLED_SEVERITIES: SiiSeverity[] = [
  'error',
  'warning',
  'information',
  'hint',
]

export function getDiagnostics(
  doc: TextDocument,
  enabledSeverities: SiiSeverity[] = DEFAULT_ENABLED_SEVERITIES
): Diagnostic[] {
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
  const issues: SiiIssue[] = [
    ...parsed.issues,
    ...validateSiiDocument(parsed),
  ].filter((issue) => enabledSeverities.includes(issue.severity ?? 'error'))

  return issues.map((issue) => ({
    severity: toDiagnosticSeverity(issue.severity),
    range: {
      start: normalizedDoc.positionAt(issue.range.start),
      end: normalizedDoc.positionAt(issue.range.end),
    },
    message: issue.message,
    source: 'sii.reader',
  }))
}

/**
 * Every issue defaults to 'error' when it doesn't set a severity — which
 * today is every single one, since nothing in reader.ts or rules.ts has
 * needed anything less certain than "this breaks the mod" yet. A future
 * rule only needs to set `severity: 'warning'` (or
 * 'information'/'hint') on the SiiIssue it returns for this to pick it
 * up automatically — no other change needed here or in server.ts.
 */
function toDiagnosticSeverity(
  severity: SiiSeverity | undefined
): DiagnosticSeverity {
  switch (severity) {
    case 'warning':
      return DiagnosticSeverity.Warning
    case 'information':
      return DiagnosticSeverity.Information
    case 'hint':
      return DiagnosticSeverity.Hint
    case 'error':
    default:
      return DiagnosticSeverity.Error
  }
}
