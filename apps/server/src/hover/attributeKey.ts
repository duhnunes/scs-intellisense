import { formatAttributeType } from '../completion/attributeKey'
import type {
  SchemaAttributeDef,
  SchemaFileContent,
} from '../interfaces/schemas'
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
  const lines: string[] = [
    `**${key}**: \`${type}\`${def.required ? ' — *required*' : ''}`,
  ]

  lines.push('')
  lines.push(def.description?.trim() || '*No description available yet.*')

  const extras = buildExtraLines(def)
  if (extras.length > 0) {
    lines.push('')
    lines.push(...extras)
  }

  if (def.versionNote) {
    lines.push('')
    lines.push(`⚠️ ${def.versionNote}`)
  }

  if (def.internalOnly) {
    lines.push('')
    lines.push(
      '⚠️ Engine/save-game managed — should not be set manually in a definition.'
    )
  }

  if (def.notes) {
    lines.push('')
    lines.push(def.notes)
  }

  return { markdown: lines.join('\n') }
}

function buildExtraLines(def: SchemaAttributeDef): string[] {
  const lines: string[] = []

  if (def.values && def.values.length > 0) {
    lines.push(`Valid values: ${def.values.map((v) => `\`${v}\``).join(', ')}`)
  }
  if (def.pointsTo && def.pointsTo.length > 0) {
    lines.push(`Points to: ${def.pointsTo.map((c) => `\`${c}\``).join(', ')}`)
  }
  if (def.expectedExtensions && def.expectedExtensions.length > 0) {
    lines.push(
      `Expected file extension(s): ${def.expectedExtensions.map((e) => `.${e}`).join(', ')}`
    )
  }

  return lines
}
