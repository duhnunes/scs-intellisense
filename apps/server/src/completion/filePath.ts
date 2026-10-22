import type { SiiRange } from '../interfaces/structure'
import type { AttributeValuePosition } from './attributeValue'
import { findPathRoots, listFolder, type FolderEntry } from './modFiles'

/**
 * Completion of file paths in attribute values (`model: "/vehicle/...pmd"`),
 * for the attributes the schema gives `expectedExtensions`.
 *
 * Measured on ATS 1.61 (135,133 such paths): they're quoted and start
 * with "/" (the mod or game root, findPathRoots()), sometimes after a
 * name and "|" (`sounds[]: "OY|/sound/world/gate_iron.soundref"`). Only
 * the mod's own files can be listed: the game's are inside its archives.
 * In ATS Expansion 94% of the paths are to the mod's own files.
 */

export interface FilePathPosition {
  /** The path typed so far, from its "/" (after any "name|") to the
   *  cursor. Empty right after the opening quote. */
  typed: string
  /** The last segment typed (after the last "/"), which the chosen item
   *  replaces. Offsets into the normalized text. */
  segment: SiiRange
}

/** The path at the cursor, when `position` is inside a quoted value. */
export function findFilePathAt(
  position: AttributeValuePosition,
  text: string,
  offset: number
): FilePathPosition | undefined {
  if (!position.quoted) return undefined
  const valueStart = position.replaceRange.start
  const beforeCursor = text.slice(valueStart, offset)
  // An unclosed quote makes the value run on to the next line.
  if (beforeCursor.includes('\n')) return undefined

  const pathStart = valueStart + beforeCursor.lastIndexOf('|') + 1
  const typed = text.slice(pathStart, offset)
  if (typed !== '' && !typed.startsWith('/')) return undefined
  return {
    typed,
    segment: { start: pathStart + typed.lastIndexOf('/') + 1, end: offset },
  }
}

/**
 * The folders, and files with one of `extensions` (without the dot, any
 * case), that can come next in `typed`, for the file at `filePath`.
 */
export async function listFilePathCandidates(
  filePath: string,
  typed: string,
  extensions: string[]
): Promise<FolderEntry[]> {
  const roots = findPathRoots(filePath)
  if (roots.length === 0) return []
  const folder = typed.slice(0, typed.lastIndexOf('/') + 1)
  const wanted = extensions.map((extension) => `.${extension.toLowerCase()}`)
  return listFolder(roots, folder, (name) =>
    wanted.some((extension) => name.toLowerCase().endsWith(extension))
  )
}
