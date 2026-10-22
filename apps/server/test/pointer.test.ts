import { describe, expect, it } from 'vitest'
import { findAttributeValuePosition } from '../src/completion/attributeValue'
import { buildPointerCompletionItems } from '../src/completion/pointer'
import type { SchemaAttributeDef } from '../src/interfaces/schemas'
import { readScsDocument } from '../src/sii'
import { sii } from './helpers'

function def(fields: Partial<SchemaAttributeDef>): SchemaAttributeDef {
  return {
    description: '',
    type: 'owner_ptr',
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

// sign_template_text and _image inherit from sign_template_item.
const SUPER: Record<string, string> = {
  sign_template_text: 'sign_template_item',
  sign_template_image: 'sign_template_item',
}
const isKindOf = (className: string, target: string) => {
  for (let c: string | undefined = className; c; c = SUPER[c])
    if (c === target) return true
  return false
}

const UNITS = `sign_template_text : .text.0 {
}
sign_template_image : .image.0 {
}
sign_board : .board {
}`

/** Items at the "|" in a line of the sign_template unit, which comes first. */
function complete(line: string, fields: Partial<SchemaAttributeDef>) {
  const input = sii(`sign_template : my.sign {\n${line}\n}\n${UNITS}`)
  const offset = input.indexOf('|')
  const document = readScsDocument(input.replace('|', ''), 'sii')
  const position = findAttributeValuePosition(document, offset)!
  const items = buildPointerCompletionItems(
    position,
    def(fields),
    document,
    isKindOf
  )
  return {
    items,
    labels: items.map((item) => item.label),
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

describe('pointer completion', () => {
  it('lists the units of the expected class, subclasses included, then null', () => {
    const result = complete('  items[]: |', {
      pointsTo: ['sign_template_item'],
    })
    expect(result.labels).toEqual(['.text.0', '.image.0', 'null'])
    expect(result.items.map((i) => i.detail)).toEqual([
      'sign_template_text',
      'sign_template_image',
      'no unit',
    ])
  })

  it('lists every other unit of the file when the schema names no class', () => {
    expect(complete('  items[]: |', {}).labels).toEqual([
      '.text.0',
      '.image.0',
      '.board',
      'null',
    ])
  })

  it('never offers the unit itself', () => {
    expect(complete('  items[]: |', {}).labels).not.toContain('my.sign')
  })

  it('replaces what was typed, adding the space after the colon', () => {
    const fields = { type: 'link_ptr', pointsTo: ['sign_board'] }
    expect(complete('  board: .bo|', fields).picked('.board')).toBe(
      '  board: .board'
    )
    expect(complete('  board:|', fields).picked('.board')).toBe(
      '  board: .board'
    )
  })

  it('keeps the order of the file once sorted', () => {
    const { items } = complete('  items[]: |', {})
    const sorted = [...items].sort((a, b) =>
      a.sortText.localeCompare(b.sortText)
    )
    expect(sorted.map((i) => i.label)).toEqual(items.map((i) => i.label))
  })

  it('suggests nothing for other types', () => {
    expect(complete('  name: |', { type: 'string' }).labels).toEqual([])
  })
})
