import { existsSync } from 'node:fs'
import path from 'node:path'
import { relativeBases } from '../completion/modFiles'
import {
  rootsOfFile,
  type IndexedFile,
  type PathRef,
  type WorkspaceIndex,
} from './workspaceIndex'

/**
 * Go to Definition and Find References on a path (`model:
 * "/vehicle/truck/cabin.pmd"`, `@include "parts/cab.sui"`): the file it
 * names, and every path in the open folders naming the same file. Only
 * files in the mod can be opened: a path to one of the game's files has
 * nowhere to go, like a pointer to one of its units.
 */

/** The path under the cursor, if any. */
export function pathAt(file: IndexedFile, offset: number): PathRef | undefined {
  return file.paths.find(
    (ref) => offset >= ref.range.start && offset <= ref.range.end
  )
}

/** The file `ref` names, when it exists: a "/" path from the mod's root
 *  or whichever `base/`/`dlc_*` part has it, a relative one from the
 *  file's folder. */
export function resolvePathRef(
  file: IndexedFile,
  ref: PathRef,
  exists: (filePath: string) => boolean = existsSync
): string | undefined {
  const roots = rootsOfFile(file.filePath)
  const bases = ref.text.startsWith('/')
    ? roots
    : relativeBases(file.filePath, roots)
  return bases.map((base) => path.join(base, ref.text)).find(exists)
}

/** Every path in the open folders naming `target` (an absolute path). */
export function pathReferences(
  index: WorkspaceIndex,
  target: string,
  exists: (filePath: string) => boolean = existsSync
): { file: IndexedFile; ref: PathRef }[] {
  const key = path.resolve(target).toLowerCase()
  // A path ends with its file's name: most are skipped without resolving.
  const name = path.basename(key)
  const found: { file: IndexedFile; ref: PathRef }[] = []
  for (const file of index.all())
    for (const ref of file.paths) {
      if (!ref.text.toLowerCase().endsWith(name)) continue
      const resolved = resolvePathRef(file, ref, exists)
      if (resolved && path.resolve(resolved).toLowerCase() === key)
        found.push({ file, ref })
    }
  return found
}
