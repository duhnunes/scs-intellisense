import { describe, expect, it } from 'vitest'
import { diagnose, problems, sii } from './helpers'

const unit = (header: string) => sii(`${header} {\n}`)

describe('rules: className', () => {
  it.each(['truck', '_private', 'a1', 'ui::text', 'hcd::on_job', 'a::b::c'])(
    'accepts %s',
    (className) => {
      expect(problems(unit(`${className} : .a.b`))).toEqual([])
    }
  )

  it('flags only the invalid character', () => {
    expect(problems(unit('pref@b_model : .a.b'))).toEqual([
      expect.objectContaining({ text: '@' }),
    ])
  })

  it('flags a leading digit, in every "::" part', () => {
    expect(problems(unit('9truck : .a.b'))).toEqual([
      expect.objectContaining({
        message: 'className must not start with a digit',
        text: '9',
      }),
    ])
    expect(problems(unit('ui::9text : .a.b'))).toEqual([
      expect.objectContaining({ text: '9' }),
    ])
  })

  it.each(['::text', 'ui::', 'a::::b'])(
    'flags the empty part in %s',
    (className) => {
      expect(problems(unit(`${className} : .a.b`))).toEqual([
        expect.objectContaining({
          message: 'className must not have an empty part around "::"',
          text: '::',
        }),
      ])
    }
  )

  it('flags an invalid character inside a namespace', () => {
    expect(problems(unit('u-i::text : .a.b'))).toEqual([
      expect.objectContaining({ text: '-' }),
    ])
  })
})

describe('rules: unit name tokens', () => {
  it('accepts a regular and a nameless name', () => {
    expect(problems(unit('a : vehicle.dummy.truck'))).toEqual([])
    expect(problems(unit('a : .my_mod.nameless.unit'))).toEqual([])
  })

  it('flags a token over 12 characters', () => {
    expect(problems(unit('a : abc.abcdefghijklm'))).toEqual([
      expect.objectContaining({ text: 'abcdefghijklm' }),
    ])
  })

  it('flags invalid characters on the token that has them', () => {
    expect(problems(unit('a : ab-c.d'))).toEqual([
      expect.objectContaining({ text: 'ab-c' }),
    ])
  })

  it('flags consecutive dots', () => {
    expect(problems(unit('a : ab..cd'))).toEqual([
      expect.objectContaining({
        message: 'UnitName must not contain empty tokens (consecutive dots)',
        text: '..',
      }),
    ])
  })

  it('reports uppercase only as a hint', () => {
    expect(diagnose(unit('a : mover.flagUSsmaSi'))).toEqual([
      expect.objectContaining({ severity: 'hint', text: 'flagUSsmaSi' }),
    ])
  })
})

describe('rules: quoted unit names', () => {
  it('accepts one surrounding pair of quotes', () => {
    expect(diagnose(unit('a : "icfg.steering.configured"'))).toEqual([])
  })

  it('runs the token rules on the inside', () => {
    expect(problems(unit('a : "abc.abcdefghijklm"'))).toEqual([
      expect.objectContaining({ text: 'abcdefghijklm' }),
    ])
    expect(problems(unit('a : "ab-c.d"'))).toEqual([
      expect.objectContaining({ text: 'ab-c' }),
    ])
    expect(problems(unit('a : "ab."'))).toEqual([
      expect.objectContaining({ text: '.' }),
    ])
  })

  it.each(['"ab.cd', 'ab.cd"', '"'])(
    'flags the unmatched quote in %s',
    (name) => {
      expect(problems(unit(`a : ${name}`))).toEqual([
        expect.objectContaining({
          message: 'Unmatched double quote in unitName',
          text: '"',
        }),
      ])
    }
  )

  it('flags empty quotes', () => {
    expect(problems(unit('a : ""'))).toEqual([
      expect.objectContaining({ message: 'UnitName must not be empty' }),
    ])
  })
})

describe('rules: duplicate unit names', () => {
  const duplicates = (input: string) =>
    problems(input).filter((issue) => issue.message.startsWith('Duplicate'))

  it('flags every unit that shares a name', () => {
    expect(duplicates(sii('a : x.y {\n}\nb : x.y {\n}'))).toEqual([
      expect.objectContaining({
        message: 'Duplicate unit name "x.y" — used by 2 units in this file',
      }),
      expect.objectContaining({ text: 'x.y' }),
    ])
  })

  it('flags duplicate nameless units too', () => {
    expect(
      duplicates(sii('a : .x.names {\n}\nb : .x.names {\n}'))
    ).toHaveLength(2)
    expect(duplicates(sii('a : ".x.n" {\n}\nb : ".x.n" {\n}'))).toHaveLength(2)
  })

  it('does not show the quotes twice in the message', () => {
    expect(duplicates(sii('a : "x.y" {\n}\nb : "x.y" {\n}'))[0]?.message).toBe(
      'Duplicate unit name "x.y" — used by 2 units in this file'
    )
  })

  it('treats a quoted and an unquoted name as different (unconfirmed in-game)', () => {
    expect(duplicates(sii('a : "x.y" {\n}\nb : x.y {\n}'))).toEqual([])
  })

  it('does not flag distinct names', () => {
    expect(duplicates(sii('a : .x.names {\n}\nb : .y.names {\n}'))).toEqual([])
  })
})

describe('rules: @include placement', () => {
  it('accepts @include at column 0, in a body and at the top level', () => {
    expect(
      problems(sii('@include "top.sui"\na : x.y {\n@include "in.sui"\n}'))
    ).toEqual([])
  })

  it('flags an indented @include', () => {
    expect(problems(sii('a : x.y {\n  @include "in.sui"\n}'))).toEqual([
      expect.objectContaining({
        message:
          '@include must be at the start of a new line with no leading whitespace',
      }),
    ])
  })
})

describe('rules: trailing newline', () => {
  it('warns when the file does not end with a newline', () => {
    expect(problems('SiiNunit\n{\n}')).toEqual([
      expect.objectContaining({ severity: 'warning', text: '}' }),
    ])
  })
})
