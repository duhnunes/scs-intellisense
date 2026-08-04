import type { SchemaManifest } from '../interfaces/schemas'
import type { SiiDocument } from '../interfaces/structure'

/**
 * Whether `offset` is a position where completing a `class_name` makes
 * sense — i.e. directly inside the SiiNunit root, not inside some unit's
 * body (that's attribute_key territory, not built yet) and not already
 * past the className into the unitName part of a header.
 *
 * Deliberately checks against the tree the reader already produced
 * rather than re-scanning text itself — same principle as
 * validation/rules.ts: this is a *consumer* of the parsed structure, not
 * another place that tokenizes.
 */
export function isClassNamePosition(
  document: SiiDocument,
  offset: number
): boolean {
  for (const unit of document.units) {
    // Already typing (or re-editing) this unit's className — even a
    // malformed one, since the reader reads className "raw" and only
    // validates it afterwards (see rules.ts). Being anywhere inside that
    // raw range, including right at its end (cursor right after the
    // last typed character), still counts as "typing the className".
    if (
      offset >= unit.classNameRange.start &&
      offset <= unit.classNameRange.end
    )
      return true

    // Inside this unit's body (attributes) — not className territory.
    if (isWithin(offset, unit.bodyRange)) return false

    // Between className and the opening '{' — could be the ':' itself
    // or the unitName. Neither one is a className completion position.
    if (isWithin(offset, unit.unitNameRange)) return false
    if (offset > unit.classNameRange.end && offset < unit.bodyRange.start)
      return false
  }

  // Not inside any unit's className/body/unitName — either a blank line
  // between units, or the very start of a new one. If we know the root
  // range (the reader found "SiiNunit { ... }"), only offer completions
  // strictly between that opening and closing brace.
  if (document.rootRange)
    return offset > document.rootRange.start && offset < document.rootRange.end

  return true
}

function isWithin(
  offset: number,
  range: { start: number; end: number }
): boolean {
  return offset >= range.start && offset <= range.end
}

export interface ClassNameCompletionItem {
  label: string
  detail: string
  documentation: string | undefined
}

/**
 * Builds completion items straight from the manifest already in memory —
 * no fetch, no CDN lookup. `scope`/`description` are exactly what the
 * manifest already carries per class.
 */
export function buildClassNameCompletionItems(
  manifest: SchemaManifest | undefined
): ClassNameCompletionItem[] {
  if (!manifest) return []

  return Object.values(manifest.schemas).map((entry) => ({
    label: entry.name,
    detail: entry.scope,
    documentation: entry.description || undefined,
  }))
}
