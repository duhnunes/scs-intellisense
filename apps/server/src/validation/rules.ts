import type {
  SiiDocument,
  SiiIssue,
  SiiRange,
  SiiUnit,
} from '../interfaces/structure'

/**
 * Business-rule validation for a parsed SiiDocument.
 *
 * This is deliberately separate from `sii/reader.ts`. The reader's only job
 * is turning text into a tree with ranges (`classNameRange`, `unitNameRange`,
 * etc.) — it never decides whether a captured name is "allowed". These
 * rules run *after* the tree exists, reusing the ranges the reader already
 * resolved, so a rule can be added, changed, or unit-tested without ever
 * touching the parser/cursor logic (and without risking the brace-sync
 * issues that motivated pulling this out in the first place).
 */
export function validateSiiDocument(document: SiiDocument): SiiIssue[] {
  const issues: SiiIssue[] = []
  for (const unit of document.units) {
    issues.push(...validateUnit(unit, document.text))
  }
  for (const include of document.includes) {
    issues.push(...validateIncludePlacement(include.range, document.text))
  }
  return issues
}

function validateUnit(unit: SiiUnit, text: string): SiiIssue[] {
  const issues = validateClassName(unit.className, unit.classNameRange)

  // A zero-length unitNameRange means the reader never actually reached a
  // unitName for this unit (e.g. the ':' or the unitName itself was
  // missing) — the reader already reports that as a structural issue, so
  // there's nothing of substance here to run a business rule against.
  if (unit.unitNameRange.end > unit.unitNameRange.start) {
    issues.push(...validateUnitName(unit.unitName, unit.unitNameRange))
  }

  for (const attribute of unit.attributes) {
    if (attribute.kind === 'include') {
      issues.push(...validateIncludePlacement(attribute.range, text))
    }
  }

  return issues
}

function validateClassName(
  className: string,
  classNameRange: SiiRange
): SiiIssue[] {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(className)) return []

  const issues: SiiIssue[] = []

  // Point at each individual character that isn't allowed, instead of
  // underlining the whole identifier — "pref@b_model" should only flag
  // the "@", not "pref@b_model" in full.
  for (const match of className.matchAll(/[^A-Za-z0-9_]/g)) {
    if (match.index === undefined) continue
    issues.push({
      message: `Invalid character in className: "${match[0]}"`,
      range: {
        start: classNameRange.start + match.index,
        end: classNameRange.start + match.index + 1,
      },
    })
  }

  // A leading digit is a separate problem from "disallowed character" —
  // digits ARE allowed in a className, just not as the first character.
  if (/^[0-9]/.test(className)) {
    issues.push({
      message: 'className must not start with a digit',
      range: {
        start: classNameRange.start,
        end: classNameRange.start + 1,
      },
    })
  }

  return issues
}

function validateUnitName(
  unitName: string,
  unitNameRange: SiiRange
): SiiIssue[] {
  const issues: SiiIssue[] = []
  let offset = unitNameRange.start

  for (const token of unitName.split('.')) {
    const tokenRange: SiiRange = { start: offset, end: offset + token.length }

    if (token.length > 12)
      issues.push({
        message: `UnitName token exceeds 12 characters: "${token}"`,
        range: tokenRange,
      })

    if (!/^[a-z0-9_]*$/.test(token))
      issues.push({
        message: /[A-Z]/.test(token)
          ? `UnitName token contains uppercase letters: "${token}"`
          : `UnitName token contains invalid characters: "${token}"`,
        range: tokenRange,
      })

    if (token.length === 0 && offset !== unitNameRange.start) {
      // A zero-length range has nothing for an editor to underline, so it
      // falls back to highlighting whatever token happens to be nearby.
      // Point at the actual redundant dot(s) instead — the '.' that ended
      // the previous token through the '.' that starts the next one.
      const dotsRange: SiiRange = {
        start: offset - 1,
        end: Math.min(offset + 1, unitNameRange.end),
      }
      issues.push({
        message: 'UnitName must not contain empty tokens (consecutive dots)',
        range: dotsRange,
      })
    }

    offset += token.length + 1
  }

  return issues
}

/**
 * Per the SCS docs, `@include` must appear at the very start of a new line
 * with no whitespace before it — indenting it, or writing it after other
 * content on the same line, silently fails to include anything in-game.
 * Covers both the top-level `@include` (SiiInclude) and the in-body one
 * (an SiiAttribute with kind 'include') since both share this rule.
 */
function validateIncludePlacement(
  includeRange: SiiRange,
  text: string
): SiiIssue[] {
  const before = includeRange.start > 0 ? text[includeRange.start - 1] : '\n'
  if (before === '\n') return []
  return [
    {
      message:
        '@include must be at the start of a new line with no leading whitespace',
      range: includeRange,
    },
  ]
}
