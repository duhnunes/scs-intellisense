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
 * files (109,160 of 124,784),
 * which needs the workspace index. Only units of the classes the schema
 * expects (`pointsTo`), subclasses included (sign_template_text for
 * sign_template_item); every unit when it doesn't say. `null` is offered
 * last: link_ptr are often left empty (6,406).
 */
export function buildPointerCompletionItems(
  position: AttributeValuePosition,
  def: SchemaAttributeDef,
  document: SiiDocument,
  isKindOf: IsKindOf
): PointerCompletionItem[] {
  if (def.type !== 'owner_ptr' && def.type !== 'link_ptr') return []
  const { unit: current, attribute, replaceRange, quoted } = position
  const targets = Array.isArray(def.pointsTo) ? def.pointsTo : []
  const needsSpace = !quoted && replaceRange.start === attribute.colonRange?.end
  const insert = (value: string) => (needsSpace ? ` ${value}` : value)

  const units = document.units.filter(
    (unit) =>
      unit !== current &&
      unit.unitName !== '' &&
      (targets.length === 0 ||
        targets.some((target) => isKindOf(unit.className, target)))
  )
  const width = String(units.length + 1).length
  const items = units.map((unit, index) => ({
    label: unit.unitName,
    detail: unit.className,
    sortText: String(index).padStart(width, '0'),
    range: replaceRange,
    newText: insert(unit.unitName),
  }))
  items.push({
    label: 'null',
    detail: 'no unit',
    sortText: String(units.length).padStart(width, '0'),
    range: replaceRange,
    newText: insert('null'),
  })
  return items
}
