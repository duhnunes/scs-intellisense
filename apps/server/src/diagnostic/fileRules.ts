import path from 'node:path'
import type { SiiDocument, SiiIssue, SiiRange } from '../interfaces/structure'

export type FileExists = (filePath: string) => boolean

/**
 * Rules that look at the disk, not only the text: kept apart from
 * rules.ts, which only knows the file's own text, and run only for a file
 * that is on disk.
 *
 * A relative `@include` names a file next to the including one or below
 * it (2,712 of the 2,814 in ATS 1.61, none with "../"), so it must be in
 * the mod: if it isn't there, the unit misses what the fragment holds. A
 * "/" path may be one of the game's files, which aren't on disk, so it's
 * never reported. An error: what the game does with a missing include is
 * unconfirmed, but the file can't be what the modder meant.
 */
export function validateIncludeTargets(
  document: SiiDocument,
  filePath: string,
  exists: FileExists
): SiiIssue[] {
  const ranges: SiiRange[] = [
    ...document.includes.map((include) => include.valueRange),
    ...[
      ...document.attributes,
      ...document.units.flatMap((unit) => unit.attributes),
    ]
      .filter((attribute) => attribute.kind === 'include')
      .map((attribute) => attribute.valueRange),
  ]

  const issues: SiiIssue[] = []
  for (const valueRange of ranges) {
    const range = inner(document.text, valueRange)
    const included = document.text.slice(range.start, range.end)
    if (included === '' || included.startsWith('/')) continue
    if (exists(path.join(path.dirname(filePath), included))) continue
    issues.push({
      code: 'include-not-found',
      message: `Included file not found: "${included}" (looked in ${path.basename(path.dirname(filePath))}/)`,
      range,
    })
  }
  return issues
}

function inner(text: string, range: SiiRange): SiiRange {
  return range.end - range.start >= 2 &&
    text[range.start] === '"' &&
    text[range.end - 1] === '"'
    ? { start: range.start + 1, end: range.end - 1 }
    : range
}
