import type {
  SiiAttribute,
  SiiComment,
  SiiDocument,
  SiiInclude,
  SiiRange,
  SiiUnit,
} from '../interfaces/structure'

export interface FormatterOptions {
  braceStyle: '1tbs' | 'allman'
  indentSize: number
}

const DEFAULT_OPTIONS: FormatterOptions = {
  braceStyle: '1tbs',
  indentSize: 2,
}

/**
 * Reformats a parsed SiiDocument back into text — indentation, brace
 * style, spacing around ':', @include normalization, blank-line
 * collapsing, and a final trailing newline.
 *
 * Deliberately does NOT touch value content: whatever a key's value
 * range contains is copied verbatim, never reformatted. That's tied to
 * the type/array system that's still being figured out (see
 * CONTRIBUTING.md in scs-schema) — reformatting values without
 * understanding their type would be guessing, not formatting.
 *
 * Walks the document strictly by *position* rather than by
 * units -> attributes: units, top-level includes, attributes, and
 * comments are all merged into one ordered list per nesting level, so
 * a comment can never be silently dropped just because it isn't part
 * of the parser's structural tree. Every piece of real content (class
 * name, unit name, attribute key/value, include path, comment text) is
 * a direct substring of the original text — never reconstructed from
 * parsed fields — which is what keeps this safe against corrupting
 * content while still fixing everything around it.
 */
