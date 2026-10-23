import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { findPathRoots } from '../completion/modFiles'
import { decodeSiiFile } from '../formatter/workspaceFormat'
import type {
  SiiAttribute,
  SiiDocument,
  SiiRange,
} from '../interfaces/structure'
import { normalizeSiiText, readScsDocument } from '../sii'
import { texturePathRefs } from './texturePaths'

/**
 * What every .sii/.sui of the open folders defines and points to, so Go
 * to Definition, Find References, Rename and pointer completion can see
 * past the current file.
 *
 * Names starting with "." are nameless units: they exist only in their
 * file (wiki). So are `_nameless.*`, which is how SCS's tools write them
 * out: in ATS 1.61 the same `_nameless.*` name is defined in dozens of
 * files with different content (`_nameless._.window`: 39), so they can't
 * be one unit each. Every other name is one name for the whole game; the
 * same name in several files gives several definitions, and the user
 * picks.
 *
 * Which values are pointers isn't decided here: that needs the class's
 * schema (owner_ptr/link_ptr), which the caller checks with
 * `PointerCheck`. A value is kept as a candidate when it could be a unit
 * name.
 */

export interface IndexedUnit {
  /** As written, with quotes if quoted. */
  name: string
  className: string
  /** The name without its quotes. */
  nameRange: SiiRange
  /** The whole unit, header to closing brace. */
  range: SiiRange
}

export interface ValueCandidate {
  /** The name the value would point to, without quotes. */
  name: string
  /** Undefined for a .sui fragment's bare attribute: its class is the
   *  including unit's (see classesOf()). */
  className: string | undefined
  key: string
  /** `key[]:` or `key[n]:`. Without brackets an array attribute holds the
   *  count (`items: 5`), not a pointer. */
  bracketed: boolean
  /** Inside the quotes, if any. */
  range: SiiRange
}

export interface IncludeRef {
  /** Resolved path, lowercased (Windows), or undefined for "/" paths
   *  that can't be resolved here. */
  target: string
  /** The class of the unit the @include is in, or undefined at top level. */
  className: string | undefined
}

/** A path written in the file: an @include, or a file attribute's value
 *  (`model: "/vehicle/a.pmd"`, `sounds[]: "OY|/sound/b.soundref"`). */
export interface PathRef {
  kind: 'include' | 'file'
  /** As written: relative, or starting with "/". */
  text: string
  /** Of `text` only: inside the quotes, after any "name|". */
  range: SiiRange
}

export interface IndexedFile {
  uri: string
  /** The file system path, as the file system spells it. */
  filePath: string
  /** Lowercased file system path: the map key. */
  key: string
  /** Normalized text (no BOM, LF), for offset → position. */
  document: TextDocument
  units: IndexedUnit[]
  values: ValueCandidate[]
  includes: IncludeRef[]
  paths: PathRef[]
}

/** Is `key` of class `className` an owner_ptr/link_ptr element? */
export type PointerCheck = (
  className: string,
  key: string,
  bracketed: boolean
) => Promise<boolean>

/** Nameless (only in its file): ".x", and `_nameless.*` as SCS writes them. */
export function isFileLocalName(name: string): boolean {
  return name.startsWith('.') || name.startsWith('_nameless.')
}

export function unquote(name: string): string {
  return name.length >= 2 && name.startsWith('"') && name.endsWith('"')
    ? name.slice(1, -1)
    : name
}

const UNIT_NAME = /^[A-Za-z0-9_.]+$/

export class WorkspaceIndex {
  private readonly files = new Map<string, IndexedFile>()
  private folders: string[] = []

  get size(): number {
    return this.files.size
  }

  /** Replaces the folders and reads every .sii/.sui under them, a batch
   *  at a time so requests are still answered meanwhile. Files already
   *  set from an open editor keep their text. */
  async scan(folders: string[], isOpen: (uri: string) => boolean) {
    this.folders = folders
    rootsCache.clear()
    const found: string[] = []
    for (const folder of folders) await collect(folder, found)

    const keep = new Set(found.map((file) => fileKey(file)))
    for (const [key, entry] of this.files)
      if (!keep.has(key) && !isOpen(entry.uri)) this.files.delete(key)

    for (let i = 0; i < found.length; i++) {
      const file = found[i]!
      const uri = URI.file(file).toString()
      if (!isOpen(uri)) {
        try {
          this.setFromBytes(file, await readFile(file))
        } catch {
          // Unreadable: left out.
        }
      }
      if (i % 50 === 49) await new Promise((r) => setImmediate(r))
    }
    return found.length
  }

