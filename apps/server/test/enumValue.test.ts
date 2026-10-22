import { describe, expect, it } from 'vitest'
import type { CodeActionParams } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDiagnostics } from '../src/diagnostic'
import { buildCodeActions } from '../src/diagnostic/codeActions'
import {
  suggestEnumValue,
  validateEnumValues,
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

const PART_TYPES = ['unknown', 'factory', 'aftermarket', 'licensed']
const addon: SchemaFileContent = {
  meta: { version: '1.0.0', documentationStatus: 'undocumented' },
  scope: '',
  description: '',
  superclass: 'accessory_data',
  versionNote: null,
  allowsSiiNunitRoot: true,
  inheritsFrom: ['accessory_data'],
  key: {
    name: def(),
    part_type: def({ type: 'enum', values: PART_TYPES }),
    electric_type: def({
      type: 'enum',
      isArray: true,
      values: ['vehicle', 'aux_light', 'vehicle_interior', 'vehicle_ignition'],
    }),
    sub_mode: def({
      type: 'enum',
      values: Array.from({ length: 12 }, (_, i) => `mode_${i}`),
    }),
  },
}
const schemaFor = (className: string) =>
  className === 'accessory_addon_data' ? addon : undefined

const unit = (body: string) => sii(`accessory_addon_data : .a {\n${body}\n}`)

const invalid = (body: string) => {
  const document = readSiiDocument(unit(body))
  return validateEnumValues(document, schemaFor).map((issue) =>
    document.text.slice(issue.range.start, issue.range.end)
  )
}

describe('invalid enum value', () => {
  it('warns about a value the enum does not list', () => {
    expect(invalid('part_type: factroy\npart_type: factory')).toEqual([
      'factroy',
    ])
  })

  it('reads quoted values, underlining inside the quotes', () => {
    expect(invalid('part_type: "factory"\npart_type: "nope"')).toEqual(['nope'])
  })

  it('checks array elements in both forms', () => {
    expect(
      invalid('electric_type[]: vehicle\nelectric_type[1]: lights')
    ).toEqual(['lights'])
  })

  // The game writes some enums as numbers (tr_semaphore_profile.type: 12).
  it('accepts a number, and says nothing while the value is empty', () => {
    expect(invalid('part_type: 2\npart_type: -1\npart_type:')).toEqual([])
  })

  it('leaves other types alone, and values are case sensitive', () => {
    expect(invalid('name: whatever')).toEqual([])
    expect(invalid('part_type: Factory')).toEqual(['Factory'])
  })

  it('lists the expected values, cut short when there are many', () => {
    const document = readSiiDocument(unit('part_type: x\nsub_mode: y'))
    const [partType, subMode] = validateEnumValues(document, schemaFor)
    expect(partType?.message).toBe(
      'Invalid value "x" for part_type: expected unknown, factory, aftermarket, licensed'
    )
    expect(subMode?.message).toContain('mode_7... (4 more)')
  })

  it('is a warning, and only runs on an intact file', () => {
    const doc = (text: string) =>
      TextDocument.create('file:///x.sii', 'sii', 1, text)
    expect(
      getDiagnostics(doc(unit('part_type: factroy')), ALL, schemaFor)
    ).toEqual([
      expect.objectContaining({ code: 'invalid-enum-value', severity: 2 }),
    ])
    expect(
      getDiagnostics(
        doc(unit('part_type: factroy\nname "x"')),
        ALL,
        schemaFor
      ).map((d) => d.code)
    ).not.toContain('invalid-enum-value')
  })
})

describe('invalid enum value: quick fix', () => {
  it.each([
    ['factroy', 'factory'],
    ['aftermarkt', 'aftermarket'],
    ['Licensed', 'licensed'],
  ])('suggests %s -> %s', (typed, expected) => {
    expect(suggestEnumValue(typed, PART_TYPES)).toBe(expected)
  })

  it('suggests nothing when no value is close', () => {
    expect(suggestEnumValue('custom', PART_TYPES)).toBeUndefined()
  })

  it.each([
    ['part_type: factroy', 'part_type: factory'],
    ['part_type: "factroy"', 'part_type: "factory"'],
  ])('fixes %s in the light bulb', (body, fixed) => {
    const input = unit(body)
    const doc = TextDocument.create('file:///x.sii', 'sii', 1, input)
    const params: CodeActionParams = {
      textDocument: { uri: doc.uri },
      range: { start: doc.positionAt(0), end: doc.positionAt(input.length) },
      context: { diagnostics: getDiagnostics(doc, ALL, schemaFor) },
    }
    const [action] = buildCodeActions(doc, params, ALL, schemaFor)
    expect(action?.title).toBe('Change to "factory"')
    expect(action?.isPreferred).toBe(true)
    expect(TextDocument.applyEdits(doc, action!.edit!.changes![doc.uri]!)).toBe(
      unit(fixed)
    )
  })
})
