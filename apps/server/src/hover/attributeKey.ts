import { formatAttributeType } from '../completion/attributeKey'
import type { SchemaFileContent } from '../interfaces/schemas'
import type { SiiDocument } from '../interfaces/structure'

/**
 * Returns { className, key } for the attribute whose keyRange contains
 * `offset`, or undefined everywhere else — inside a value, on
 * '@include' (not a schema-driven key, nothing to look up), on a blank
 * line in the body, or outside any unit entirely.
 *
 * Deliberately narrower than completion/attributeKey.ts's
 * findAttributeKeyPosition(): that one also cares about positions where
 * a NEW key could be typed. Hover only cares whether there's an
 * EXISTING key directly under the cursor — same reasoning as
 * hover/className.ts's findClassNameAtPosition() vs. isClassNamePosition().
 */
export function findAttributeKeyAtPosition(
  document: SiiDocument,
  offset: number
): { className: string; key: string } | undefined {
  for (const unit of document.units) {
    if (!isWithin(offset, unit.bodyRange)) continue

    for (const attribute of unit.attributes) {
      if (attribute.kind === 'include') continue
      if (isWithin(offset, attribute.keyRange)) {
        return { className: unit.className, key: attribute.key }
      }
    }

    return undefined
  }

  return undefined
}

function isWithin(
  offset: number,
  range: { start: number; end: number }
): boolean {
  return offset >= range.start && offset <= range.end
}

export interface AttributeKeyHoverContent {
  markdown: string
}

/**
 * Same "say nothing rather than guess" reasoning as
 * hover/className.ts's buildClassNameHover(): if the key isn't in the
 * class's schema, that could mean a typo OR just an attribute that
 * hasn't been documented yet — no way to tell which, so no hover is
 * shown rather than risking a wrong claim either way.
 */
export function buildAttributeKeyHover(
  key: string,
  schema: SchemaFileContent | undefined
): AttributeKeyHoverContent | undefined {
  const def = schema?.key?.[key]
  if (!def) return undefined

  const type = formatAttributeType(def)
  const description = def.description?.trim()

  return {
    markdown: description
      ? `**${key}**: \`${type}\`\n\n${description}`
      : `**${key}**: \`${type}\`\n\n*No description available yet.*`,
  }
}