  /** Whether `filePath` is under one of the open folders. */
  covers(filePath: string): boolean {
    const key = fileKey(filePath)
    return this.folders.some((folder) => {
      const root = fileKey(folder)
      return (
        key === root ||
        key.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
      )
    })
  }

  /** From an open editor: the text as it is now, saved or not. */
  setFromText(uri: string, text: string): void {
    const filePath = URI.parse(uri).fsPath
    this.files.set(fileKey(filePath), buildEntry(uri, filePath, text))
  }

  /** From disk, after a change outside the editor (or a close). */
  refreshFromDisk(filePath: string): void {
    try {
      this.setFromBytes(filePath, readFileSync(filePath))
    } catch {
      this.remove(filePath)
    }
  }

  remove(filePath: string): void {
    this.files.delete(fileKey(filePath))
  }

  get(uri: string): IndexedFile | undefined {
    return this.files.get(fileKey(URI.parse(uri).fsPath))
  }

  all(): Iterable<IndexedFile> {
    return this.files.values()
  }

  /** Units named `name`, seen from the file `fromUri`. */
  definitions(
    name: string,
    fromUri: string
  ): { file: IndexedFile; unit: IndexedUnit }[] {
    const bare = unquote(name)
    const files = isFileLocalName(bare)
      ? [this.get(fromUri)].filter(isDefined)
      : this.files.values()
    const result: { file: IndexedFile; unit: IndexedUnit }[] = []
    for (const file of files)
      for (const unit of file.units)
        if (unquote(unit.name) === bare) result.push({ file, unit })
    return result
  }

  /** Pointer values naming `name`, seen from the file `fromUri`. */
  async references(
    name: string,
    fromUri: string,
    isPointer: PointerCheck
  ): Promise<{ file: IndexedFile; value: ValueCandidate }[]> {
    const bare = unquote(name)
    const files = isFileLocalName(bare)
      ? [this.get(fromUri)].filter(isDefined)
      : [...this.files.values()]
    const result: { file: IndexedFile; value: ValueCandidate }[] = []
    for (const file of files) {
      for (const value of file.values) {
        if (value.name !== bare) continue
        const classes =
          value.className !== undefined
            ? [value.className]
            : this.classesOf(file)
        let pointer = false
        for (const className of classes)
          if (await isPointer(className, value.key, value.bracketed)) {
            pointer = true
            break
          }
        if (pointer) result.push({ file, value })
      }
    }
    return result
  }

  /** The classes a .sui fragment's bare attributes belong to: those of
   *  the units that @include it, or, when another fragment includes it
   *  (`goal_bonus_time_limit.sui` → `goal_bonus.sui` in ATS 1.61), that
   *  fragment's classes. */
  classesOf(file: IndexedFile, seen = new Set<string>()): string[] {
    seen.add(file.key)
    const classes = new Set<string>()
    for (const other of this.files.values())
      for (const include of other.includes) {
        if (include.target !== file.key) continue
        if (include.className) classes.add(include.className)
        else if (!seen.has(other.key))
          for (const className of this.classesOf(other, seen))
            classes.add(className)
      }
    return [...classes]
  }

  private setFromBytes(filePath: string, bytes: Uint8Array): void {
    const decoded = decodeSiiFile(bytes)
    if (!decoded.ok) {
      this.remove(filePath)
      return
    }
    this.files.set(
      fileKey(filePath),
      buildEntry(URI.file(filePath).toString(), filePath, decoded.text)
    )
  }
}

