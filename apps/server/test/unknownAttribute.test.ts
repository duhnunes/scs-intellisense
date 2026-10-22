import { describe, expect, it } from 'vitest'
import type { CodeActionParams } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDiagnostics } from '../src/diagnostic'
import { buildCodeActions } from '../src/diagnostic/codeActions'
import {
  suggestAttributeKey,
  validateAttributeKeys,
} from '../src/diagnostic/schemaRules'
import type {
  SchemaAttributeDef,
  SchemaFileContent,
} from '../src/interfaces/schemas'
import type { SiiSeverity } from '../src/interfaces/structure'
import { readSiiDocument } from '../src/sii'
import { sii } from './helpers'

const ALL: SiiSeverity[] = ['error', 'warning', 'information', 'hint']

function def(fields: Partial<SchemaAttributeDef> = {}): SchemaAttributeDef {
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

const wheel: SchemaFileContent = {
  meta: { version: '1.0.0', documentationStatus: 'undocumented' },
  scope: '',
  description: '',
  superclass: 'accessory_data',
  versionNote: null,
  allowsSiiNunitRoot: true,
  inheritsFrom: ['accessory_data'],
  key: {
    name: def(),
    price: def({ type: 'u32' }),
    unlock: def({ type: 'u32' }),
    suitable_for: def({ isArray: true }),
    roll_resistance: def({ type: 'float' }),
    sound_horn: def({ status: 'legacy' }),
    steam_inventory_id: def({ internalOnly: true }),
    wet_grip: def({ type: 'float' }),
    wet_grid: def({ type: 'float' }),
  },
}
const schemaFor = (className: string) =>
  className === 'accessory_wheel_data' ? wheel : undefined

const unit = (body: string, className = 'accessory_wheel_data') =>
  sii(`${className} : .a {\n${body}\n}`)

const unknownKeys = (input: string) => {
  const document = readSiiDocument(input)
  return validateAttributeKeys(document, schemaFor).map((issue) =>
    document.text.slice(issue.range.start, issue.range.end)
  )
}

describe('unknown attribute', () => {
  it('warns about a key the class does not have', () => {
    expect(unknownKeys(unit('name: "x"\nprcie: 10\nspeed: 3'))).toEqual([
      'prcie',
      'speed',
    ])
  })

  it('accepts array keys in both forms, legacy and internal-only keys', () => {
    expect(
      unknownKeys(
        unit(
          'suitable_for[]: "a"\nsuitable_for: 2\nsuitable_for[0]: "b"\nsound_horn: "x"\nsteam_inventory_id: 3'
        )
      )
    ).toEqual([])
  })

  it('underlines only the name, not the index', () => {
    expect(unknownKeys(unit('suitabel_for[1]: "a"'))).toEqual(['suitabel_for'])
  })

  it('says nothing for a class whose schema is not loaded', () => {
    expect(unknownKeys(unit('anything: 1', 'some_other_class'))).toEqual([])
  })

  it('is a warning, and only runs on an intact file', () => {
    const document = TextDocument.create(
      'file:///x.sii',
      'sii',
      1,
      unit('prcie: 10')
    )
    expect(getDiagnostics(document, ALL, schemaFor)).toEqual([
      expect.objectContaining({ code: 'unknown-attribute', severity: 2 }),
    ])
    const broken = TextDocument.create(
      'file:///x.sii',
      'sii',
      1,
      unit('prcie: 10\nname "x"')
    )
    expect(
      getDiagnostics(broken, ALL, schemaFor).map((d) => d.code)
    ).not.toContain('unknown-attribute')
  })
})

describe('unknown attribute: suggestion', () => {
  it.each([
    ['prcie', 'price'], // swapped letters
    ['pric', 'price'], // missing letter
    ['roll_resistence', 'roll_resistance'],
    ['unlok', 'unlock'],
    ['Name', 'name'],
  ])('suggests %s -> %s', (typed, expected) => {
    expect(suggestAttributeKey(typed, wheel)).toBe(expected)
  })

  it('suggests nothing when no key is close, or two are equally close', () => {
    expect(suggestAttributeKey('speed', wheel)).toBeUndefined()
    expect(suggestAttributeKey('wet_gri', wheel)).toBeUndefined()
  })

  it('prefers keys a modder should write', () => {
    expect(suggestAttributeKey('sound_hor', wheel)).toBe('sound_horn')
    expect(suggestAttributeKey('steam_inventory_ids', wheel)).toBe(
      'steam_inventory_id'
    )
  })

  it('offers the fix in the light bulb', () => {
    const input = unit('prcie: 10')
    const doc = TextDocument.create('file:///x.sii', 'sii', 1, input)
    const params: CodeActionParams = {
      textDocument: { uri: doc.uri },
      range: {
        start: doc.positionAt(0),
        end: doc.positionAt(input.length),
      },
      context: { diagnostics: getDiagnostics(doc, ALL, schemaFor) },
    }
    const [action] = buildCodeActions(doc, params, ALL, schemaFor)
    expect(action?.title).toBe('Change to "price"')
    expect(action?.isPreferred).toBe(true)
    expect(TextDocument.applyEdits(doc, action!.edit!.changes![doc.uri]!)).toBe(
      unit('price: 10')
    )
  })
})
