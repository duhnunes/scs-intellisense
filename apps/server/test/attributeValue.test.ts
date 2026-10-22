import { describe, expect, it } from 'vitest'
import {
  buildAttributeValueCompletionItems,
  findAttributeValuePosition,
} from '../src/completion/attributeValue'
import type {
  SchemaAttributeDef,
  SchemaFileContent,
} from '../src/interfaces/schemas'
import { readScsDocument } from '../src/sii'
import { sii } from './helpers'

function attribute(fields: Partial<SchemaAttributeDef>): SchemaAttributeDef {
  return {
    description: '',
    type: 'string',
    isArray: false,
    values: null,
    pointsTo: null,
    status: 'active',
    default: null,
    expectedExtensions: null,
    required: false,
    versionNote: null,
    supportsLocalization: false,
    internalOnly: false,
    notes: '',
    ...fields,
  }
}

// part_type and electric_type as the live v3 accessory_addon_data.json has them.
const addon: SchemaFileContent = {
  meta: { version: '1.0.0', documentationStatus: 'wip' },
  scope: '',
  description: '',
  superclass: 'accessory_data',
  versionNote: null,
  allowsSiiNunitRoot: true,
  inheritsFrom: ['accessory_data'],
  key: {
    name: attribute({}),
    part_type: attribute({
      type: 'enum',
      values: ['unknown', 'factory', 'aftermarket', 'licensed'],
      default: 'unknown',
    }),
    electric_type: attribute({
      type: 'enum',
      isArray: true,
      values: ['vehicle', 'aux_light', 'vehicle_interior', 'vehicle_ignition'],
    }),
  },
}

/** Completes at the `|` in `body`, which goes inside a unit. */
function complete(body: string) {
  const input = sii(`accessory_addon_data : a.b {\n${body}\n}`)
  const offset = input.indexOf('|')
  const document = readScsDocument(input.replace('|', ''), 'sii')
  const position = findAttributeValuePosition(document, offset)
  if (!position) return undefined
  const items = buildAttributeValueCompletionItems(position, addon)
  return {
    labels: items.map((item) => item.label),
    items,
    /** The text after picking the first item. */
    picked(label: string) {
      const item = items.find((i) => i.label === label)!
      return (
        document.text.slice(0, item.range.start) +
        item.newText +
        document.text.slice(item.range.end)
      ).split('\n')[3]
    },
  }
}

describe('enum value completion', () => {
  it('lists the values in the schema order, marking the default', () => {
    const result = complete('  part_type: |')
    expect(result?.labels).toEqual([
      'unknown',
      'factory',
      'aftermarket',
      'licensed',
    ])
    expect(result?.items.map((i) => i.detail)).toEqual([
      'default',
      undefined,
      undefined,
      undefined,
    ])
    // Kept in order once VS Code sorts by sortText.
    const sorted = [...result!.items].sort((a, b) =>
      a.sortText.localeCompare(b.sortText)
    )
    expect(sorted.map((i) => i.label)).toEqual(result!.labels)
  })

  it('replaces what was typed so far', () => {
    expect(complete('  part_type: fa|')?.picked('factory')).toBe(
      '  part_type: factory'
    )
    expect(complete('  part_type: fa|ctry')?.picked('factory')).toBe(
      '  part_type: factory'
    )
  })

  it('adds the space after the colon when there is none', () => {
    expect(complete('  part_type:|')?.picked('factory')).toBe(
      '  part_type: factory'
    )
    expect(complete('  part_type:fa|')?.picked('factory')).toBe(
      '  part_type: factory'
    )
  })

  it('keeps the cursor inside the range when it is before the value', () => {
    const result = complete('  part_type: |  fa')
    const offset = sii('accessory_addon_data : a.b {\n  part_type: |').indexOf(
      '|'
    )
    expect(result?.items[0]?.range.start).toBe(offset)
    expect(result?.picked('factory')).toBe('  part_type: factory')
  })

  it('works on array elements', () => {
    expect(complete('  electric_type[]: |')?.labels).toContain('aux_light')
    expect(complete('  electric_type[0]: veh|')?.labels).toContain('vehicle')
  })

  // Some attributes are always quoted in the game files
  // (physics_toy_data.toy_type): the quotes the user typed stay.
  it('completes inside quotes, keeping them', () => {
    expect(complete('  part_type: "|"')?.picked('factory')).toBe(
      '  part_type: "factory"'
    )
    expect(complete('  part_type: "fa|')?.picked('factory')).toBe(
      '  part_type: "factory'
    )
    expect(complete('  part_type: "fac|tory"')?.picked('factory')).toBe(
      '  part_type: "factory"'
    )
  })

  it('is not a value position on the quotes themselves', () => {
    expect(complete('  part_type: |"factory"')).toBeUndefined()
    expect(complete('  part_type: "factory"|')).toBeUndefined()
  })

  it('suggests nothing for other types', () => {
    expect(complete('  name: |')?.labels).toEqual([])
    expect(complete('  unknown_key: |')?.labels).toEqual([])
  })

  it('is not a value position on the key, a blank line or a header', () => {
    expect(complete('  part_|type: factory')).toBeUndefined()
    expect(complete('  part_type: factory\n  |')).toBeUndefined()
    const input = sii('accessory_addon_|data : a.b {\n}').replace('|', '')
    const offset = sii('accessory_addon_|data').indexOf('|')
    expect(
      findAttributeValuePosition(readScsDocument(input, 'sii'), offset)
    ).toBeUndefined()
  })
})
