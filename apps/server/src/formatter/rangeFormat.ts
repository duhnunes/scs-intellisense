import { readScsDocument } from '../sii'
import type { SiiRange } from '../interfaces/structure'
import { formatSiiRange, type FormatterOptions } from './format'
import { keepsContent, lineAt, type FormatCheckResult } from './workspaceFormat'

export type FormatRangeResult =
  | Exclude<FormatCheckResult, { status: 'changed' }>
  | {
      status: 'changed'
      /** One edit, as offsets into the normalized text. */
      edit: { range: SiiRange; newText: string }
    }

/**
 * Format Selection, with the same rules as Format Document: nothing
 * happens in a file with structural issues, and the result must pass the
 * same safety check (only whitespace changed).
 */
export function formatRange(
  text: string,
  mode: 'sii' | 'sui',
  range: SiiRange,
  options: Partial<FormatterOptions> = {}
): FormatRangeResult {
  const parsed = readScsDocument(text, mode)

  const firstIssue = parsed.issues[0]
  if (firstIssue) {
    return {
      status: 'skipped',
      reason: 'structural',
      line: lineAt(parsed.text, firstIssue.range.start),
      message: firstIssue.message,
    }
  }

  const formatted = formatSiiRange(parsed, range, options)
  if (!formatted) return { status: 'unchanged' }

  const before = parsed.text
  const after =
    before.slice(0, formatted.range.start) +
    formatted.newText +
    before.slice(formatted.range.end)
  if (after === before) return { status: 'unchanged' }
  if (!keepsContent(parsed, after))
    return { status: 'skipped', reason: 'contentMismatch' }

  return { status: 'changed', edit: minimalEdit(before, after) }
}

/** The single edit that turns `before` into `after`: everything between
 *  their common start and common end, so lines the formatting didn't
 *  actually change aren't replaced. */
function minimalEdit(
  before: string,
  after: string
): { range: SiiRange; newText: string } {
  const shorter = Math.min(before.length, after.length)
  let prefix = 0
  while (prefix < shorter && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shorter - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  return {
    range: { start: prefix, end: before.length - suffix },
    newText: after.slice(prefix, after.length - suffix),
  }
}
