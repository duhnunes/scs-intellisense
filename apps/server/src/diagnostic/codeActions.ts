import {
  CodeActionKind,
  type CodeAction,
  type CodeActionParams,
  type Diagnostic,
  type TextEdit,
} from 'vscode-languageserver/node'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { SiiIssue, SiiSeverity } from '../interfaces/structure'
import { checkDocument, DIAGNOSTIC_SOURCE } from './index'
import { quickFixesFor } from './quickFixes'
import type { SchemaLookup } from './schemaRules'

/**
 * The light bulb: quick fixes for the issues under the cursor or selection.
 *
 * The document is checked again instead of trusting the diagnostics VS
 * Code sends back: a fix needs the tree, and recomputing guarantees the
 * edit offsets match the text as it is right now.
 */
export function buildCodeActions(
  doc: TextDocument,
  params: CodeActionParams,
  enabledSeverities: SiiSeverity[],
  schemaFor?: SchemaLookup
): CodeAction[] {
  const only = params.context.only
  if (only && !only.some((kind) => CodeActionKind.QuickFix.startsWith(kind)))
    return []

  const { parsed, normalizedDoc, issues } = checkDocument(
    doc,
    enabledSeverities,
    schemaFor
  )
  const start = normalizedDoc.offsetAt(params.range.start)
  const end = normalizedDoc.offsetAt(params.range.end)
  // Inserted line breaks follow the file's own (the tree is LF-only).
  const eol = doc.getText().includes('\r\n') ? '\r\n' : '\n'

  const actions: CodeAction[] = []
  const seen = new Set<string>()

  for (const issue of issues) {
    if (!touches(issue, start, end)) continue

    for (const fix of quickFixesFor(issue, parsed, schemaFor)) {
      const edits: TextEdit[] = fix.edits.map((edit) => ({
        range: {
          start: normalizedDoc.positionAt(edit.range.start),
          end: normalizedDoc.positionAt(edit.range.end),
        },
        newText: edit.newText.replace(/\n/g, eol),
      }))

      // Several issues can share one fix ("a...b" reports both empty
      // tokens, and both are fixed by the same edit): offer it once.
      const key = JSON.stringify([fix.title, edits])
      if (seen.has(key)) continue
      seen.add(key)

      const diagnostic = matchingDiagnostic(issue, params, normalizedDoc)
      actions.push({
        title: fix.title,
        kind: CodeActionKind.QuickFix,
        ...(diagnostic ? { diagnostics: [diagnostic] } : {}),
        ...(fix.isPreferred ? { isPreferred: true } : {}),
        edit: { changes: { [doc.uri]: edits } },
      })
    }
  }

  return actions
}

/** An empty selection (the cursor) touching either end of an issue counts,
 *  the same way VS Code shows the light bulb at the end of a squiggle. */
function touches(issue: SiiIssue, start: number, end: number): boolean {
  return issue.range.start <= end && start <= issue.range.end
}

/** The diagnostic VS Code is showing for this issue, so the fix is listed
 *  under it in the Problems panel's own light bulb. */
function matchingDiagnostic(
  issue: SiiIssue,
  params: CodeActionParams,
  normalizedDoc: TextDocument
): Diagnostic | undefined {
  const start = normalizedDoc.positionAt(issue.range.start)
  const end = normalizedDoc.positionAt(issue.range.end)
  return params.context.diagnostics.find(
    (diagnostic) =>
      diagnostic.source === DIAGNOSTIC_SOURCE &&
      diagnostic.code === issue.code &&
      diagnostic.range.start.line === start.line &&
      diagnostic.range.start.character === start.character &&
      diagnostic.range.end.line === end.line &&
      diagnostic.range.end.character === end.character
  )
}
