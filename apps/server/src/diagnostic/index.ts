import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { readScsDocument } from '../sii'
import { detectExtFromUri, detectModeFromExt } from '../parser/docParser'
import type {
  SiiDocument,
  SiiIssue,
  SiiSeverity,
} from '../interfaces/structure'
import { asFragmentDocument } from '../index/fragments'
import { validateSiiDocument } from './rules'
import {
  validateAttributeKeys,
  validateEnumValues,
  validateValueTypes,
  type SchemaLookup,
} from './schemaRules'

const DEFAULT_ENABLED_SEVERITIES: SiiSeverity[] = [
  'error',
  'warning',
  'information',
  'hint',
]

export const DIAGNOSTIC_SOURCE = 'sii.reader'

export interface CheckedDocument {
  parsed: SiiDocument
  /** The document over `parsed.text`, for converting issue offsets. */
  normalizedDoc: TextDocument
  /** `parsed`, with a .sui fragment's bare attributes in a unit of the
   *  including class (asFragmentDocument()): what the schema rules and
   *  their quick fixes read. */
  classed: SiiDocument
  issues: SiiIssue[]
}

/** Reads a document and collects every issue the user has enabled. Shared
 *  by diagnostics and quick fixes, so both always see the same issues.
 *  With `schemaFor`, the rules that need the schema run too, for the
 *  classes it has loaded; `fragmentClass` gives a .sui fragment the class
 *  of the units that @include it. */
export function checkDocument(
  doc: TextDocument,
  enabledSeverities: SiiSeverity[] = DEFAULT_ENABLED_SEVERITIES,
  schemaFor?: SchemaLookup,
  fragmentClass?: string
): CheckedDocument {
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
  const classed = asFragmentDocument(parsed, fragmentClass)
  const issues: SiiIssue[] = [
    ...parsed.issues,
    ...validateSiiDocument(parsed),
    // Only on an intact tree: with a structural issue, attributes may be
    // read in the wrong unit.
    ...(schemaFor && parsed.issues.length === 0
      ? [
          ...validateAttributeKeys(classed, schemaFor),
          ...validateEnumValues(classed, schemaFor),
          ...validateValueTypes(classed, schemaFor),
        ]
      : []),
  ].filter((issue) => enabledSeverities.includes(issue.severity ?? 'error'))

  return { parsed, normalizedDoc, classed, issues }
}

export function getDiagnostics(
  doc: TextDocument,
  enabledSeverities: SiiSeverity[] = DEFAULT_ENABLED_SEVERITIES,
  schemaFor?: SchemaLookup
): Diagnostic[] {
  return toDiagnostics(checkDocument(doc, enabledSeverities, schemaFor))
}

export function toDiagnostics({
  normalizedDoc,
  issues,
}: CheckedDocument): Diagnostic[] {
  return issues.map((issue) => ({
    severity: toDiagnosticSeverity(issue.severity),
    range: {
      start: normalizedDoc.positionAt(issue.range.start),
      end: normalizedDoc.positionAt(issue.range.end),
    },
    message: issue.message,
    code: issue.code,
    source: DIAGNOSTIC_SOURCE,
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
