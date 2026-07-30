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
    issues.push(...validateUnit(unit))
  }
  return issues
}

function validateUnit(unit: SiiUnit): SiiIssue[] {
  const issues = validateClassName(unit.className, unit.classNameRange)

  // A zero-length unitNameRange means the reader never actually reached a
  // unitName for this unit (e.g. the ':' or the unitName itself was
  // missing) — the reader already reports that as a structural issue, so
  // there's nothing of substance here to run a business rule against.
  if (unit.unitNameRange.end > unit.unitNameRange.start) {
    issues.push(...validateUnitName(unit.unitName, unit.unitNameRange))
  }

  return issues
}

function validateClassName(
  className: string,
  classNameRange: SiiRange
): SiiIssue[] {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(className)) return []
  return [
    {
      message: `Invalid className: "${className}"`,
      range: classNameRange,
    },
  ]
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

    if (token.length === 0 && offset !== unitNameRange.start)
      issues.push({
        message: 'UnitName must not contain empty tokens (consecutive dots)',
        range: tokenRange,
      })

    offset += token.length + 1
  }

  return issues
}
