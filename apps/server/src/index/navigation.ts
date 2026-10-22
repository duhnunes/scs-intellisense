import { validateUnitName } from '../diagnostic/rules'
import type { SiiRange } from '../interfaces/structure'
import {
  type IndexedFile,
  type PointerCheck,
  type WorkspaceIndex,
} from './workspaceIndex'

/** A unit name under the cursor: in a unit's header, or a pointer value. */
export interface NameAtCursor {
  name: string
  /** The name without quotes, in the current file's normalized text. */
  range: SiiRange
  isDefinition: boolean
}

export async function nameAt(
  file: IndexedFile,
  offset: number,
  index: WorkspaceIndex,
  isPointer: PointerCheck
): Promise<NameAtCursor | undefined> {
  for (const unit of file.units)
    if (offset >= unit.nameRange.start && offset <= unit.nameRange.end)
      return {
        name: file.document
          .getText()
          .slice(unit.nameRange.start, unit.nameRange.end),
        range: unit.nameRange,
        isDefinition: true,
      }

  for (const value of file.values) {
    if (offset < value.range.start || offset > value.range.end) continue
    const classes =
      value.className !== undefined ? [value.className] : index.classesOf(file)
    for (const className of classes)
      if (await isPointer(className, value.key, value.bracketed))
        return { name: value.name, range: value.range, isDefinition: false }
    return undefined
  }
  return undefined
}

export interface Location {
  uri: string
  file: IndexedFile
  range: SiiRange
}

export function findDefinitions(
  index: WorkspaceIndex,
  name: string,
  fromUri: string
): Location[] {
  return index
    .definitions(name, fromUri)
    .map(({ file, unit }) => ({ uri: file.uri, file, range: unit.nameRange }))
}

export async function findReferences(
  index: WorkspaceIndex,
  name: string,
  fromUri: string,
  isPointer: PointerCheck,
  includeDeclaration: boolean
): Promise<Location[]> {
  const references = (await index.references(name, fromUri, isPointer)).map(
    ({ file, value }) => ({ uri: file.uri, file, range: value.range })
  )
  return includeDeclaration
    ? [...findDefinitions(index, name, fromUri), ...references]
    : references
}

/**
 * Every edit renaming `name` to `newName`: its definitions and the
 * pointers to it, in the open folders. Quotes stay as written. A file-
 * local name (".x") is renamed in its file only. Undefined when the name
 * isn't defined in the open folders: only pointers would change, and the
 * unit they point to (in the game, or another mod) would keep its name.
 */
export async function renameEdits(
  index: WorkspaceIndex,
  name: string,
  newName: string,
  fromUri: string,
  isPointer: PointerCheck
): Promise<Location[] | undefined> {
  const definitions = findDefinitions(index, name, fromUri)
  if (definitions.length === 0) return undefined
  return [
    ...definitions,
    ...(await findReferences(index, name, fromUri, isPointer, false)),
  ]
}

/** Why `newName` can't be a unit name, or undefined when it can: the
 *  same rules as the diagnostics (validateUnitName). The scope can
 *  change: renaming ".a" to "a.b" makes the unit global, the user's call. */
export function renameProblem(newName: string): string | undefined {
  if (newName.includes('"'))
    return 'Write the name without quotes: the ones already there are kept'
  const errors = validateUnitName(newName, {
    start: 0,
    end: newName.length,
  }).filter((issue) => (issue.severity ?? 'error') === 'error')
  if (newName.trim() === '') return 'A unit name must not be empty'
  return errors[0]?.message
}
