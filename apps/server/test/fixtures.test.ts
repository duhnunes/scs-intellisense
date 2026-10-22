import { describe, expect, it } from 'vitest'
import { formatSiiDocument } from '../src/formatter/format'
import { checkFormatting } from '../src/formatter/workspaceFormat'
import { readScsDocument } from '../src/sii'
import { fixture, problems } from './helpers'

/**
 * Excerpts of real ATS 1.60/1.61 files (see the comment at the top of
 * each). The game loads these, so any error or warning on them is a false
 * positive in the extension.
 */
const fixtures = [
  'quoted_unit_names.sii',
  'uppercase_unit_names.sii',
  'namespace_hcd.sii',
  'namespace_ui.sii',
  'bare_attributes_includes.sui',
  'bare_attributes_strings.sui',
  'value_on_next_line.sii',
  'space_before_colon.sii',
]

describe.each(fixtures)('real game file %s', (name) => {
  const text = fixture(name)
  const mode = name.endsWith('.sui') ? 'sui' : 'sii'

  it('has no errors or warnings', () => {
    expect(problems(text, mode)).toEqual([])
  })

  it('formats to a stable result without losing content', () => {
    const once = formatSiiDocument(readScsDocument(text, mode))
    const twice = formatSiiDocument(readScsDocument(once, mode))
    expect(twice).toBe(once)

    // Every non-whitespace character survives, in any order (a header
    // comment may move past the '{'). Characters, not words: `key :`
    // becomes `key:`, and `name:"x"` becomes `name: "x"`.
    const characters = (source: string) =>
      [...source.replace(/\s/g, '')].sort().join('')
    expect(characters(once)).toBe(characters(text))
  })

  it('passes the workspace formatter safety check', () => {
    expect(checkFormatting(text, mode).status).not.toBe('skipped')
  })
})
