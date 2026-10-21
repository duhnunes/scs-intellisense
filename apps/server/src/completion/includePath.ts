import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import type { SiiDocument, SiiRange } from '../interfaces/structure'

/**
 * Completion of the path in `@include "..."`.
 *
 * How the game resolves these, measured on every @include of ATS 1.61
 * (2,814, all to .sui files): a relative path starts at the including
 * file's folder (796 in the same folder, 1,916 in a subfolder, none with
 * "../"), and a path starting with "/" (102) starts at the root of the
 * game or mod. Listing a folder is all this needs, so it works without a
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
  let base: string | undefined
  if (typedFolder.startsWith('/')) base = findModRoot(filePath)
  else base = path.dirname(filePath)
  if (!base) return []

  const folder = path.join(base, typedFolder)
  let entries
  try {
    entries = await readdir(folder, { withFileTypes: true })
  } catch {
    return []
  }

  const self = path.resolve(filePath).toLowerCase()
  const candidates: IncludeCandidate[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      candidates.push({ name: entry.name, isFolder: true })
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith('.sui') &&
      path.resolve(folder, entry.name).toLowerCase() !== self
    ) {
      candidates.push({ name: entry.name, isFolder: false })
    }
  }
  return candidates
}

/**
 * Where a path starting with "/" begins: the mod's folder (the nearest
 * one holding a manifest.sii), or else the folder above the nearest
 * `def` folder, which is also how the game's extracted archives are laid
 * out (`ATS_161/def/def/...` → `ATS_161/def`). Undefined when neither is
 * found, rather than guessing.
 */
export function findModRoot(filePath: string): string | undefined {
  let folder = path.dirname(path.resolve(filePath))
  let defParent: string | undefined
  for (;;) {
    if (existsSync(path.join(folder, 'manifest.sii'))) return folder
    if (!defParent && path.basename(folder).toLowerCase() === 'def')
      defParent = path.dirname(folder)
    const parent = path.dirname(folder)
    if (parent === folder) return defParent
    folder = parent
  }
}
