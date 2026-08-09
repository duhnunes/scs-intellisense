import type { SchemaManifest } from '../interfaces/schemas'
import type { SiiDocument } from '../interfaces/structure'

/**
 * Returns the className of the unit whose classNameRange contains
 * `offset`, or undefined if the cursor isn't on a className token at all.
 *
 * Deliberately narrower than completion/className.ts's
 * isClassNamePosition(): that one also cares about positions where a NEW
 * className could be typed (blank lines, between units). Hover only
 * cares whether there's an EXISTING token directly under the cursor —
 * there's nothing to show a tooltip for on a blank line.
 */
export function findClassNameAtPosition(
  document: SiiDocument,
  offset: number
): string | undefined {
  for (const unit of document.units) {
    if (
      offset >= unit.classNameRange.start &&
      offset <= unit.classNameRange.end
    ) {
      return unit.className
    }
  }
  return undefined
}

export interface ClassNameHoverContent {
  markdown: string
}

/**
 * Builds the hover content straight from the manifest already in memory
 * — no fetch, same as completion. Returns undefined (no hover shown at
 * all) when the class isn't in the manifest: the database isn't fully
 * populated yet, so "not found" could mean a typo OR a legitimate class
 * that just hasn't been documented — there's no way to tell which, so
 * saying nothing is safer than guessing.
 */
export function buildClassNameHover(
  className: string,
  manifest: SchemaManifest | undefined
): ClassNameHoverContent | undefined {
  const entry = manifest?.schemas[className]
  if (!entry) return undefined

  const description = entry.description?.trim()

  return {
    markdown: description
      ? `**${entry.name}**\n\n${description}`
      : `**${entry.name}**\n\n*No description available yet.*`,
  }
}
