import type { SchemaFileContent } from '../interfaces/schemas'
import type { SiiDocument, SiiIssue } from '../interfaces/structure'

/** A class's schema, already loaded, or undefined when it isn't (class
 *  not in the manifest, or its file not fetched yet). */
export type SchemaLookup = (className: string) => SchemaFileContent | undefined

/**
 * Rules that need the schema database. Kept apart from rules.ts, which
 * only knows the file's own text: these depend on data that may not be
 * loaded yet, so the server runs them once the class files are in.
 *
 * Since scs-schema v3 the attribute list of every class comes from the
 * game itself, not the wiki, so a key that isn't in it is almost always a
 * typo. Still a warning, not an error: the game may accept keys the data
 * doesn't list yet.
 */
export function validateAttributeKeys(
  document: SiiDocument,
  schemaFor: SchemaLookup
): SiiIssue[] {
  const issues: SiiIssue[] = []
  for (const unit of document.units) {
    const schema = schemaFor(unit.className)
    if (!schema?.key || typeof schema.key !== 'object') continue

    for (const attribute of unit.attributes) {
      if (attribute.kind !== 'attribute') continue
      if (Object.hasOwn(schema.key, attribute.key)) continue
      const start = attribute.keyRange.start
      issues.push({
        code: 'unknown-attribute',
        message: `Unknown attribute "${attribute.key}" for ${unit.className}`,
        // The name only, not "[2]" after it.
        range: { start, end: start + attribute.key.length },
        severity: 'warning',
      })
    }
  }
  return issues
}

/**
 * The key `typed` most likely meant: the closest of the class's keys by
 * edit distance (a swap of two letters counts as one edit), when it's
 * close enough to be a typo and no other key is as close. Keys a modder
 * shouldn't write (legacy, internal-only) are only used when nothing
 * else matches.
 */
export function suggestAttributeKey(
  typed: string,
  schema: SchemaFileContent
): string | undefined {
  const limit = typed.length <= 4 ? 1 : typed.length <= 10 ? 2 : 3
  const preferred: string[] = []
  const others: string[] = []
  for (const [key, def] of Object.entries(schema.key ?? {})) {
    if (def?.status === 'legacy' || def?.internalOnly) others.push(key)
    else preferred.push(key)
  }
  return closest(typed, preferred, limit) ?? closest(typed, others, limit)
}

function closest(
  typed: string,
  candidates: string[],
  limit: number
): string | undefined {
  let best: string | undefined
  let bestDistance = limit + 1
  let tied = false
  const lowered = typed.toLowerCase()
  for (const candidate of candidates) {
    const distance = editDistance(lowered, candidate.toLowerCase())
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
      tied = false
    } else if (distance === bestDistance) {
      tied = true
    }
  }
  // Two keys equally close: picking one would be a guess.
  return best !== undefined && !tied ? best : undefined
}

/** Optimal string alignment distance: insertions, deletions,
 *  substitutions and swaps of adjacent characters each cost 1. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return Infinity
  const rows: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    rows.push([i])
    for (let j = 1; j <= b.length; j++) rows[i]![j] = i === 0 ? j : 0
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, rows[i - 2]![j - 2]! + 1)
      rows[i]![j] = value
    }
  }
  return rows[a.length]![b.length]!
}
