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
 *
 * Every rule below is a certainty ("this fails to load"), not a judgment
 * call — that's why none of them set `severity` on the SiiIssue they
 * return (it defaults to 'error', see interfaces/structure.ts). A future
 * rule that's closer to "this is unusual, but I'm not certain it's wrong"
 * — e.g. an attribute_key that doesn't exist on the class's schema —
 * should set `severity: 'warning'` instead. That's the only change
 * needed; diagnostic/index.ts already maps it to the right
 * DiagnosticSeverity automatically.
 */
export function validateSiiDocument(document: SiiDocument): SiiIssue[] {
  const issues: SiiIssue[] = []
  for (const unit of document.units) {
    issues.push(...validateUnit(unit, document.text))
  }
  for (const include of document.includes) {
    issues.push(...validateIncludePlacement(include.range, document.text))
  }
  issues.push(...validateDuplicateUnitNames(document.units))
  issues.push(...validateTrailingNewline(document.text))
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

/**
 * A className is an identifier, optionally prefixed by namespaces joined
 * with "::" (`ui::text`, `hcd::on_job` in the game's own files — the wiki
 * doesn't document namespaces at all). Every "::"-separated part follows
 * the same identifier rules.
 */
function validateClassName(
  className: string,
  classNameRange: SiiRange
): SiiIssue[] {
  const issues: SiiIssue[] = []
  let offset = classNameRange.start

  for (const part of className.split('::')) {
    issues.push(...validateClassNamePart(part, offset, classNameRange))
    offset += part.length + 2
  }

  return issues
}

function validateClassNamePart(
  part: string,
  start: number,
  classNameRange: SiiRange
): SiiIssue[] {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) return []

  if (part.length === 0) {
    // Same reasoning as empty unitName tokens: a zero-length range has
    // nothing to underline, so point at the "::" next to the gap.
    const separatorStart = start + 2 <= classNameRange.end ? start : start - 2
    return [
      {
        code: 'class-name-empty-part',
        message: 'className must not have an empty part around "::"',
        range: { start: separatorStart, end: separatorStart + 2 },
      },
    ]
  }

  const issues: SiiIssue[] = []

  // Point at each individual character that isn't allowed, instead of
  // underlining the whole identifier — "pref@b_model" should only flag
  // the "@", not "pref@b_model" in full.
  for (const match of part.matchAll(/[^A-Za-z0-9_]/g)) {
    if (match.index === undefined) continue
    issues.push({
      code: 'class-name-invalid-character',
      message: `Invalid character in className: "${match[0]}"`,
      range: {
        start: start + match.index,
        end: start + match.index + 1,
      },
    })
  }

  // A leading digit is a separate problem from "disallowed character" —
  // digits ARE allowed in a className, just not as the first character.
  if (/^[0-9]/.test(part)) {
    issues.push({
      code: 'class-name-leading-digit',
      message: 'className must not start with a digit',
      range: { start, end: start + 1 },
    })
  }

  return issues
}

/**
 * The wiki defines a unit name token as lowercase letters, digits and
 * "_" only, at most 12 characters. The length and character rules have
 * held up against every game file checked, but the lowercase part has
 * not: the game's own files use uppercase in unit names that load fine
 * (mover.allflags.sii has "mover.flagUSsmaSi", and default_gfx_setup.sii
 * has "_nameless.NVIDIA.GeForce.GT.220"). So uppercase is reported as a
 * hint — it contradicts the docs, but it isn't evidence that loading
 * fails — while every other violation stays an error.
 *
 * The game's files also wrap some unit names in one pair of double quotes
 * (default_input_setup.sii has `default_input_config:
 * "icfg.steering.configured"`). The wiki doesn't mention this, so the
 * quotes are accepted and the token rules run on what's inside them.
 */
