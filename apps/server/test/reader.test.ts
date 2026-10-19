import { describe, expect, it } from 'vitest'
import { readSiiDocument } from '../src/sii'
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
