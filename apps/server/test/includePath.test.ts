import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  findIncludePathAt,
  listIncludeCandidates,
} from '../src/completion/includePath'
import { findPathRoots } from '../src/completion/modFiles'
import { readScsDocument } from '../src/sii'
import { sii } from './helpers'

/** The include path at the "|" in `input` (the "|" is removed). */
function at(input: string, mode: 'sii' | 'sui' = 'sii') {
  const offset = input.indexOf('|')
  const text = input.slice(0, offset) + input.slice(offset + 1)
  const found = findIncludePathAt(readScsDocument(text, mode), offset)
  return (
    found && {
      typed: found.typed,
      segment: text.slice(found.segment.start, found.segment.end),
    }
  )
}

describe('@include path: where the cursor is', () => {
  it('finds a top-level include, with the quotes VS Code closes itself', () => {
    expect(at(sii('@include "|"'))).toEqual({ typed: '', segment: '' })
    expect(at(sii('@include "eut2/eu|"'))).toEqual({
      typed: 'eut2/eu',
      segment: 'eu',
    })
  })

  it('finds an include inside a unit body and in a .sui', () => {
    expect(at(sii('truck : .a {\n@include "parts/|"\n}'))).toEqual({
      typed: 'parts/',
      segment: '',
    })
    expect(at('speed: 1\n@include "a|"\n', 'sui')).toEqual({
      typed: 'a',
      segment: 'a',
    })
  })

  it('reads only the current line when the quote is never closed', () => {
    expect(at(sii('@include "eut2/|\ntruck : .a {\n}'))).toEqual({
      typed: 'eut2/',
      segment: '',
    })
  })

  it('is not in the path before the quote or after the closing quote', () => {
    expect(at(sii('@include |"a.sui"'))).toBeUndefined()
    expect(at(sii('@include "a.sui"|'))).toBeUndefined()
    expect(at(sii('truck : .a {\nname: "a|"\n}'))).toBeUndefined()
  })
})

describe('@include path: what is listed', () => {
  let mod: string
  let game: string
  let parted: string

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), 'scs-include-test-'))
    // A mod: manifest.sii at its root.
    mod = join(root, 'my_mod')
    await mkdir(join(mod, 'def', 'vehicle', 'parts'), { recursive: true })
    await writeFile(join(mod, 'manifest.sii'), '')
    await writeFile(join(mod, 'def', 'vehicle', 'truck.sii'), '')
    await writeFile(join(mod, 'def', 'vehicle', 'lights.sui'), '')
    await writeFile(join(mod, 'def', 'vehicle', 'Mirrors.SUI'), '')
    await writeFile(join(mod, 'def', 'vehicle', 'notes.txt'), '')
    await writeFile(join(mod, 'def', 'vehicle', 'parts', 'cab.sui'), '')
    await mkdir(join(mod, 'def', 'vehicle', '.git'))
    // The game's extracted files: archive folder "def", then "def/...".
    game = join(root, 'ATS_161', 'def')
    await mkdir(join(game, 'def', 'world'), { recursive: true })
    await writeFile(join(game, 'def', 'world', 'sign.sii'), '')
    // A mod split in parts (1.48+): manifest.sii next to base/ and dlc_*/,
    // each mounted on the same "/".
    parted = join(root, 'parted_mod')
    await mkdir(join(parted, 'base', 'def', 'vehicle'), { recursive: true })
    await mkdir(join(parted, 'dlc_arizona', 'def', 'vehicle'), {
      recursive: true,
    })
    await writeFile(join(parted, 'manifest.sii'), '')
    await writeFile(join(parted, 'base', 'def', 'vehicle', 'base.sui'), '')
    await writeFile(join(parted, 'base', 'def', 'vehicle', 'both.sui'), '')
    await writeFile(join(parted, 'dlc_arizona', 'def', 'vehicle', 'az.sui'), '')
    await writeFile(
      join(parted, 'dlc_arizona', 'def', 'vehicle', 'Both.sui'),
      ''
    )
  })

  afterAll(async () => {
    await rm(join(mod, '..'), { recursive: true, force: true })
  })

  const names = async (file: string, typed: string) =>
    (await listIncludeCandidates(file, typed))
      .map((c) => (c.isFolder ? `${c.name}/` : c.name))
      .sort()

  it('lists the .sui files and folders next to the file, any case, but not other files', async () => {
    const truck = join(mod, 'def', 'vehicle', 'truck.sii')
    expect(await names(truck, '')).toEqual([
      'Mirrors.SUI',
      'lights.sui',
      'parts/',
    ])
    expect(await names(truck, 'li')).toEqual([
      'Mirrors.SUI',
      'lights.sui',
      'parts/',
    ])
  })

  it('lists a subfolder once its name and "/" are typed', async () => {
    const truck = join(mod, 'def', 'vehicle', 'truck.sii')
    expect(await names(truck, 'parts/')).toEqual(['cab.sui'])
    expect(await names(truck, 'missing/')).toEqual([])
  })

  it('never offers the file itself', async () => {
    const lights = join(mod, 'def', 'vehicle', 'lights.sui')
    expect(await names(lights, '')).toEqual(['Mirrors.SUI', 'parts/'])
  })

  it('starts a "/" path at the mod root (the folder with manifest.sii)', async () => {
    const cab = join(mod, 'def', 'vehicle', 'parts', 'cab.sui')
    expect(findPathRoots(cab)).toEqual([mod])
    expect(await names(cab, '/def/vehicle/')).toEqual([
      'Mirrors.SUI',
      'lights.sui',
      'parts/',
    ])
  })

  it('starts a "/" path in every part of a mod split in base/ and dlc_*/', async () => {
    const file = join(parted, 'dlc_arizona', 'def', 'vehicle', 'truck.sii')
    expect(findPathRoots(file)).toEqual([
      join(parted, 'base'),
      join(parted, 'dlc_arizona'),
    ])
    // The same name in two parts shows once (base wins).
    expect(await names(file, '/def/vehicle/')).toEqual([
      'az.sui',
      'base.sui',
      'both.sui',
    ])
  })

  it('starts a "/" path above the nearest def folder in extracted game files', () => {
    expect(findPathRoots(join(game, 'def', 'world', 'sign.sii'))).toEqual([
      game,
    ])
  })
})