function buildEntry(uri: string, filePath: string, text: string): IndexedFile {
  if (/\.(mat|tobj)$/i.test(filePath))
    return buildPathsEntry(uri, filePath, text)
  const mode = filePath.toLowerCase().endsWith('.sui') ? 'sui' : 'sii'
  const parsed = readScsDocument(text, mode)
  const document = TextDocument.create(uri, mode, 0, parsed.text)
  const units = parsed.units
    .filter((unit) => unit.unitName !== '')
    .map((unit) => ({
      name: unit.unitName,
      className: unit.className,
      nameRange: innerRange(parsed.text, unit.unitNameRange),
      range: unit.range,
    }))
  const values: ValueCandidate[] = []
  const includes: IncludeRef[] = []
  const paths: PathRef[] = []
  const addValues = (
    attributes: SiiAttribute[],
    className: string | undefined
  ) => {
    for (const attribute of attributes) {
      if (attribute.kind === 'include') {
        const target = resolveInclude(filePath, parsed, attribute)
        if (target) includes.push({ target, className })
        addInclude(attribute.valueRange)
        continue
      }
      const range = innerRange(parsed.text, attribute.valueRange)
      addFilePath(attribute.valueRange, range)
      const name = parsed.text.slice(range.start, range.end)
      if (
        name === 'null' ||
        !UNIT_NAME.test(name) ||
        (/^-?[\d.]+$/.test(name) && !name.startsWith('.'))
      )
        continue
      values.push({
        name,
        className,
        key: attribute.key,
        bracketed: attribute.isArray,
        range,
      })
    }
  }
  const addInclude = (valueRange: SiiRange) => {
    const range = innerRange(parsed.text, valueRange)
    const text = parsed.text.slice(range.start, range.end)
    if (text !== '') paths.push({ kind: 'include', text, range })
  }
  // Only quoted values whose path starts with "/": that's how the game
  // writes all of them (135,133 in ATS 1.61).
  const addFilePath = (valueRange: SiiRange, inner: SiiRange) => {
    if (inner.start === valueRange.start) return // not quoted
    const value = parsed.text.slice(inner.start, inner.end)
    const start = inner.start + value.lastIndexOf('|') + 1
    const text = parsed.text.slice(start, inner.end)
    if (text.startsWith('/') && text.length > 1 && !text.includes('\n'))
      paths.push({ kind: 'file', text, range: { start, end: inner.end } })
  }
  for (const unit of parsed.units) addValues(unit.attributes, unit.className)
  addValues(parsed.attributes, undefined)
  for (const include of parsed.includes) {
    const target = resolveRelative(filePath, include.path)
    if (target) includes.push({ target, className: undefined })
    addInclude(include.valueRange)
  }
  if (paths.length > 0) rootsOfFile(filePath)
  return {
    uri,
    filePath: path.resolve(filePath),
    key: fileKey(filePath),
    document,
    units,
    values,
    includes,
    paths,
  }
}

function resolveInclude(
  filePath: string,
  parsed: SiiDocument,
  attribute: SiiAttribute
): string | undefined {
  const range = innerRange(parsed.text, attribute.valueRange)
  return resolveRelative(filePath, parsed.text.slice(range.start, range.end))
}

/** A relative @include starts at the file's folder (2,712 of the 2,814 in
 *  ATS 1.61); a "/" one at the mod's root or part, the one that has the
 *  file (base/ or a dlc_* folder). */
function resolveRelative(
  filePath: string,
  includePath: string
): string | undefined {
  if (includePath === '') return undefined
  if (!includePath.startsWith('/'))
    return fileKey(path.join(path.dirname(filePath), includePath))
  const roots = rootsOfFolder(path.dirname(filePath))
  const candidates = roots.map((root) => path.join(root, includePath))
  const found = candidates.find((candidate) => existsSync(candidate))
  const target = found ?? candidates[0]
  return target ? fileKey(target) : undefined
}

// Files of one folder share their roots; cleared on every scan, in case a
// manifest.sii or base/ folder appeared.
const rootsCache = new Map<string, string[]>()

/** Where the "/" paths of `filePath` start (findPathRoots), remembered
 *  per folder: moving a file looks them up for every file with paths. */
export function rootsOfFile(filePath: string): string[] {
  return rootsOfFolder(path.dirname(path.resolve(filePath)))
}

function rootsOfFolder(folder: string): string[] {
  const key = folder.toLowerCase()
  let roots = rootsCache.get(key)
  if (!roots) {
    roots = findPathRoots(path.join(folder, 'x.sii'))
    rootsCache.set(key, roots)
  }
  return roots
}

function innerRange(text: string, range: SiiRange): SiiRange {
  return range.end - range.start >= 2 &&
    text[range.start] === '"' &&
    text[range.end - 1] === '"'
    ? { start: range.start + 1, end: range.end - 1 }
    : range
}

function fileKey(filePath: string): string {
  return path.resolve(filePath).toLowerCase()
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

/** .sii/.sui for everything; .mat and text .tobj for their paths only. */
export const INDEXED_FILE = /\.(sii|sui|mat|tobj)$/i

/** A .mat or text .tobj: only the paths it holds, for file moves. */
function buildPathsEntry(
  uri: string,
  filePath: string,
  text: string
): IndexedFile {
  const normalized = normalizeSiiText(text)
  const paths = texturePathRefs(filePath, normalized)
  // Looked up now, in the background, rather than when a file moves.
  if (paths.length > 0) rootsOfFile(filePath)
  return {
    uri,
    filePath: path.resolve(filePath),
    key: fileKey(filePath),
    document: TextDocument.create(uri, 'plaintext', 0, normalized),
    units: [],
    values: [],
    includes: [],
    paths,
  }
}

async function collect(folder: string, found: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(folder, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) await collect(full, found)
    else if (entry.isFile() && INDEXED_FILE.test(entry.name)) found.push(full)
  }
}
