import { describe, expect, it } from 'vitest'
import { formatSiiDocument } from '../src/formatter/format'
import { readSiiDocument } from '../src/sii'
import { fixture, problems } from './helpers'

/**
 * Excerpts of real ATS 1.60 files (see the comment at the top of each).
 * The game loads these, so any error or warning on them is a false
 * positive in the extension.
 */
const fixtures = [
  'quoted_unit_names.sii',
  'uppercase_unit_names.sii',
  'namespace_hcd.sii',
  'namespace_ui.sii',
]

describe.each(fixtures)('real game file %s', (name) => {
  const text = fixture(name)

  it('has no errors or warnings', () => {
    expect(problems(text)).toEqual([])
  })

  it('formats to a stable result without losing content', () => {
    const once = formatSiiDocument(readSiiDocument(text))
    const twice = formatSiiDocument(readSiiDocument(once))
    expect(twice).toBe(once)

    const words = (source: string) => source.split(/\s+/).filter(Boolean).sort()
    expect(words(once)).toEqual(words(text))
  })
})
