import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { moveEdits } from '../src/index/fileMoves'
import { WorkspaceIndex } from '../src/index/workspaceIndex'
import { normalizeSiiText } from '../src/sii'

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
  // A .mat in the older format (relative) and the game's (nested, "/").
  'base/material/sign/welker.mat':
    'material : "eut2.dif" {\r\n\ttexture : "welker.tobj"\r\n\ttexture_name : "texture"\r\n}\r\n',
  'base/material/sign/board.mat':
    'effect : "eut2.dif.rfx" {\n\ttexture : "texture_base" {\n\t\tsource : "/material/sign/welker.tobj"\n\t}\n}\n',
  // A text .tobj (as SCS Blender Tools exports it) and a compiled one.
  'base/material/sign/welker.tobj':
    'map\t2d\twelker.dds\naddr\tclamp_to_edge\tclamp_to_edge\n',
  'base/material/sign/welker.dds': '',
  'base/material/sign/compiled.tobj':
    '\u0001\n\u0000\u0000/material/sign/welker.dds',
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
          `${e.file.filePath.slice(mod.length + 1).replace(/\\/g, '/')}: ${normalizeSiiText(readFileSync(e.file.filePath, 'utf8')).slice(e.range.start, e.range.end)} -> ${e.newText}`
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

  it('rewrites the textures of .mat and text .tobj files', () => {
    expect(
      edits([
        ['base/material/sign/welker.tobj', 'base/material/sign/welker_v2.tobj'],
      ])
    ).toEqual([
      'base/material/sign/board.mat: /material/sign/welker.tobj -> /material/sign/welker_v2.tobj',
      'base/material/sign/welker.mat: welker.tobj -> welker_v2.tobj',
    ])
    expect(
      edits([
        ['base/material/sign/welker.dds', 'base/material/sign/welker_a.dds'],
      ])
    ).toEqual(['base/material/sign/welker.tobj: welker.dds -> welker_a.dds'])
  })

  it("fixes a moved .tobj's own relative texture, and leaves binary .tobj alone", () => {
    expect(
      edits([
        ['base/material/sign/welker.tobj', 'base/material/other/welker.tobj'],
      ])
    ).toEqual([
      'base/material/sign/board.mat: /material/sign/welker.tobj -> /material/other/welker.tobj',
      'base/material/sign/welker.mat: welker.tobj -> /material/other/welker.tobj',
      'base/material/sign/welker.tobj: welker.dds -> /material/sign/welker.dds',
    ])
  })
})
