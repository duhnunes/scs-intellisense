import path from 'node:path'
import { findPathRoots } from '../completion/modFiles'
import type { SiiRange } from '../interfaces/structure'
import type { IndexedFile, PathRef, WorkspaceIndex } from './workspaceIndex'

/** A file or folder renamed or moved: absolute paths. */
export interface FileMove {
  from: string
  to: string
}

export interface PathEdit {
  file: IndexedFile
  range: SiiRange
  newText: string
}

/**
 * The edits that keep every path in the open folders pointing at the same
 * file after `moves`, like TypeScript's "update imports on file move":
 * `@include`s and file attributes (`model: "/vehicle/a.pmd"`) to a moved
 * file or anything in a moved folder, and the relative `@include`s of a
 * moved .sii/.sui itself.
 *
 * A "/" path stays a "/" path (from the mod's root, or its `base/` /
 * `dlc_*` part); a relative one stays relative while it can. The game's
 * files never use "../" (none of the 2,814 @includes in ATS 1.61), so a
 * relative path that would need it becomes a "/" path instead. A path
 * that can't be written either way (moved out of the mod) is left alone.
 */
export function moveEdits(
  index: WorkspaceIndex,
  moves: FileMove[],
  rootsOf: (filePath: string) => string[] = findPathRoots
): PathEdit[] {
  const moved = (target: string): string | undefined => {
    for (const move of moves) {
      const from = path.resolve(move.from)
      if (same(target, from)) return path.resolve(move.to)
      if (isInside(target, from))
        return path.join(path.resolve(move.to), target.slice(from.length))
    }
    return undefined
  }

  const edits: PathEdit[] = []
  const rootsByFolder = new Map<string, string[]>()
  for (const file of index.all()) {
    // Files of one folder share their roots: looked up once per folder
    // (4,426 files of ATS Expansion took 1.7 s otherwise).
    const folder = path.dirname(file.filePath).toLowerCase()
    let roots = rootsByFolder.get(folder)
    if (!roots) {
      roots = rootsOf(file.filePath)
      rootsByFolder.set(folder, roots)
    }
    const newFile = moved(file.filePath) ?? file.filePath
    for (const ref of file.paths) {
      const newText = rewrite(ref, file.filePath, newFile, roots, moved)
      if (newText !== undefined && newText !== ref.text)
        edits.push({ file, range: ref.range, newText })
    }
  }
  return edits
}

function rewrite(
  ref: PathRef,
  oldFile: string,
  newFile: string,
  roots: string[],
  moved: (target: string) => string | undefined
): string | undefined {
  if (ref.text.startsWith('/')) {
    // In whichever part the file is: base/ or one of the dlc_* folders.
    for (const root of roots) {
      const target = path.join(root, ref.text)
      const newTarget = moved(target)
      if (newTarget) return fromRoot(newTarget, roots)
    }
    return undefined
  }

  // Relative: only @include paths are written this way.
  const target = path.resolve(path.dirname(oldFile), ref.text)
  const newTarget = moved(target) ?? target
  if (newTarget === target && newFile === oldFile) return undefined
  const relative = path.relative(path.dirname(newFile), newTarget)
  if (
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  )
    return relative.split(path.sep).join('/')
  return fromRoot(newTarget, roots)
}

/** `filePath` as a "/" path from one of `roots`, or undefined when it's
 *  outside all of them. */
function fromRoot(filePath: string, roots: string[]): string | undefined {
  for (const root of roots)
    if (isInside(filePath, root))
      return '/' + path.relative(root, filePath).split(path.sep).join('/')
  return undefined
}

/** Windows paths: one file whatever the case. */
function same(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function isInside(filePath: string, folder: string): boolean {
  const prefix = folder.endsWith(path.sep) ? folder : folder + path.sep
  return filePath.toLowerCase().startsWith(prefix.toLowerCase())
}
