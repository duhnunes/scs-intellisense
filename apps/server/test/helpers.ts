import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readScsDocument } from '../src/sii'
import { validateSiiDocument } from '../src/diagnostic/rules'
import type { SiiDocument, SiiSeverity } from '../src/interfaces/structure'

/** Wraps unit definitions in a SiiNunit root, with a trailing newline. */
export function sii(body: string): string {
  return `SiiNunit\n{\n${body}\n}\n`
}

export function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8')
}

export interface FoundIssue {
  severity: SiiSeverity
  message: string
  /** The text the issue underlines, so tests read as "what gets flagged". */
  text: string
}

/** Structural issues from the reader plus business-rule issues, the same
 *  merge that diagnostic/index.ts does, but without LSP positions. */
export function diagnose(
  input: string,
  mode: 'sii' | 'sui' = 'sii'
): FoundIssue[] {
  const document = readScsDocument(input, mode)
  return issuesOf(document)
}

export function issuesOf(document: SiiDocument): FoundIssue[] {
  return [...document.issues, ...validateSiiDocument(document)].map(
    (issue) => ({
      severity: issue.severity ?? 'error',
      message: issue.message,
      text: document.text.slice(issue.range.start, issue.range.end),
    })
  )
}

/** Only errors and warnings: hints are expected on real game files. */
export function problems(input: string, mode: 'sii' | 'sui' = 'sii') {
  return diagnose(input, mode).filter(
    (issue) => issue.severity === 'error' || issue.severity === 'warning'
  )
}
