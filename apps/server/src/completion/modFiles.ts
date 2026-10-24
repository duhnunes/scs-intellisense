import { existsSync, readdirSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * Where a path starting with "/" begins, for the file at `filePath`.
 *
 * The mod's folder is the nearest one holding a manifest.sii. Since 1.48
 * a mod may split its content into parts: a `base` folder, mounted
 * always, and `dlc_*` folders, mounted when the player owns that DLC
 * (wiki, Documentation/Engine/Mod_manager). The game then mounts only the
 * parts, all on the same "/", so each one is a root (ATS Expansion:
 * manifest.sii next to `base/`, `/vehicle/ai/...` is in
 * `base/vehicle/ai/...`).
 *
 * Without a manifest.sii, the folder above the nearest `def` folder,
 * which is also how the game's extracted archives are laid out
 * (`ATS_161/def/def/...` → `ATS_161/def`). Empty when neither is found,
 * rather than guessing.
 */
export function findPathRoots(filePath: string): string[] {
  let folder = path.dirname(path.resolve(filePath))
  let defParent: string | undefined
  for (;;) {
    if (existsSync(path.join(folder, 'manifest.sii')))
      return modParts(folder) ?? [folder]
    if (!defParent && path.basename(folder).toLowerCase() === 'def')
      defParent = path.dirname(folder)
    const parent = path.dirname(folder)
    if (parent === folder) return defParent ? [defParent] : []
    folder = parent
  }
}

/** The mod's `base` and `dlc_*` folders, base first, or undefined when
 *  it has none (the whole folder is mounted). */
function modParts(modFolder: string): string[] | undefined {
  let entries
  try {
    entries = readdirSync(modFolder, { withFileTypes: true })
  } catch {
    return undefined
  }
  const parts = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^(base|dlc_.+)$/i.test(name))
    .sort((a, b) =>
      a.toLowerCase() === 'base' ? -1 : b.toLowerCase() === 'base' ? 1 : 0
    )
  return parts.length > 0
    ? parts.map((name) => path.join(modFolder, name))
    : undefined
}

/**
 * The folders a relative path written in `filePath` can start in: the
 * file's own folder first, then the same folder in the mod's other parts.
 * Every part mounts on one "/" (with the game's archives), and a relative
 * path resolves there: 204 @includes of ATS 1.61 name a file in the same
 * folder of another archive (dlc_w900_tuning -> dlc_kenworth_w900: 160).
 * `roots` are the file's findPathRoots().
 */
export function relativeBases(filePath: string, roots: string[]): string[] {
  const own = path.dirname(path.resolve(filePath))
  const root = roots.find((candidate) => isWithin(own, candidate))
  if (!root) return [own]
  const virtualDir = path.relative(root, own)
  return [
    own,
    ...roots
      .filter((other) => other !== root)
      .map((other) => path.join(other, virtualDir)),
  ]
}

/** `filePath` is `folder` or inside it, whatever the case (Windows). */
function isWithin(filePath: string, folder: string): boolean {
  const file = filePath.toLowerCase()
  const dir = path.resolve(folder).toLowerCase()
  return (
    file === dir ||
    file.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep)
  )
}

export interface FolderEntry {
  name: string
  isFolder: boolean
  /** Full path on disk (from the first root that has it). */
  fullPath: string
}

/**
 * What's in `folder` (relative, "/"-separated) under any of `roots`:
 * subfolders and the files `acceptFile` keeps. The same name in two roots
 * shows once (names compared ignoring case, as on Windows). Hidden
 * entries (`.git`) and folders that can't be read are skipped.
 */
export async function listFolder(
  roots: string[],
  folder: string,
  acceptFile: (name: string) => boolean
): Promise<FolderEntry[]> {
  const seen = new Set<string>()
  const result: FolderEntry[] = []
  for (const root of roots) {
    const dir = path.join(root, folder)
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const isFolder = entry.isDirectory()
      if (!isFolder && !(entry.isFile() && acceptFile(entry.name))) continue
      const key = `${isFolder ? 'd' : 'f'}${entry.name.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        name: entry.name,
        isFolder,
        fullPath: path.join(dir, entry.name),
      })
    }
  }
  return result
}
