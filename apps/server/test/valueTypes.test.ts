import { describe, expect, it } from 'vitest'
import { validateValueTypes } from '../src/diagnostic/schemaRules'
import type {
  SchemaAttributeDef,
  SchemaFileContent,
} from '../src/interfaces/schemas'
import { readSiiDocument } from '../src/sii'
import { sii } from './helpers'

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

const schema: SchemaFileContent = {
  meta: { version: '1.0.0', documentationStatus: 'undocumented' },
  scope: '',
  description: '',
  superclass: '',
  versionNote: null,
  allowsSiiNunitRoot: true,
  inheritsFrom: [],
  key: {
    name: def(),
    weight: def({ type: 'float' }),
    price: def({ type: 's64' }),
    unlock: def({ type: 'uint' }),
    color: def({ type: 'float3' }),
    size: def({ type: 'uint2' }),
    enabled: def({ type: 'bool' }),
    points: def({ type: 'float2', isArray: true }),
    rotation: def({ type: 'quat' }),
  },
}
const schemaFor = (className: string) =>
  className === 'test_data' ? schema : undefined

/** Each problem as "value: code". */
const problems = (body: string) => {
  const document = readSiiDocument(sii(`test_data : .a {\n${body}\n}`))
  return validateValueTypes(document, schemaFor).map(
    (issue) =>
      `${document.text.slice(issue.range.start, issue.range.end)}: ${issue.code}`
  )
}

describe('value types', () => {
  it('accepts every way the game writes numbers', () => {
    expect(
      problems(
        [
          'weight: 1.5',
          'weight: 0',
          'weight: -88',
          'weight: +6',
          'weight: .9',
          'weight: 2e-6',
          'weight: -2.544443745e-014',
          'weight: 25.0f',
          'weight: &3f800000',
          'price: 18000',
          'price: -1',
          'price: 0x10DE',
          'unlock: nil',
          'unlock: 0x30ba39ed',
        ].join('\n')
      )
    ).toEqual([])
  })

  it('reports what is not a number', () => {
    expect(problems('weight: abc\nprice: "18000"\nunlock: none')).toEqual([
      'abc: invalid-number',
      '"18000": invalid-number',
      'none: invalid-number',
    ])
  })

  it('reports a fraction in a whole number, and a negative unsigned', () => {
    expect(problems('price: 1.5\nunlock: -5')).toEqual([
      '1.5: invalid-number',
      '-5: invalid-number',
    ])
  })

  it('accepts vectors as the game writes them', () => {
    expect(
      problems(
        [
          'color: (1.0, 1.0, 1.0)',
          'color: (&3e24a4a4, &3e24a4a4, &3e24a4a4)',
          'color: (0.0334f, 0.1296f, -0.0f)',
          'color: (&c0b00000, 0, &c110cccd)',
          'size: (1920, 1080)',
          'points[]: (0.2, 0.9)',
        ].join('\n')
      )
    ).toEqual([])
  })

  it('reports a vector with the wrong count or content', () => {
    expect(
      problems('color: (1, 2)\ncolor: 1.0\ncolor: (1, x, 3)\nsize: (1.5, 2)')
    ).toEqual([
      '(1, 2): invalid-vector',
      '1.0: invalid-vector',
      '(1, x, 3): invalid-vector',
      '(1.5, 2): invalid-vector',
    ])
  })

  it('accepts true, false, 0 and 1, quoted or not', () => {
    expect(
      problems(
        'enabled: true\nenabled: false\nenabled: 0\nenabled: 1\nenabled: "false"'
      )
    ).toEqual([])
    expect(problems('enabled: yes\nenabled: "on"')).toEqual([
      'yes: invalid-bool',
      '"on": invalid-bool',
    ])
  })

  it('leaves strings, quats, array counts and empty values alone', () => {
    expect(
      problems('name: 42\nrotation: (1; 0, 0, 0)\npoints: 3\nweight: ')
    ).toEqual([])
  })
})