export function formatSiiDocument(
  document: SiiDocument,
  options: Partial<FormatterOptions> = {}
): string {
  const opts: FormatterOptions = { ...DEFAULT_OPTIONS, ...options }
  const indentUnit = ' '.repeat(opts.indentSize)
  const lines: string[] = []

  const topLevelNodes = collectNodes(
    document.units,
    document.includes,
    document.attributes,
    topLevelComments(document)
  )

  // A .sui is a fragment pasted into another file by @include (into the
  // SiiNunit root, or into a unit body when it holds bare attributes), so
  // it must never gain a wrapper of its own.
  if (document.mode === 'sui') {
    emitNodeList(topLevelNodes, 0, document, opts, indentUnit, lines)
    return lines.join('\n') + '\n'
  }

  emitBraceOpener('SiiNunit', 0, opts, indentUnit, lines)
  emitNodeList(topLevelNodes, 1, document, opts, indentUnit, lines)
  lines.push('}')
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------
// Node model: everything at one nesting level (top-level, or one unit's
// body) gets merged into this single ordered list, sorted by position.
// ---------------------------------------------------------------------

type Node =
  | { kind: 'unit'; start: number; end: number; unit: SiiUnit }
  | { kind: 'include'; start: number; end: number; include: SiiInclude }
  | { kind: 'attribute'; start: number; end: number; attribute: SiiAttribute }
  | { kind: 'comment'; start: number; end: number; comment: SiiComment }

function collectNodes(
  units: SiiUnit[],
  includes: SiiInclude[],
  attributes: SiiAttribute[],
  comments: SiiComment[]
): Node[] {
  const nodes: Node[] = [
    ...units.map(
      (unit): Node => ({
        kind: 'unit',
        start: unit.range.start,
        end: unit.range.end,
        unit,
      })
    ),
    ...includes.map(
      (include): Node => ({
        kind: 'include',
        start: include.range.start,
        end: include.range.end,
        include,
      })
    ),
    ...attributes.map(
      (attribute): Node => ({
        kind: 'attribute',
        start: attribute.range.start,
        end: attribute.range.end,
        attribute,
      })
    ),
    ...comments.map(
      (comment): Node => ({
        kind: 'comment',
        start: comment.range.start,
        end: comment.range.end,
        comment,
      })
    ),
  ]
  nodes.sort((a, b) => a.start - b.start)
  return nodes
}

function isWithin(offset: number, range: SiiRange): boolean {
  return offset >= range.start && offset <= range.end
}

function topLevelComments(document: SiiDocument): SiiComment[] {
  return document.comments.filter(
    (comment) =>
      !document.units.some(
        (unit) =>
          isWithin(comment.range.start, unit.bodyRange) ||
          isHeaderComment(comment, unit)
      )
  )
}

/** A comment between the unit name and the opening '{', as in the
 *  game's own `light_source : highway.tunnel.light #omni` + `{` on the
 *  next line. It belongs to the header, not after the unit. */
function isHeaderComment(comment: SiiComment, unit: SiiUnit): boolean {
  return (
    comment.range.start > unit.classNameRange.start &&
    comment.range.start < unit.bodyRange.start - 1
  )
}

function bodyComments(unit: SiiUnit, document: SiiDocument): SiiComment[] {
  return document.comments.filter(
    (comment) =>
      isWithin(comment.range.start, unit.bodyRange) &&
      !isBraceLineComment(comment, unit, document)
  )
}

/** A comment right after the opening '{', on the same line and before
 *  any attribute (`a : b { #note`). It stays on the brace's line —
 *  that's also where 1tbs puts a header comment, so without this a
 *  second format would move it again. */
function isBraceLineComment(
  comment: SiiComment,
  unit: SiiUnit,
  document: SiiDocument
): boolean {
  const firstAttribute = unit.attributes[0]
  return (
    isWithin(comment.range.start, unit.bodyRange) &&
    !document.text
      .slice(unit.bodyRange.start, comment.range.start)
      .includes('\n') &&
    (!firstAttribute || firstAttribute.range.start > comment.range.start)
  )
}

// ---------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------

function emitNodeList(
  nodes: Node[],
  depth: number,
  document: SiiDocument,
  opts: FormatterOptions,
  indentUnit: string,
  lines: string[]
): void {
  let previousEnd: number | undefined

  for (const node of nodes) {
    const gap =
      previousEnd !== undefined
        ? document.text.slice(previousEnd, node.start)
        : undefined

    // A comment that started on the same line as whatever came right
    // before it (`key: value # note`, `} # end`) is a trailing comment:
    // keep it on that line instead of dropping it onto its own line.
    if (
      node.kind === 'comment' &&
      gap !== undefined &&
      countNewlines(gap) === 0 &&
      lines.length > 0
    ) {
      lines[lines.length - 1] +=
        ` ${document.text.slice(node.comment.range.start, node.comment.range.end)}`
      previousEnd = node.end
      continue
    }

    if (gap !== undefined && countNewlines(gap) >= 2) {
      // At most one blank line preserved between consecutive items,
      // however many the original had.
      lines.push('')
    }

    switch (node.kind) {
      case 'unit':
        emitUnit(node.unit, depth, document, opts, indentUnit, lines)
        break
      case 'include':
        emitInclude(node.include.valueRange, document, lines)
        break
      case 'attribute':
        emitAttribute(node.attribute, depth, document, indentUnit, lines)
        break
      case 'comment':
        emitComment(node.comment, depth, document, indentUnit, lines)
        break
    }

    previousEnd = node.end
  }
}

function countNewlines(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') count++
  return count
}

function emitBraceOpener(
  header: string,
  depth: number,
  opts: FormatterOptions,
  indentUnit: string,
  lines: string[]
): void {
  const indent = indentUnit.repeat(depth)
  if (opts.braceStyle === '1tbs') {
    lines.push(`${indent}${header} {`)
  } else {
    lines.push(`${indent}${header}`)
    lines.push(`${indent}{`)
  }
}

function emitUnit(
  unit: SiiUnit,
  depth: number,
  document: SiiDocument,
  opts: FormatterOptions,
  indentUnit: string,
  lines: string[]
): void {
  const classNameText = document.text.slice(
    unit.classNameRange.start,
    unit.classNameRange.end
  )
  const hasUnitName = unit.unitNameRange.end > unit.unitNameRange.start
  const header = hasUnitName
    ? `${classNameText} : ${document.text.slice(unit.unitNameRange.start, unit.unitNameRange.end)}`
    : classNameText

  const commentText = (comment: SiiComment) =>
    document.text.slice(comment.range.start, comment.range.end)
  const headerComments = document.comments
    .filter((comment) => isHeaderComment(comment, unit))
    .map(commentText)
  const braceLineComments = document.comments
    .filter((comment) => isBraceLineComment(comment, unit, document))
    .map(commentText)

  if (headerComments.length === 0 && braceLineComments.length === 0) {
    emitBraceOpener(header, depth, opts, indentUnit, lines)
  } else {
    // In 1tbs header comments go after the '{': before it, a line
    // comment would swallow the brace.
    const indent = indentUnit.repeat(depth)
    const withComments = (text: string, comments: string[]) =>
      comments.length > 0 ? `${text} ${comments.join(' ')}` : text
    if (opts.braceStyle === '1tbs') {
      lines.push(
        withComments(`${indent}${header} {`, [
          ...headerComments,
          ...braceLineComments,
        ])
      )
    } else {
      lines.push(withComments(`${indent}${header}`, headerComments))
      lines.push(withComments(`${indent}{`, braceLineComments))
    }
  }

  const bodyNodes = collectNodes(
    [],
    [],
    unit.attributes,
    bodyComments(unit, document)
  )
  emitNodeList(bodyNodes, depth + 1, document, opts, indentUnit, lines)

  lines.push(`${indentUnit.repeat(depth)}}`)
}

function emitAttribute(
  attribute: SiiAttribute,
  depth: number,
  document: SiiDocument,
  indentUnit: string,
  lines: string[]
): void {
  if (attribute.kind === 'include') {
    emitInclude(attribute.valueRange, document, lines)
    return
  }

  const indent = indentUnit.repeat(depth)
  const keyText = document.text.slice(
    attribute.keyRange.start,
    attribute.keyRange.end
  )
  const valueText = document.text.slice(
    attribute.valueRange.start,
    attribute.valueRange.end
  )
  lines.push(`${indent}${keyText}: ${valueText}`)
}

function emitInclude(
  valueRange: SiiRange,
  document: SiiDocument,
  lines: string[]
): void {
  const value = document.text.slice(valueRange.start, valueRange.end)
  // The SCS docs require @include at the very start of its line, with
  // no whitespace before it (diagnostic/rules.ts enforces the same
  // rule). Unlike everything else here it deliberately ignores the
  // nesting depth — indenting it would make the formatter produce
  // exactly the error the diagnostic then reports.
  lines.push(`@include ${value}`)
}

function emitComment(
  comment: SiiComment,
  depth: number,
  document: SiiDocument,
  indentUnit: string,
  lines: string[]
): void {
  const indent = indentUnit.repeat(depth)
  const text = document.text.slice(comment.range.start, comment.range.end)
  // A multi-line block comment's internal line breaks/indentation are
  // left exactly as authored — only the first line gets re-indented.
  // Reformatting the inside of a comment risks mangling intentional
  // formatting (e.g. ASCII art) for no real benefit.
  lines.push(`${indent}${text}`)
}
