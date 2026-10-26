import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { URI } from 'vscode-uri'
import { findPathRoots, relativeBases } from '../completion/modFiles'
import { decodeSiiFile } from '../formatter/workspaceFormat'
import type {
  SiiAttribute,
  SiiDocument,
  SiiRange,
} from '../interfaces/structure'
import { normalizeSiiText, readScsDocument } from '../sii'
import { LineMap } from './lineMap'
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
  /** Offset → position in the normalized text (no BOM, LF). The text
   *  itself isn't kept: see LineMap. */
  document: LineMap
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

const PARALLEL_READS = 16

export class WorkspaceIndex {
  private readonly files = new Map<string, IndexedFile>()
  /** File key → the files that @include it. classesOf() runs on every
   *  edit of an open .sui: looking through every file took 44 ms in the
   *  extracted ATS 1.61. */
  private readonly includers = new Map<string, Set<IndexedFile>>()
  private folders: string[] = []

  get size(): number {
    return this.files.size
  }

  /** Replaces the folders and reads every indexed file under them. Files
   *  already set from an open editor keep their text. */
  async scan(folders: string[], isOpen: (uri: string) => boolean) {
    this.folders = folders
    rootsCache.clear()
    sharedRoots.clear()
    const found: string[] = []
    for (const folder of folders) await collect(folder, found)

    const keep = new Set(found.map((file) => fileKey(file)))
    for (const [key, entry] of this.files)
      if (!keep.has(key) && !isOpen(entry.uri)) this.drop(key)

    // Several reads at once: one at a time, the scan mostly waited on the
    // disk (ATS 1.61 extracted, 229,537 files: 7 minutes). Each file is
    // parsed when its read ends, so requests are still answered meanwhile.
    let next = 0
    const reader = async () => {
      while (next < found.length) {
        const file = found[next++]!
        if (isOpen(URI.file(file).toString())) continue
        try {
          this.setFromBytes(file, await readFile(file))
        } catch {
          // Unreadable: left out.
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL_READS }, reader))
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
    this.put(buildEntry(uri, filePath, text))
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
    this.drop(fileKey(filePath))
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
    for (const other of this.includers.get(file.key) ?? [])
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
    this.put(buildEntry(URI.file(filePath).toString(), filePath, decoded.text))
  }

  private put(entry: IndexedFile): void {
    this.drop(entry.key)
    this.files.set(entry.key, entry)
    for (const include of entry.includes) {
      let files = this.includers.get(include.target)
      if (!files) this.includers.set(include.target, (files = new Set()))
      files.add(entry)
    }
  }

  private drop(key: string): void {
    const entry = this.files.get(key)
    if (!entry) return
    this.files.delete(key)
    for (const include of entry.includes) {
      const files = this.includers.get(include.target)
      files?.delete(entry)
      if (files?.size === 0) this.includers.delete(include.target)
    }
  }
}

function buildEntry(uri: string, filePath: string, text: string): IndexedFile {
  if (/\.(mat|tobj|soundref)$/i.test(filePath))
    return buildPathsEntry(uri, filePath, text)
  const mode = filePath.toLowerCase().endsWith('.sui') ? 'sui' : 'sii'
  const parsed = readScsDocument(text, mode)
  const document = new LineMap(parsed.text)
  const units = parsed.units
    .filter((unit) => unit.unitName !== '')
    .map((unit) => ({
      name: own(unit.unitName),
      className: own(unit.className),
      nameRange: innerRange(parsed.text, unit.unitNameRange),
      range: unit.range,
    }))
  const values: ValueCandidate[] = []
  const includes: IncludeRef[] = []
  const paths: PathRef[] = []
  const addValues = (
    attributes: SiiAttribute[],
    unitClass: string | undefined
  ) => {
    const className = unitClass === undefined ? undefined : own(unitClass)
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
        name: own(name),
        className,
        key: own(attribute.key),
        bracketed: attribute.isArray,
        range,
      })
    }
  }
  const addInclude = (valueRange: SiiRange) => {
    const range = innerRange(parsed.text, valueRange)
    const text = parsed.text.slice(range.start, range.end)
    if (text !== '') paths.push({ kind: 'include', text: own(text), range })
  }
  // Only quoted values whose path starts with "/": that's how the game
  // writes all of them (135,133 in ATS 1.61).
  const addFilePath = (valueRange: SiiRange, inner: SiiRange) => {
    if (inner.start === valueRange.start) return // not quoted
    const value = parsed.text.slice(inner.start, inner.end)
    const start = inner.start + value.lastIndexOf('|') + 1
    // A sound bank names its event after '#' (`"/sound/music/scene.bank
    // #scene/logo_ats"`, 494 in ATS 1.61): the file ends there.
    const hash = parsed.text.indexOf('#', start)
    const end = hash >= 0 && hash < inner.end ? hash : inner.end
    const text = parsed.text.slice(start, end)
    if (text.startsWith('/') && text.length > 1 && !text.includes('\n'))
      paths.push({
        kind: 'file',
        text: own(text),
        range: { start, end },
      })
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
    uri: own(uri),
    filePath: own(path.resolve(filePath)),
    key: own(fileKey(filePath)),
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
  const roots = rootsOfFolder(path.dirname(filePath))
  // Relative: next to the file, or in the same folder of another part.
  const bases = includePath.startsWith('/')
    ? roots
    : relativeBases(filePath, roots)
  const candidates = bases.map((base) => path.join(base, includePath))
  const found = candidates.find((candidate) => existsSync(candidate))
  const target = found ?? candidates[0]
  return target ? fileKey(target) : undefined
}

