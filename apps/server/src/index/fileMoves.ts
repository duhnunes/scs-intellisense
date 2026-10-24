import { existsSync } from 'node:fs'
import path from 'node:path'
import { relativeBases } from '../completion/modFiles'
import type { SiiRange } from '../interfaces/structure'
import {
  rootsOfFile,
  type IndexedFile,
  type PathRef,
  type WorkspaceIndex,
} from './workspaceIndex'

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
 * `@include`s, file attributes (`model: "/vehicle/a.pmd"`) and the
 * texture paths of .mat and text .tobj files, to a moved file or anything
 * in a moved folder, and the relative paths of a moved file itself.
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
  rootsOf: (filePath: string) => string[] = rootsOfFile
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

  // A path can only reach a moved item through its name: a "/" path names
  // every folder on the way, and a relative one every folder below the
  // file (never "../"). So most paths are skipped with a string check;
  // only a moved file's own paths always need a look. VS Code waits for
  // this before moving (17,000 indexed files of ATS Expansion).
  const names = moves.map((move) => path.basename(move.from).toLowerCase())
  const mayPoint = (ref: PathRef) => {
    const lower = ref.text.toLowerCase()
    return names.some((name) => lower.includes(name))
  }

  const edits: PathEdit[] = []
  for (const file of index.all()) {
    const newFile = moved(file.filePath)
    const refs = newFile ? file.paths : file.paths.filter(mayPoint)
    if (refs.length === 0) continue
    const roots = rootsOf(file.filePath)
    for (const ref of refs) {
      const newText = rewrite(
        ref,
        file.filePath,
        newFile ?? file.filePath,
        roots,
        moved
      )
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

  // Relative: @include paths, and the textures of a .mat or .tobj. The
  // file they name is next to this one, or in the same folder of another
  // part of the mod (all parts mount on one "/").
  const candidates = relativeBases(oldFile, roots).map((base) =>
    path.resolve(base, ref.text)
  )
  const target =
    candidates.find((candidate) => moved(candidate) || existsSync(candidate)) ??
    candidates[0]!
  const newTarget = moved(target) ?? target
  if (newTarget === target && newFile === oldFile) return undefined

  // Still below the file's folder, in the virtual "/": stays relative.
  const virtualTarget = fromRoot(newTarget, roots)
  const virtualDir = virtualFolder(path.dirname(newFile), roots)
  if (virtualTarget && virtualDir !== undefined) {
    const prefix = virtualDir === '/' ? '/' : virtualDir + '/'
    if (virtualTarget.toLowerCase().startsWith(prefix.toLowerCase()))
      return virtualTarget.slice(prefix.length)
    return virtualTarget
  }
  // Not in a mod part (no manifest.sii found): only the disk to go by.
  const relative = path.relative(path.dirname(newFile), newTarget)
  if (
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  )
    return relative.split(path.sep).join('/')
  return fromRoot(newTarget, roots)
}

/** A folder as a "/" path: "/" for a root itself. */
function virtualFolder(folder: string, roots: string[]): string | undefined {
  if (roots.some((root) => same(folder, root))) return '/'
  return fromRoot(folder, roots)
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
