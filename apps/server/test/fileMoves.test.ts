import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { moveEdits } from '../src/index/fileMoves'
import { WorkspaceIndex } from '../src/index/workspaceIndex'

// A mod split in parts: manifest.sii next to base/, which is "/".
const FILES: Record<string, string> = {
  'manifest.sii': 'SiiNunit\n{\nmod_package : .p {\n}\n}\n',
  'base/def/vehicle/truck.sii': `SiiNunit
{
accessory_cabin_data : cab.truck {
  model: "/vehicle/truck/cabin.pmd"
  sounds[]: "OY|/sound/horn.soundref"
  shadow: "/vehicle/share/shadow.tobj"
  @include "parts/cab.sui"
}
}
`,
  'base/def/vehicle/parts/cab.sui': `@include "lights.sui"
`,
  'base/def/vehicle/parts/lights.sui': `name: "x"
`,
  'base/vehicle/truck/cabin.pmd': '',
  'base/sound/horn.soundref': '',
}

describe('updating paths when files move', () => {
  let mod: string
  const index = new WorkspaceIndex()
  const at = (file: string) => join(mod, ...file.split('/'))

  /** Each edit as "file: old -> new". */
  const edits = (moves: [string, string][]) =>
    moveEdits(
      index,
      moves.map(([from, to]) => ({ from: at(from), to: at(to) }))
    )
      .map(
        (e) =>
          `${e.file.filePath.slice(mod.length + 1).replace(/\\/g, '/')}: ${e.file.document.getText().slice(e.range.start, e.range.end)} -> ${e.newText}`
      )
      .sort()

  beforeAll(async () => {
    mod = await mkdtemp(join(tmpdir(), 'scs-moves-test-'))
    for (const [file, text] of Object.entries(FILES)) {
      await mkdir(join(at(file), '..'), { recursive: true })
      await writeFile(at(file), text)
    }
    await index.scan([mod], () => false)
  })

  afterAll(async () => {
    await rm(mod, { recursive: true, force: true })
  })

  it('rewrites a "/" path to a renamed file, from the mod part', () => {
    expect(
      edits([
        ['base/vehicle/truck/cabin.pmd', 'base/vehicle/truck/cabin_v2.pmd'],
      ])
    ).toEqual([
      'base/def/vehicle/truck.sii: /vehicle/truck/cabin.pmd -> /vehicle/truck/cabin_v2.pmd',
    ])
  })

  it('rewrites the paths into a moved folder', () => {
    expect(edits([['base/vehicle/truck', 'base/vehicle/w900']])).toEqual([
      'base/def/vehicle/truck.sii: /vehicle/truck/cabin.pmd -> /vehicle/w900/cabin.pmd',
    ])
  })

  it('keeps a "name|" before the path', () => {
    expect(
      edits([['base/sound/horn.soundref', 'base/sound/air_horn.soundref']])
    ).toEqual([
      'base/def/vehicle/truck.sii: /sound/horn.soundref -> /sound/air_horn.soundref',
    ])
  })

  it("rewrites the @include to a moved .sui, and the moved file's own", () => {
    expect(
      edits([['base/def/vehicle/parts/cab.sui', 'base/def/vehicle/cab.sui']])
    ).toEqual([
      'base/def/vehicle/parts/cab.sui: lights.sui -> parts/lights.sui',
      'base/def/vehicle/truck.sii: parts/cab.sui -> cab.sui',
    ])
  })

  it('writes a "/" path where a relative one would need "../"', () => {
    expect(
      edits([['base/def/vehicle/parts/cab.sui', 'base/def/other/cab.sui']])
    ).toEqual([
      'base/def/vehicle/parts/cab.sui: lights.sui -> /def/vehicle/parts/lights.sui',
      'base/def/vehicle/truck.sii: parts/cab.sui -> /def/other/cab.sui',
    ])
  })

  it('updates nothing for a file moved out of the mod, or a game file', () => {
    expect(
      edits([['base/vehicle/truck/cabin.pmd', '../elsewhere/cabin.pmd']])
    ).toEqual([])
    expect(
      edits([['base/vehicle/share/shadow.tobj', 'base/vehicle/shadow.tobj']])
    ).toEqual([
      'base/def/vehicle/truck.sii: /vehicle/share/shadow.tobj -> /vehicle/shadow.tobj',
    ])
    expect(edits([['base/textures/a.dds', 'base/textures/b.dds']])).toEqual([])
  })
})
