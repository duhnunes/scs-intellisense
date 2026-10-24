import path from 'node:path'
import type { SiiDocument, SiiRange } from '../interfaces/structure'
import { findPathRoots, listFolder, relativeBases } from './modFiles'

/**
 * Completion of the path in `@include "..."`.
 *
 * How the game resolves these, measured on every @include of ATS 1.61
 * (2,814, all to .sui files): a relative path starts at the including
 * file's folder (796 in the same folder, 1,916 in a subfolder, none with
 * "../"), and a path starting with "/" (102) starts at the root of the
 * game or mod (findPathRoots()). Listing a folder is all this needs, so it works without a
 * workspace index.
 */

export interface IncludePathPosition {
  /** What's typed between the opening quote and the cursor. */
  typed: string
  /** The last path segment typed (after the last "/"), which the chosen
   *  item replaces. Offsets into the normalized text. */
  segment: SiiRange
}

/** The @include path the cursor is in, if any. */
export function findIncludePathAt(
  document: SiiDocument,
  offset: number
): IncludePathPosition | undefined {
  const text = document.text
  const valueRanges = [
    ...document.includes.map((include) => include.valueRange),
    ...[
      ...document.attributes,
      ...document.units.flatMap((unit) => unit.attributes),
    ]
      .filter((attribute) => attribute.kind === 'include')
      .map((attribute) => attribute.valueRange),
  ]

  for (const value of valueRanges) {
    if (text[value.start] !== '"') continue
    const pathStart = value.start + 1
    if (offset < pathStart || offset > value.end) continue

    // A quote that never closes makes the value run on past this line
    // (see readValueRange in the reader): only this line is the path.
    const typed = text.slice(pathStart, offset)
    if (typed.includes('\n')) continue
    // Past the closing quote: no longer in the path.
    if (typed.includes('"')) continue

    const segmentStart = pathStart + typed.lastIndexOf('/') + 1
    return { typed, segment: { start: segmentStart, end: offset } }
  }
  return undefined
}

export interface IncludeCandidate {
  name: string
  isFolder: boolean
}

/**
 * The folders and .sui files that can come next in `typed`, for the file
 * at `filePath`. The file itself is left out (including itself would
 * loop), and so is anything that can't be read.
 */
export async function listIncludeCandidates(
  filePath: string,
  typed: string
): Promise<IncludeCandidate[]> {
  const typedFolder = typed.slice(0, typed.lastIndexOf('/') + 1)
  // Relative: the file's folder, and the same folder of the other parts.
  const pathRoots = findPathRoots(filePath)
  const roots = typedFolder.startsWith('/')
    ? pathRoots
    : relativeBases(filePath, pathRoots)

  const self = path.resolve(filePath).toLowerCase()
  const entries = await listFolder(roots, typedFolder, (name) =>
    name.toLowerCase().endsWith('.sui')
  )
  return entries
    .filter(
      (entry) =>
        entry.isFolder || path.resolve(entry.fullPath).toLowerCase() !== self
    )
    .map(({ name, isFolder }) => ({ name, isFolder }))
}