function validateUnitName(
  unitName: string,
  unitNameRange: SiiRange
): SiiIssue[] {
  const issues: SiiIssue[] = []
  const opensQuoted = unitName.startsWith('"')
  const closesQuoted = unitName.length > 1 && unitName.endsWith('"')

  if (opensQuoted !== closesQuoted) {
    const quoteOffset = opensQuoted
      ? unitNameRange.start
      : unitNameRange.end - 1
    issues.push({
      code: 'unit-name-unmatched-quote',
      message: 'Unmatched double quote in unitName',
      range: { start: quoteOffset, end: quoteOffset + 1 },
    })
  }

  const innerStart = unitNameRange.start + (opensQuoted ? 1 : 0)
  const inner = unitName.slice(
    opensQuoted ? 1 : 0,
    closesQuoted ? -1 : undefined
  )

  if (opensQuoted && closesQuoted && inner.length === 0) {
    issues.push({
      code: 'unit-name-empty',
      message: 'UnitName must not be empty',
      range: unitNameRange,
    })
    return issues
  }

  const innerEnd = innerStart + inner.length
  let offset = innerStart

  for (const token of inner.split('.')) {
    const tokenRange: SiiRange = { start: offset, end: offset + token.length }

    if (token.length > 12)
      issues.push({
        code: 'unit-name-token-too-long',
        message: `UnitName token exceeds 12 characters: "${token}"`,
        range: tokenRange,
      })

    if (!/^[A-Za-z0-9_]*$/.test(token))
      issues.push({
        code: 'unit-name-invalid-character',
        message: `UnitName token contains invalid characters: "${token}"`,
        range: tokenRange,
      })

    if (/[A-Z]/.test(token))
      issues.push({
        code: 'unit-name-uppercase',
        message: `UnitName token contains uppercase letters: "${token}" (the docs specify lowercase, but some game files use uppercase here)`,
        range: tokenRange,
        severity: 'hint',
      })

    if (token.length === 0 && offset !== innerStart) {
      // A zero-length range has nothing for an editor to underline, so it
      // falls back to highlighting whatever token happens to be nearby.
      // Point at the actual redundant dot(s) instead — the '.' that ended
      // the previous token through the '.' that starts the next one.
      const dotsRange: SiiRange = {
        start: offset - 1,
        end: Math.min(offset + 1, innerEnd),
      }
      issues.push({
        code: 'unit-name-empty-token',
        message: 'UnitName must not contain empty tokens (consecutive dots)',
        range: dotsRange,
      })
    }

    offset += token.length + 1
  }

  return issues
}

/**
 * Per the SCS docs, two units sharing the same name make the whole mod
 * fail to load ("if some mod is using name vehicle.dummy.truck and you
 * also use this, your mod will fail to load"). This can only catch
 * collisions between units visible right here in the same file — it has
 * no way to know about a name already used by another file or another
 * mod (that would need the workspace-wide index that's still future
 * work), but a same-file duplicate is a mistake either way.
 *
 * Nameless units (unitName starting with '.') are checked too. They only
 * exist within the SiiNunit that declares them, so they can't collide
 * with other files or mods, but the docs are explicit that "nameless
 * units within an SiiNunit must have unique names within that scope"
 * (Documentation/Engine/Units/transmission_names).
 *
 * Names are compared as written, so "a.b" and a.b are not reported as
 * duplicates of each other: nobody has confirmed yet whether the game
 * treats them as the same name.
 */
function validateDuplicateUnitNames(units: SiiUnit[]): SiiIssue[] {
  const unitsByName = new Map<string, SiiUnit[]>()

  for (const unit of units) {
    const name = unit.unitName
    if (!name) continue
    // A zero-length unitNameRange means the reader never actually reached
    // a unitName for this unit — already reported as a structural issue,
    // nothing to compare here.
    if (unit.unitNameRange.end <= unit.unitNameRange.start) continue

    const group = unitsByName.get(name)
    if (group) group.push(unit)
    else unitsByName.set(name, [unit])
  }

  const issues: SiiIssue[] = []
  for (const [name, group] of unitsByName) {
    if (group.length < 2) continue
    for (const unit of group) {
      issues.push({
        code: 'duplicate-unit-name',
        message: `Duplicate unit name ${name.startsWith('"') ? name : `"${name}"`} — used by ${group.length} units in this file`,
        range: unit.unitNameRange,
      })
    }
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
      code: 'include-not-at-line-start',
      message:
        '@include must be at the start of a new line with no leading whitespace',
      range: includeRange,
    },
  ]
}

/**
 * Per the SCS docs: "It's always good to add one blank line at the end
 * of file." Unlike everything else in this file, this doesn't break
 * loading — it's a recommendation, not a requirement — so this is the
 * first rule that actually sets `severity: 'warning'` instead of
 * relying on the 'error' default.
 */
function validateTrailingNewline(text: string): SiiIssue[] {
  if (text.length === 0 || text.endsWith('\n')) return []

  return [
    {
      code: 'missing-final-newline',
      message: 'File should end with a blank line, per SCS conventions',
      // A zero-length range at the very end has nothing for an editor
      // to underline (same reasoning as the empty-unitName-token fix)
      // — point at the last real character instead.
      range: { start: text.length - 1, end: text.length },
      severity: 'warning',
    },
  ]
}
