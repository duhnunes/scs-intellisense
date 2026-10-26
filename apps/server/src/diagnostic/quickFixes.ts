import type {
  SiiDocument,
  SiiIssue,
  SiiRange,
  SiiUnit,
} from '../interfaces/structure'
import {
  suggestAttributeKey,
  suggestEnumValue,
  type SchemaLookup,
} from './schemaRules'

export interface SiiTextEdit {
  range: SiiRange
  newText: string
}

export interface SiiQuickFix {
  title: string
  edits: SiiTextEdit[]
  /** The obvious fix when there's only one sensible way to solve the
   *  problem: VS Code applies it with "Auto Fix" (Shift+Alt+.). */
  isPreferred?: boolean
}

/**
 * The fixes offered for one issue, as offset edits into `document.text`
 * (the normalized text, like every other range). Keyed on `issue.code`,
 * never on the message.
 *
 * A fix is only offered where the right edit is certain from the text
 * alone. Problems with more than one plausible fix (where a missing '}'
 * goes, which of two duplicate units to rename) get none, and so does an
 * uppercase unit name: the game loads it, and other files may reference
 * the name as written.
 */
export function quickFixesFor(
  issue: SiiIssue,
  document: SiiDocument,
  schemaFor?: SchemaLookup
): SiiQuickFix[] {
  const text = document.text
  switch (issue.code) {
    case 'missing-final-newline':
      return [
        {
          title: 'Add a newline at the end of the file',
          edits: [insert(text.length, '\n')],
          isPreferred: true,
        },
      ]
    case 'include-not-at-line-start':
      return fixIncludePlacement(issue.range, text)
    case 'unit-name-empty-token':
      return fixEmptyToken(issue.range, document)
    case 'unit-name-unmatched-quote':
      return fixUnmatchedQuote(issue.range, document)
    case 'unclosed-value-quote':
      return fixUnclosedValueQuote(issue.range, text)
    case 'missing-unit-colon':
      return fixMissingUnitColon(issue.range.start, text)
    case 'missing-attribute-colon':
      return fixMissingAttributeColon(issue.range.start, text)
    case 'unknown-attribute':
      return fixUnknownAttribute(issue.range, document, schemaFor)
    case 'invalid-enum-value':
      return fixInvalidEnumValue(issue.range, document, schemaFor)
    default:
      return []
  }
}

/** The game ignores an `@include` that doesn't start its line. */
function fixIncludePlacement(range: SiiRange, text: string): SiiQuickFix[] {
  const lineStart = text.lastIndexOf('\n', range.start - 1) + 1
  const before = text.slice(lineStart, range.start)

  if (/^[ \t]*$/.test(before)) {
    return [
      {
        title: 'Move @include to the start of the line',
        edits: [replace(lineStart, range.start, '')],
        isPreferred: true,
      },
    ]
  }

  // Something else comes first on the line: break the line before the
  // @include, dropping the spaces that would be left trailing.
  let breakAt = range.start
  while (breakAt > lineStart && isHorizontalSpace(text[breakAt - 1])) breakAt--
  return [
    {
      title: 'Move @include to its own line',
      edits: [replace(breakAt, range.start, '\n')],
      isPreferred: true,
    },
  ]
}

/**
 * `a..b` → `a.b`. A run of dots at the end of the name is removed, and one
 * at the start keeps a single dot (the start of a nameless unit). The whole
 * run is replaced, so `a...b` is fixed in one step.
 */
function fixEmptyToken(range: SiiRange, document: SiiDocument): SiiQuickFix[] {
  const unit = unitWithNameAt(range, document)
  if (!unit) return []
  const text = document.text
  const { start: innerStart, end: innerEnd } = unquotedNameRange(unit, text)

  let start = range.start
  let end = range.end
  while (start > innerStart && text[start - 1] === '.') start--
  while (end < innerEnd && text[end] === '.') end++
  // Nothing but dots: there's no name left to keep.
  if (start === innerStart && end === innerEnd) return []

  const dots = text.slice(start, end)
  if (end === innerEnd) {
    return [
      {
        title: `Remove the trailing "${dots}"`,
        edits: [replace(start, end, '')],
        isPreferred: true,
      },
    ]
  }
  if (dots === '.') return []
  return [
    {
      title: `Replace "${dots}" with "."`,
      edits: [replace(start, end, '.')],
      isPreferred: true,
    },
  ]
}

/** A unit name with a quote on one side only: add the other one, or drop
 *  this one. Which was intended can't be known, so neither is preferred. */
function fixUnmatchedQuote(
  range: SiiRange,
  document: SiiDocument
): SiiQuickFix[] {
  const unit = unitWithNameAt(range, document)
  if (!unit) return []
  const { start, end } = unit.unitNameRange
  const opening = range.start === start

  return [
    {
      title: `Add the missing ${opening ? 'closing' : 'opening'} quote`,
      edits: [insert(opening ? end : start, '"')],
    },
    {
      title: 'Remove the quote',
      edits: [replace(range.start, range.start + 1, '')],
    },
  ]
}

