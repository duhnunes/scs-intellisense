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
  // Moved from the old src/sii/reader.regression.ts script. While a class
  // name is being typed (no ':' yet), the reader must still produce a
  // partial unit covering it, or live highlighting and className
  // completion stop working mid-typing.
  it('reads a class name being typed as a partial unit', () => {
    const prefix = 'SiiNunit\n{\n'
    const [unit] = readSiiDocument(`${prefix}class_name\n`).units
    expect(unit?.className).toBe('class_name')
    expect(unit?.classNameRange).toEqual({
      start: prefix.length,
      end: prefix.length + 'class_name'.length,
    })
  })

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

describe('reader: unit missing its closing brace', () => {
  const read = (text: string) => {
    const document = readSiiDocument(text)
    return {
      units: document.units.map(
        (unit) =>
          `${unit.unitName}: ${unit.attributes.map((a) => a.key).join(',')}`
      ),
      issues: document.issues.map(
        (issue) =>
          `${issue.message} @ ${document.text.slice(issue.range.start, issue.range.end)}`
      ),
    }
  }

  it('reports it, and still reads the next unit on its own', () => {
    expect(read(sii('a : x.y {\n  k: 1\nb : x.z {\n  j: 2\n}'))).toEqual({
      units: ['x.y: k', 'x.z: j'],
      issues: ["Expected '}' to close unit @ {"],
    })
  })

  it('finds the next header when its brace is on the next line', () => {
    expect(read(sii('a : x.y {\n  k: 1\nb : x.z\n{\n  j: 2\n}'))).toMatchObject(
      {
        units: ['x.y: k', 'x.z: j'],
      }
    )
  })

  it('points at the brace of the unit left open', () => {
    const text = sii('a : x.y {\n  k: 1\nb : x.z {\n}')
    const document = readSiiDocument(text)
    const [issue] = document.issues
    expect(issue?.range.start).toBe(text.indexOf('{', text.indexOf('x.y')))
  })

  it('does not mistake a brace inside a string for a unit', () => {
    expect(read(sii('a : x.y {\n  text: "{b}"\n  k: 1\n}'))).toEqual({
      units: ['x.y: text,k'],
      issues: [],
    })
  })

  it('reports a unit left open at the end of the file', () => {
    expect(read('SiiNunit\n{\na : x.y {\n  k: 1\n').issues).toContain(
      "Expected '}' to close unit @ {"
    )
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
