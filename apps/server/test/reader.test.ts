import { describe, expect, it } from 'vitest'
import { readScsDocument, readSiiDocument } from '../src/sii'
import { sii } from './helpers'

function headers(input: string) {
  const document = readSiiDocument(input)
  return document.units.map((unit) => ({
    className: unit.className,
    namespace: unit.namespaceRange
      ? document.text.slice(unit.namespaceRange.start, unit.namespaceRange.end)
      : undefined,
    unitName: unit.unitName,
    attributes: unit.attributes.length,
  }))
}

describe('reader: unit headers', () => {
  it('reads a plain header', () => {
    expect(headers(sii('truck : vehicle.dummy.truck {\n  a: 1\n}'))).toEqual([
      {
        className: 'truck',
        namespace: undefined,
        unitName: 'vehicle.dummy.truck',
        attributes: 1,
      },
    ])
  })

  it('reads a header with no space before the colon', () => {
    expect(headers(sii('example: doing.includes {\n}'))[0]).toMatchObject({
      className: 'example',
      unitName: 'doing.includes',
    })
  })

  it('keeps the quotes of a quoted unit name', () => {
    expect(
      headers(sii('cfg : "icfg.steering.configured" {\n}'))[0]
    ).toMatchObject({ unitName: '"icfg.steering.configured"' })
  })
})

describe('reader: namespaced class names', () => {
  it('keeps "::" inside the className and records the namespace', () => {
    expect(headers(sii('ui::text : .t1 {\n  x: 1\n}'))).toEqual([
      {
        className: 'ui::text',
        namespace: 'ui',
        unitName: '.t1',
        attributes: 1,
      },
    ])
  })

  it('records everything before the last "::" as the namespace', () => {
    expect(headers(sii('a::b::c : .t1 {\n}'))[0]).toMatchObject({
      className: 'a::b::c',
      namespace: 'a::b',
    })
  })

  it('reads a run of colons as one className, so braces stay in sync', () => {
    const document = readSiiDocument(
      sii('a:::b : .t1 {\n  x: 1\n}\nok : .t2 {\n}')
    )
    expect(document.units.map((unit) => unit.className)).toEqual([
      'a:::b',
      'ok',
    ])
    expect(document.issues).toEqual([])
  })
})

describe('reader: .sui with bare attributes', () => {
  const read = (text: string) => {
    const document = readScsDocument(text, 'sui')
    return {
      units: document.units.map((unit) => unit.unitName),
      attributes: document.attributes.map((attribute) => attribute.key),
      includes: document.includes.map((include) => include.path),
      issues: document.issues.map((issue) => issue.message),
    }
  }

  it('reads a body fragment as top-level attributes', () => {
    expect(
      read(
        '@include "goal_bonus.sui"\n\n\tscore_success: 1100\n\tid: dir_change_b\n'
      )
    ).toEqual({
      units: [],
      attributes: ['score_success', 'id'],
      includes: ['goal_bonus.sui'],
      issues: [],
    })
  })

  it('still reads units, with the brace on the same or the next line', () => {
    expect(read('a : x.y {\n}\nb : x.z\n{\n}\n').units).toEqual(['x.y', 'x.z'])
  })

  it('reads array attributes and values containing braces', () => {
    expect(read('names[]: "a"\nnames[]: "b"\ntext: "{x}"\n')).toMatchObject({
      attributes: ['names', 'names', 'text'],
      issues: [],
    })
  })

  it('reads units and attributes side by side', () => {
    expect(read('k: 1\na : x.y {\n  v: 2\n}\n')).toMatchObject({
      units: ['x.y'],
      attributes: ['k'],
      issues: [],
    })
  })

  it('never reads bare attributes in a .sii', () => {
    expect(readSiiDocument(sii('k: 1')).attributes).toEqual([])
  })
})

describe('reader: missing colon recovery', () => {
  it('does not skip the opening quote of a quoted unit name', () => {
    const document = readSiiDocument(sii('x "ab.cd" {\n}'))
    expect(document.units[0]?.unitName).toBe('"ab.cd"')
  })

  it('keeps the body in sync after a namespaced class with no colon', () => {
    const document = readSiiDocument(sii('ui::text .a.b {\n  x: 1\n}'))
    expect(document.units).toHaveLength(1)
    expect(document.units[0]?.attributes).toHaveLength(1)
  })
})