/**
 * A value's quote that never closes: close it at the end of its line, or
 * remove it. Neither is preferred: the text may have been meant to end
 * earlier, or not be quoted at all. `range` is the unclosed text, from the
 * quote to the end of its line (trailing spaces left out).
 */
function fixUnclosedValueQuote(range: SiiRange, text: string): SiiQuickFix[] {
  const quote = text[range.start] ?? '"'
  return [
    {
      title: 'Close the quote at the end of the line',
      edits: [insert(range.end, quote)],
    },
    {
      title: 'Remove the quote',
      edits: [replace(range.start, range.start + 1, '')],
    },
  ]
}

/**
 * `prefab_model prefab.house {` → `prefab_model : prefab.house {`, and a
 * stray character in place of the ':' (`prefab_model ; prefab.house`) is
 * replaced by one. `start` is where the reader expected the ':'.
 */
function fixMissingUnitColon(start: number, text: string): SiiQuickFix[] {
  const current = text[start]
  if (current === undefined || current === '{' || /\s/.test(current)) return []

  if (/[A-Za-z0-9_."]/.test(current)) {
    // The unit name starts right here. Without a space before it, where
    // the class name ends is a guess (`truck.x` may be a typo of either).
    if (!isHorizontalSpace(text[start - 1])) return []
    return [
      {
        title: "Add ':' between the class name and the unit name",
        edits: [insert(start, ': ')],
        isPreferred: true,
      },
    ]
  }

  return [
    {
      title: `Replace "${current}" with ':'`,
      edits: [replace(start, start + 1, ':')],
      isPreferred: true,
    },
  ]
}

/**
 * `key value` → `key: value`, and `key = value` → `key: value` (the
 * format other config files use). `start` is where the reader expected
 * the ':', after any spaces following the key.
 */
function fixMissingAttributeColon(start: number, text: string): SiiQuickFix[] {
  const current = text[start]
  // The key is alone on its line (or closes the unit): there's no value to
  // separate from it, so it may not be an attribute at all.
  if (current === undefined || current === '\n' || current === '}') return []

  let keyEnd = start
  while (isHorizontalSpace(text[keyEnd - 1])) keyEnd--

  if (current === '=') {
    // `key = value` → `key: value`, the spacing the format uses.
    return [
      {
        title: "Replace '=' with ':'",
        edits: [replace(keyEnd, start + 1, ':')],
        isPreferred: true,
      },
    ]
  }

  return [
    {
      title: "Add ':' after the attribute key",
      edits: [insert(keyEnd, ':')],
      isPreferred: true,
    },
  ]
}

/** `spead: 10` → `speed: 10`, when one of the class's keys is a
 *  likely match (see suggestAttributeKey). */
function fixUnknownAttribute(
  range: SiiRange,
  document: SiiDocument,
  schemaFor: SchemaLookup | undefined
): SiiQuickFix[] {
  const unit = document.units.find(
    (candidate) =>
      candidate.bodyRange.start <= range.start &&
      range.end <= candidate.bodyRange.end
  )
  const schema = unit && schemaFor?.(unit.className)
  if (!schema) return []
  const typed = document.text.slice(range.start, range.end)
  const suggestion = suggestAttributeKey(typed, schema)
  if (!suggestion) return []
  return [
    {
      title: `Change to "${suggestion}"`,
      edits: [replace(range.start, range.end, suggestion)],
      isPreferred: true,
    },
  ]
}

function fixInvalidEnumValue(
  range: SiiRange,
  document: SiiDocument,
  schemaFor: SchemaLookup | undefined
): SiiQuickFix[] {
  const unit = document.units.find(
    (candidate) =>
      candidate.bodyRange.start <= range.start &&
      range.end <= candidate.bodyRange.end
  )
  const attribute = unit?.attributes.find(
    (candidate) =>
      candidate.valueRange.start <= range.start &&
      range.end <= candidate.valueRange.end
  )
  const values =
    attribute && schemaFor?.(unit!.className)?.key?.[attribute.key]?.values
  if (!Array.isArray(values)) return []
  const suggestion = suggestEnumValue(
    document.text.slice(range.start, range.end),
    values
  )
  if (!suggestion) return []
  return [
    {
      title: `Change to "${suggestion}"`,
      edits: [replace(range.start, range.end, suggestion)],
      isPreferred: true,
    },
  ]
}

function unitWithNameAt(
  range: SiiRange,
  document: SiiDocument
): SiiUnit | undefined {
  return document.units.find(
    (unit) =>
      unit.unitNameRange.start <= range.start &&
      range.end <= unit.unitNameRange.end
  )
}

/** The unit name without the quotes around it, if it has a pair. */
function unquotedNameRange(unit: SiiUnit, text: string): SiiRange {
  const { start, end } = unit.unitNameRange
  const quoted = end - start > 1 && text[start] === '"' && text[end - 1] === '"'
  return quoted ? { start: start + 1, end: end - 1 } : { start, end }
}

function insert(offset: number, newText: string): SiiTextEdit {
  return { range: { start: offset, end: offset }, newText }
}

function replace(start: number, end: number, newText: string): SiiTextEdit {
  return { range: { start, end }, newText }
}

function isHorizontalSpace(character: string | undefined): boolean {
  return character === ' ' || character === '\t'
}
