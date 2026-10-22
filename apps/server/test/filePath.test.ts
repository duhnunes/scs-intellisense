import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findAttributeValuePosition } from '../src/completion/attributeValue'
import {
  findFilePathAt,
  listFilePathCandidates,
} from '../src/completion/filePath'
import { readScsDocument } from '../src/sii'
import { sii } from './helpers'

/** The path at the "^" in a unit body line (the "^" is removed): "|"
 *  is part of some paths. */
function at(line: string) {
  const input = sii(`accessory_cabin_data : a.b {\n${line}\n}`)
  const offset = input.indexOf('^')
  const text = input.slice(0, offset) + input.slice(offset + 1)
  const document = readScsDocument(text, 'sii')
  const position = findAttributeValuePosition(document, offset)
  const found = position && findFilePathAt(position, document.text, offset)
  return (
    found && {
      typed: found.typed,
      segment: text.slice(found.segment.start, found.segment.end),
    }
  )
}

describe('file path: where the cursor is', () => {
  it('reads the path from its "/" to the cursor', () => {
    expect(at('  model: "/vehicle/tr^"')).toEqual({
      typed: '/vehicle/tr',
      segment: 'tr',
    })
    expect(at('  model: "/vehicle/^truck.pmd"')).toEqual({
      typed: '/vehicle/',
      segment: '',
    })
  })

  it('starts right after the opening quote, and after a "name|"', () => {
    expect(at('  model: "^"')).toEqual({ typed: '', segment: '' })
    expect(at('  sounds[]: "OY|/sound/wo^"')).toEqual({
      typed: '/sound/wo',
      segment: 'wo',
    })
  })

  it('is not a path without quotes, or one not starting with "/"', () => {
    expect(at('  model: /vehicle^')).toBeUndefined()
    expect(at('  model: "vehicle^"')).toBeUndefined()
  })
})

describe('file path: what is listed', () => {
  let mod: string
  let file: string

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), 'scs-filepath-test-'))
    mod = join(root, 'mod')
    const truck = join(mod, 'base', 'vehicle', 'truck')
    await mkdir(join(truck, 'interior'), { recursive: true })
    await mkdir(join(mod, 'base', 'def', 'vehicle'), { recursive: true })
    await writeFile(join(mod, 'manifest.sii'), '')
    await writeFile(join(truck, 'cabin.pmd'), '')
    await writeFile(join(truck, 'cabin.pmg'), '')
    await writeFile(join(truck, 'Cabin_LOD1.PMD'), '')
    await writeFile(join(truck, 'cabin.pmc'), '')
    file = join(mod, 'base', 'def', 'vehicle', 'cabin.sii')
  })

  afterAll(async () => {
    await rm(join(mod, '..'), { recursive: true, force: true })
  })

  const names = async (typed: string, extensions: string[]) =>
    (await listFilePathCandidates(file, typed, extensions))
      .map((c) => (c.isFolder ? `${c.name}/` : c.name))
      .sort()

  it('lists folders and the files with the expected extensions, any case', async () => {
    expect(await names('/vehicle/truck/', ['pmd'])).toEqual([
      'Cabin_LOD1.PMD',
      'cabin.pmd',
      'interior/',
    ])
    expect(await names('/vehicle/truck/', ['pmc', 'pmd'])).toContain(
      'cabin.pmc'
    )
  })

  it('starts at the mod part, not the folder with manifest.sii', async () => {
    expect(await names('', ['pmd'])).toEqual(['def/', 'vehicle/'])
    expect(await names('/missing/', ['pmd'])).toEqual([])
  })
})