// Files of one folder share their roots; cleared on every scan, in case a
// manifest.sii or base/ folder appeared.
const rootsCache = new Map<string, string[]>()
// One array per distinct list: in the extracted game every folder of an
// archive has the same 62 roots, and thousands of copies took 60 MB.
const sharedRoots = new Map<string, string[]>()

/** Where the "/" paths of `filePath` start (findPathRoots), remembered
 *  per folder: moving a file looks them up for every file with paths. */
export function rootsOfFile(filePath: string): string[] {
  return rootsOfFolder(path.dirname(path.resolve(filePath)))
}

function rootsOfFolder(folder: string): string[] {
  const key = folder.toLowerCase()
  let roots = rootsCache.get(key)
  if (!roots) {
    const found = findPathRoots(path.join(folder, 'x.sii'))
    const id = found.join('\0')
    roots = sharedRoots.get(id) ?? found
    sharedRoots.set(id, roots)
    rootsCache.set(key, roots)
  }
  return roots
}

/**
 * A flat copy of a string the index keeps. V8 keeps a slice of 13
 * characters or more as a view into the whole string, so every name the
 * index kept held its whole file in memory (the extracted ATS 1.61 took
 * 1.3 GB, its `def` archive 343 MB, 28 MB with copies). A string built by
 * joining pieces (a URI: 2.3 KB for 90 characters) keeps the pieces.
 */
function own(text: string): string {
  return text.length < 13 ? text : Buffer.from(text, 'utf8').toString('utf8')
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

/** .sii/.sui for everything; .mat, text .tobj and .soundref for their paths
 *  only. */
export const INDEXED_FILE = /\.(sii|sui|mat|tobj|soundref)$/i

/** A .mat, text .tobj or .soundref: only the paths it holds, for file
 *  moves and references. */
function buildPathsEntry(
  uri: string,
  filePath: string,
  text: string
): IndexedFile {
  const normalized = normalizeSiiText(text)
  const paths = texturePathRefs(filePath, normalized).map((ref) => ({
    ...ref,
    text: own(ref.text),
  }))
  // Looked up now, in the background, rather than when a file moves.
  if (paths.length > 0) rootsOfFile(filePath)
  return {
    uri: own(uri),
    filePath: own(path.resolve(filePath)),
    key: own(fileKey(filePath)),
    document: new LineMap(normalized),
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
  const names = new Set(entries.map((entry) => entry.name.toLowerCase()))
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) await collect(full, found)
    else if (
      entry.isFile() &&
      INDEXED_FILE.test(entry.name) &&
      !isCompiledTobj(entry.name, names)
    )
      found.push(full)
  }
}

/**
 * A .tobj next to a .dds of the same name is the converter's output: binary,
 * with no path the index can read, so it isn't even opened. A text .tobj
 * (SCS Blender Tools) names its .tga/.png source instead. On ATS
 * Expansion, the owner's source mod and the extracted ATS 1.61 base: all
 * 32,589 such files were binary, and no text one had a .dds beside it.
 * Opening them took a third of the extracted game's 229,537 files.
 */
function isCompiledTobj(name: string, folderNames: Set<string>): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.tobj') && folderNames.has(lower.slice(0, -5) + '.dds')
}
