import type {
  SchemaAttributeDef,
  SchemaFileContent,
} from '../interfaces/schemas'
import type { SiiDocument, SiiUnit } from '../interfaces/structure'

/**
 * If `offset` is a position where completing an attribute_key makes
 * sense, returns the unit whose body the cursor is in (so the caller
 * knows which class_name's schema to look up). Returns undefined
 * everywhere else — inside a value, inside the className/unitName part
 * of a header, or outside any unit entirely.
 */
export function findAttributeKeyPosition(
  document: SiiDocument,
  offset: number
): SiiUnit | undefined {
  for (const unit of document.units) {
    if (!isWithin(offset, unit.bodyRange)) continue

    for (const attribute of unit.attributes) {
      if (isWithin(offset, attribute.keyRange)) {
        // '@include' isn't a schema-driven key — nothing to suggest.
        return attribute.kind === 'include' ? undefined : unit
      }
      if (isWithin(offset, attribute.valueRange)) return undefined
      // Between key and value (the ':' itself, or trivia around it) —
      // same "gap = not a key position" rule className.ts uses.
      if (
        offset > attribute.keyRange.end &&
        offset < attribute.valueRange.start
      )
        return undefined
    }

    // Inside the body, but not on any existing attribute's key or value
    // — a blank line, or the start of a new attribute being typed.
    return unit
  }

  return undefined
}

function isWithin(
  offset: number,
  range: { start: number; end: number }
): boolean {
  return offset >= range.start && offset <= range.end
}

export interface AttributeKeyCompletionItem {
  label: string
  detail: string
  documentation: string | undefined
}

/**
 * Builds completion items from one class's already-fetched schema
 * content. The database isn't 100% populated yet, so this is
 * deliberately defensive: a missing/malformed `key` map just yields no
 * items rather than throwing.
 *
 * Deliberately does NOT filter out attribute keys already present on
 * the unit — whether a repeated key is valid depends on the array
 * conventions (`attr[]`, `attr[n]`) that are still being figured out,
 * so filtering here would mean guessing at a rule that isn't settled.
 */
export function buildAttributeKeyCompletionItems(
  schema: SchemaFileContent | undefined
): AttributeKeyCompletionItem[] {
  if (!schema?.key || typeof schema.key !== 'object') return []

  return Object.entries(schema.key).map(([key, def]) => ({
    label: key,
    detail: formatAttributeType(def),
    documentation: def.description || undefined,
  }))
}

export function formatAttributeType(def: SchemaAttributeDef): string {
  const types = def.isArray ? def.arrayElementType : def.type
  const joined = types && types.length > 0 ? types.join(' | ') : 'unknown'
  return def.isArray ? `${joined}[]` : joined
}
