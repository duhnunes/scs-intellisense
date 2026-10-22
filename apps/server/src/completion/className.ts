import type { SchemaManifest, SchemaManifestEntry } from '../interfaces/schemas'
import type { SiiDocument } from '../interfaces/structure'

/**
 * Whether `offset` is a position where completing a `class_name` makes
 * sense — i.e. directly inside the SiiNunit root, not inside some unit's
 * body (that's attribute_key territory) and not already past the
 * className into the unitName part of a header.
 *
 * Deliberately checks against the tree the reader already produced
 * rather than re-scanning text itself — same principle as
 * diagnostic/rules.ts: this is a *consumer* of the parsed structure, not
 * another place that tokenizes.
 */
export function isClassNamePosition(
  document: SiiDocument,
  offset: number
): boolean {
  // A .sui made of bare attributes is a unit body fragment: what goes
  // there are attribute keys, never a new class.
  if (document.attributes.length > 0) return false

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
  /** The list order (VS Code sorts by this, then by label). */
  sortText: string
}

/**
 * Builds completion items straight from the manifest already in memory —
 * no fetch, no CDN lookup. Everything here (description, superclass,
 * documentationStatus) is exactly what the manifest already carries per
 * class.
 *
 * The manifest lists every class of the game (1,308 in ATS 1.61),
 * including save-game, editor and UI-handler classes a modder never
 * writes, so the order matters: documented classes first, then classes
 * the game's own files use (most used first), then the rest. VS Code
 * keeps this order among items that match what's typed equally well.
 */
export function buildClassNameCompletionItems(
  manifest: SchemaManifest | undefined
): ClassNameCompletionItem[] {
  if (!manifest) return []

  return Object.values(manifest.schemas).map((entry) => ({
    label: entry.name,
    detail: entry.superclass ? `extends ${entry.superclass}` : '',
    documentation: buildDocumentation(entry),
    sortText: classSortText(entry),
  }))
}

/** "0" documented, "1" used in the game's files, "2" the rest; within
 *  "1", more units first (the count, inverted and zero-padded, sorts as
 *  text). The name breaks ties. */
function classSortText(entry: SchemaManifestEntry): string {
  if (entry.documentationStatus !== 'undocumented') return `0_${entry.name}`
  const units =
    typeof entry.gameUnits === 'number' && entry.gameUnits > 0
      ? Math.floor(entry.gameUnits)
      : 0
  if (units === 0) return `2_${entry.name}`
  const inverted = String(Math.max(0, 999_999_999 - units)).padStart(9, '0')
  return `1_${inverted}_${entry.name}`
}

function buildDocumentation(entry: SchemaManifestEntry): string | undefined {
  const parts: string[] = []
  if (entry.description) parts.push(entry.description)
  if (entry.documentationStatus === 'wip') {
    parts.push('⚠️ Documentation for this class is still a work in progress.')
  }
  if (entry.documentationStatus === 'undocumented') {
    parts.push(
      'No description yet: only its attributes and their types are known.'
    )
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined
}
