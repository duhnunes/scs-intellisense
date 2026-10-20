import { describe, expect, it } from 'vitest'
import { formatRange } from '../src/formatter/rangeFormat'
import type { FormatterOptions } from '../src/formatter/format'

const TAB: Partial<FormatterOptions> = { indent: '\t' }

/** Selects the first occurrence of `selected`, runs Format Selection and
 *  returns the whole text after. */
function formatSelection(
  input: string,
  selected: string,
  options: Partial<FormatterOptions> & { mode?: 'sii' | 'sui' } = TAB
): string {
  const { mode = 'sii', ...formatterOptions } = options
  const start = input.indexOf(selected)
  if (start < 0) throw new Error(`"${selected}" not in input`)
  const result = formatRange(
    input,
    mode,
    { start, end: start + selected.length },
    { ...TAB, ...formatterOptions }
  )
  if (result.status !== 'changed') return input
  return (
    input.slice(0, result.edit.range.start) +
    result.edit.newText +
    input.slice(result.edit.range.end)
  )
}

/** The cursor right after `marker` (an empty selection). */
function formatAtCursor(input: string, marker: string): string {
  const at = input.indexOf(marker) + marker.length
  const result = formatRange(input, 'sii', { start: at, end: at }, TAB)
  if (result.status !== 'changed') return input
  return (
    input.slice(0, result.edit.range.start) +
    result.edit.newText +
    input.slice(result.edit.range.end)
  )
}

const messy = [
  'SiiNunit',
  '{',
  'truck : .a',
  '{',
  '      speed:10',
  '}',
  '',
  '',
  'truck : .b',
  '{',
  '   speed:   20',
  '}',
  '}',
  '',
].join('\n')

describe('Format Selection', () => {
  it('formats only the unit the selection touches', () => {
    expect(formatSelection(messy, 'speed:   20')).toBe(
      [
        'SiiNunit',
        '{',
        'truck : .a',
        '{',
        '      speed:10',
        '}',
        '',
        '',
        '\ttruck : .b {',
        '\t\tspeed: 20',
        '\t}',
        '}',
        '',
      ].join('\n')
    )
  })

  it('formats the unit under the cursor', () => {
    expect(formatAtCursor(messy, 'spee')).toBe(
      messy.replace(
        'truck : .a\n{\n      speed:10\n}',
        '\ttruck : .a {\n\t\tspeed: 10\n\t}'
      )
    )
  })

  it('formats every unit a selection spans, and the blank lines between them', () => {
    expect(
      formatSelection(messy, '.a\n{\n      speed:10\n}\n\n\ntruck : .b')
    ).toBe(
      [
        'SiiNunit',
        '{',
        '\ttruck : .a {',
        '\t\tspeed: 10',
        '\t}',
        '',
        '\ttruck : .b {',
        '\t\tspeed: 20',
        '\t}',
        '}',
        '',
      ].join('\n')
    )
  })

  it('follows the brace style and indent options', () => {
    expect(
      formatSelection(messy, 'speed:10', {
        braceStyle: 'allman',
        indent: '  ',
        indentUnits: false,
      })
    ).toBe(messy.replace('      speed:10', '  speed: 10'))
  })

  it('changes nothing when the selection touches no unit', () => {
    expect(formatSelection(messy, '\n\n\n')).toBe(messy)
    expect(formatSelection(messy, 'SiiNunit')).toBe(messy)
  })

  it('changes nothing in a file with structural issues', () => {
    const broken = messy.replace('speed:   20', 'speed   20')
    const start = broken.indexOf('speed:10')
    expect(
      formatRange(broken, 'sii', { start, end: start + 3 }, TAB)
    ).toMatchObject({ status: 'skipped', reason: 'structural' })
  })

  it('keeps a trailing comment on its line when only the comment is selected', () => {
    const input = 'SiiNunit\n{\ntruck : .a {\n speed: 1\n} # end\n}\n'
    expect(formatSelection(input, '# end')).toBe(
      'SiiNunit\n{\n\ttruck : .a {\n\t\tspeed: 1\n\t} # end\n}\n'
    )
  })

  it('changes nothing when the unit shares a line with something unselected', () => {
    const input = 'SiiNunit { truck : .a {\n speed: 1\n}\n}\n'
    expect(formatSelection(input, 'speed')).toBe(input)
  })

  it('formats selected bare attributes in a .sui file', () => {
    const input = 'speed:   10\n   mass: 20\nwidth:3\n'
    expect(formatSelection(input, 'mass', { mode: 'sui' })).toBe(
      'speed:   10\nmass: 20\nwidth:3\n'
    )
  })

  it('returns the smallest edit, so untouched lines aren’t replaced', () => {
    const input =
      'SiiNunit\n{\n\ttruck : .a {\n\t\tspeed:  1\n\t\tmass: 2\n\t}\n}\n'
    const start = input.indexOf('speed')
    const result = formatRange(input, 'sii', { start, end: start }, TAB)
    expect(result).toMatchObject({
      status: 'changed',
      edit: { newText: '' },
    })
  })
})
