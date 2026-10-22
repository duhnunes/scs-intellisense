import type { SchemaFileContent } from '../interfaces/schemas'
import type {
  SiiAttribute,
  SiiDocument,
  SiiRange,
  SiiUnit,
} from '../interfaces/structure'

export interface AttributeValuePosition {
  unit: SiiUnit
  attribute: SiiAttribute
  /** What a suggestion replaces: from the cursor, when it sits in the
   *  spaces before the value, or else the start of the value, to the
   *  value's end; inside the quotes for a quoted value. VS Code drops
   *  items whose range doesn't hold the cursor. */
  replaceRange: SiiRange
  quoted: boolean
}

/**
 * If `offset` is in an attribute's value (or right after its ':', before
 * anything is typed), returns that attribute and its unit. Undefined on
 * keys, headers, `@include`, outside any unit, and on the quotes of a
 * quoted value rather than inside them.
 */
export function findAttributeValuePosition(
  document: SiiDocument,
  offset: number
): AttributeValuePosition | undefined {
  for (const unit of document.units) {
    if (offset < unit.bodyRange.start || offset > unit.bodyRange.end) continue
    for (const attribute of unit.attributes) {
      if (attribute.kind !== 'attribute' || !attribute.colonRange) continue
      const { colonRange, valueRange } = attribute
      if (offset < colonRange.end || offset > valueRange.end) continue

      if (document.text[valueRange.start] !== '"') {
        return {
          unit,
          attribute,
          replaceRange: {
            start: Math.min(offset, valueRange.start),
            end: valueRange.end,
          },
          quoted: false,
        }
      }
      // An unclosed quote (still being typed) runs to the value's end.
      const start = valueRange.start + 1
      const closed =
        valueRange.end > start && document.text[valueRange.end - 1] === '"'
      const end = closed ? valueRange.end - 1 : valueRange.end
      if (offset < start || offset > end) return undefined
      return { unit, attribute, replaceRange: { start, end }, quoted: true }
    }
    return undefined
  }
  return undefined
}

export interface AttributeValueCompletionItem {
  label: string
  /** "default" on the value the game uses when the key is left out. */
  detail: string | undefined
  /** Keeps the schema's order (the game's), not alphabetical. */
  sortText: string
  /** What the item replaces: the value typed so far. */
  range: SiiRange
  /** The value, with a space first when the cursor is right after ':'. */
  newText: string
}

/**
 * The valid values of an `enum` attribute (or any attribute the schema
 * lists `values` for), from the class's already-fetched schema. Nothing
 * for other types.
 *
 * Inserted bare (`part_type: factory`), as 58,205 of the 59,057 such
 * values in the ATS 1.61 files are; the user's quotes, if typed, are
 * kept. A few attributes are always quoted there
 * (`physics_toy_data.toy_type`, `mover_action.type`); part_type is
 * written both ways, so the game reads both, at least for it.
 */
export function buildAttributeValueCompletionItems(
  position: AttributeValuePosition,
  schema: SchemaFileContent | undefined
): AttributeValueCompletionItem[] {
  const def = schema?.key?.[position.attribute.key]
  if (!def || !Array.isArray(def.values) || def.values.length === 0) return []

  const { attribute, replaceRange, quoted } = position
  const needsSpace = !quoted && replaceRange.start === attribute.colonRange?.end
  const width = String(def.values.length).length
  return def.values.map((value, index) => ({
    label: value,
    detail: value === def.default ? 'default' : undefined,
    sortText: String(index).padStart(width, '0'),
    range: replaceRange,
    newText: needsSpace ? ` ${value}` : value,
  }))
}
