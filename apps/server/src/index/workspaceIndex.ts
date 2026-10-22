import { readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { decodeSiiFile } from '../formatter/workspaceFormat'
import type {
  SiiAttribute,
  SiiDocument,
  SiiRange,
} from '../interfaces/structure'
import { readScsDocument } from '../sii'

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

export interface IndexedFile {
  uri: string
  /** Lowercased file system path: the map key. */
  key: string
  /** Normalized text (no BOM, LF), for offset → position. */
  document: TextDocument
  units: IndexedUnit[]
  values: ValueCandidate[]
  includes: IncludeRef[]
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
   *  the units that @include it. */
  classesOf(file: IndexedFile): string[] {
    const classes = new Set<string>()
    for (const other of this.files.values())
      for (const include of other.includes)
        if (include.target === file.key && include.className)
          classes.add(include.className)
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
  const addValues = (
    attributes: SiiAttribute[],
    className: string | undefined
  ) => {
    for (const attribute of attributes) {
      if (attribute.kind === 'include') {
        const target = resolveInclude(filePath, parsed, attribute)
        if (target) includes.push({ target, className })
        continue
      }
      const range = innerRange(parsed.text, attribute.valueRange)
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
  for (const unit of parsed.units) addValues(unit.attributes, unit.className)
  addValues(parsed.attributes, undefined)
  for (const include of parsed.includes) {
    const target = resolveRelative(filePath, include.path)
    if (target) includes.push({ target, className: undefined })
  }
  return { uri, key: fileKey(filePath), document, units, values, includes }
}

function resolveInclude(
  filePath: string,
  parsed: SiiDocument,
  attribute: SiiAttribute
): string | undefined {
  const range = innerRange(parsed.text, attribute.valueRange)
  return resolveRelative(filePath, parsed.text.slice(range.start, range.end))
}

/** Only relative @include paths: 2,712 of the 2,814 in ATS 1.61. */
function resolveRelative(
  filePath: string,
  includePath: string
): string | undefined {
  if (includePath === '' || includePath.startsWith('/')) return undefined
  return fileKey(path.join(path.dirname(filePath), includePath))
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
    else if (entry.isFile() && /\.(sii|sui)$/i.test(entry.name))
      found.push(full)
  }
}
