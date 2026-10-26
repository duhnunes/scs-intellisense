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

describe('reader: attribute keys and values', () => {
  const attributes = (body: string) =>
    readSiiDocument(sii(`truck : .a {\n${body}\n}`)).units[0]!.attributes.map(
      (attribute) => {
        const text = sii(`truck : .a {\n${body}\n}`)
        return {
          key: attribute.key,
          keyText: text.slice(attribute.keyRange.start, attribute.keyRange.end),
          value: text.slice(
            attribute.valueRange.start,
            attribute.valueRange.end
          ),
        }
      }
    )

  it('leaves the spaces before ":" out of the key', () => {
    expect(attributes('base_color : (1, 2, 3)')).toEqual([
      { key: 'base_color', keyText: 'base_color', value: '(1, 2, 3)' },
    ])
  })

  it('keeps the brackets of an array key', () => {
    expect(attributes('items [2] : x')).toEqual([
      { key: 'items', keyText: 'items [2]', value: 'x' },
    ])
  })

  it('reads a quoted value from the line after the colon', () => {
    expect(attributes('n_pml:\n"<img src=a.mat>"\nwidth: 24')).toEqual([
      { key: 'n_pml', keyText: 'n_pml', value: '"<img src=a.mat>"' },
      { key: 'width', keyText: 'width', value: '24' },
    ])
  })

  it('keeps an empty value when the next line is another attribute', () => {
    expect(attributes('name:\nwidth: 24')).toEqual([
      { key: 'name', keyText: 'name', value: '' },
      { key: 'width', keyText: 'width', value: '24' },
    ])
  })
})

describe('reader: a value quote that never closes', () => {
  /** Issue codes, and each attribute as "key=value". */
  const read = (body: string) => {
    const document = readSiiDocument(sii(`a : .b {\n${body}\n}`))
    return {
      codes: document.issues.map((issue) => issue.code),
      values: document.units[0]?.attributes.map(
        (a) =>
          `${a.key}=${document.text.slice(a.valueRange.start, a.valueRange.end)}`
      ),
    }
  }

  it('reports the quote, and ends the value with its line', () => {
    expect(read('\tname: "Big Engine\n\tprice: 18000')).toEqual({
      codes: ['unclosed-value-quote'],
      values: ['name="Big Engine', 'price=18000'],
    })
  })

  it('does so when it is the last attribute of the unit', () => {
    expect(read('\tprice: 18000\n\tname: "Big Engine')).toEqual({
      codes: ['unclosed-value-quote'],
      values: ['price=18000', 'name="Big Engine'],
    })
  })

  it('does so when a later quote would close it', () => {
    expect(read('\tname: "Big Engine\n\tprice: 18000\n\tinfo[]: "x"')).toEqual({
      codes: ['unclosed-value-quote'],
      values: ['name="Big Engine', 'price=18000', 'info="x"'],
    })
  })

  // As in base/ui/template/button.ats.sii and
  // def/def/world/mover_action.base_vehicle.sii (ATS 1.61).
  it('keeps the strings the game writes over several lines', () => {
    expect(
      read(
        '\tn_pml: "<img src=/material/ui/white.mat><ret>\n<offset vshift=10>@@text@@\n</align>"\n\tbones: "bones:root;\nbones: base; bones:ik_arm"'
      ).codes
    ).toEqual([])
  })
})

describe('reader: where an unclosed quote is reported', () => {
  it('marks the whole text to the end of its line, like TypeScript', () => {
    const document = readSiiDocument(
      sii('a : .b {\n\tname: "Big Engine  \n\tprice: 1\n}')
    )
    const [issue] = document.issues
    expect(document.text.slice(issue!.range.start, issue!.range.end)).toBe(
      '"Big Engine'
    )
  })
})

describe('reader: where a missing { is reported', () => {
  const at = (input: string) => {
    const document = readSiiDocument(input)
    const issue = document.issues.find(
      (candidate) => candidate.code === 'missing-unit-open-brace'
    )!
    const line = document.text.slice(0, issue.range.start).split('\n').length
    return {
      line,
      after: document.text.slice(issue.range.start - 8, issue.range.start),
    }
  }

  it('stays on the line of the unit being typed, after its name', () => {
    expect(
      at(
        'SiiNunit\n{\nprefab_model : house.20\n\nprefab_model : house.21 {\n}\n}\n'
      )
    ).toEqual({ line: 3, after: 'house.20' })
  })

  it('still accepts the { on the next line', () => {
    expect(
      readSiiDocument('SiiNunit\n{\nprefab_model : house.20\n{\n}\n}\n').issues
    ).toEqual([])
  })
})
