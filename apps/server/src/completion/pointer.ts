import type { SchemaAttributeDef } from '../interfaces/schemas'
import type { SiiDocument, SiiRange } from '../interfaces/structure'
import type { AttributeValuePosition } from './attributeValue'

/** True when `className` is `target` or inherits from it. */
export type IsKindOf = (className: string, target: string) => boolean

export interface PointerCompletionItem {
  label: string
  /** The unit's class. */
  detail: string
  /** Keeps the file's order, with null last. */
  sortText: string
  range: SiiRange
  newText: string
}

/**
 * Unit names for an `owner_ptr`/`link_ptr` value, from the same file: of
 * the 225,137 pointers in ATS 1.61, 69,462 of the 100,353 owner_ptr name a
 * unit of their own file (69%), while link_ptr mostly point to other
 * files (109,160 of 124,784): those come from the workspace index
 * (`elsewhere`), after the file's own. Only units of the classes the
 * schema expects (`pointsTo`), subclasses included (sign_template_text
 * for sign_template_item); every unit when it doesn't say. `null` is
 * offered last: link_ptr are often left empty (6,406).
 */
export function buildPointerCompletionItems(
  position: AttributeValuePosition,
  def: SchemaAttributeDef,
  document: SiiDocument,
  isKindOf: IsKindOf,
  elsewhere: OtherFileUnit[] = []
): PointerCompletionItem[] {
  if (def.type !== 'owner_ptr' && def.type !== 'link_ptr') return []
  const { unit: current, attribute, replaceRange, quoted } = position
  const targets = Array.isArray(def.pointsTo) ? def.pointsTo : []
  const needsSpace = !quoted && replaceRange.start === attribute.colonRange?.end
  const insert = (value: string) => (needsSpace ? ` ${value}` : value)
  const wanted = (className: string) =>
    targets.length === 0 ||
    targets.some((target) => isKindOf(className, target))

  const here = document.units
    .filter(
      (unit) =>
        unit !== current && unit.unitName !== '' && wanted(unit.className)
    )
    .map((unit) => ({ name: unit.unitName, detail: unit.className }))
  const there = elsewhere
    .filter((unit) => wanted(unit.className))
    .map((unit) => ({
      name: unit.name,
      detail: `${unit.className} (${unit.where})`,
    }))
  const all = [...here, ...there]
  const width = String(all.length + 1).length
  const items = all.map((unit, index) => ({
    label: unit.name,
    detail: unit.detail,
    sortText: String(index).padStart(width, '0'),
    range: replaceRange,
    newText: insert(unit.name),
  }))
  items.push({
    label: 'null',
    detail: 'no unit',
    sortText: String(all.length).padStart(width, '0'),
    range: replaceRange,
    newText: insert('null'),
  })
  return items
}

/** A unit defined in another file of the open folders. */
export interface OtherFileUnit {
  name: string
  className: string
  /** Where it is, for the item's detail (a path relative to the folder). */
  where: string
}
