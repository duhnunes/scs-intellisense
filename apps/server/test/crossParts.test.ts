import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URI } from 'vscode-uri'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listIncludeCandidates } from '../src/completion/includePath'
import { findPathRoots, relativeBases } from '../src/completion/modFiles'
import { pathAt, resolvePathRef } from '../src/index/filePaths'
import { moveEdits } from '../src/index/fileMoves'
import { WorkspaceIndex } from '../src/index/workspaceIndex'

// A mod in parts, all mounted on one "/": a relative @include in dlc_police/
// names a file in the same folder of base/, as ATS 1.61's DLCs do
// (dlc_oversize/def/vehicle/ai -> def/def/vehicle/ai/drivers_police.sui).
const FILES: Record<string, string> = {
  'manifest.sii': '',
  'base/def/vehicle/ai/drivers.sui': 'name: "driver"\n',
  'dlc_police/def/vehicle/ai/police.sii': `SiiNunit
{
traffic_vehicle : traffic.police {
  @include "drivers.sui"
}
}
`,
}

describe('relative paths across the parts of a mod', () => {
  let mod: string
  const index = new WorkspaceIndex()
  const at = (file: string) => join(mod, ...file.split('/'))
  const police = () => at('dlc_police/def/vehicle/ai/police.sii')

  beforeAll(async () => {
    mod = await mkdtemp(join(tmpdir(), 'scs-parts-test-'))
    for (const [file, text] of Object.entries(FILES)) {
      await mkdir(join(at(file), '..'), { recursive: true })
      await writeFile(at(file), text)
    }
    await index.scan([mod], () => false)
  })

  afterAll(async () => {
    await rm(mod, { recursive: true, force: true })
  })

  it("starts in the file's folder, then the same folder of the other parts", () => {
    expect(relativeBases(police(), findPathRoots(police()))).toEqual([
      at('dlc_police/def/vehicle/ai'),
      at('base/def/vehicle/ai'),
    ])
  })

  it('gives a fragment the class of a unit in another part', () => {
    const drivers = index.get(
      URI.file(at('base/def/vehicle/ai/drivers.sui')).toString()
    )!
    expect(index.classesOf(drivers)).toEqual(['traffic_vehicle'])
  })

  it('links the @include to the file in the other part', () => {
    const file = index.get(URI.file(police()).toString())!
    const ref = pathAt(file, file.document.getText().indexOf('drivers.sui'))!
    expect(resolvePathRef(file, ref)).toBe(
      at('base/def/vehicle/ai/drivers.sui')
    )
  })

  it("suggests the files of the other parts' same folder", async () => {
    const names = (await listIncludeCandidates(police(), '')).map((c) => c.name)
    expect(names).toContain('drivers.sui')
  })

  it('keeps the @include relative when that file is renamed', () => {
    const edits = moveEdits(index, [
      {
        from: at('base/def/vehicle/ai/drivers.sui'),
        to: at('base/def/vehicle/ai/drivers_police.sui'),
      },
    ]).map((edit) => edit.newText)
    expect(edits).toEqual(['drivers_police.sui'])
  })

  it('writes a "/" path when the file leaves the folder', () => {
    const edits = moveEdits(index, [
      {
        from: at('base/def/vehicle/ai/drivers.sui'),
        to: at('base/def/vehicle/drivers.sui'),
      },
    ]).map((edit) => edit.newText)
    expect(edits).toEqual(['/def/vehicle/drivers.sui'])
  })
})

describe('the game, extracted one folder per archive', () => {
  let game: string
  const at = (file: string) => join(game, ...file.split('/'))

  beforeAll(async () => {
    game = await mkdtemp(join(tmpdir(), 'scs-game-test-'))
    for (const file of [
      'base/font/sign/us_sign_e.font',
      'base/material/sign/frame/white_box.mat',
      'def/def/sign/board/info/mt_white_markers.sii',
      'dlc_arizona/def/def/sign/az.sii',
    ]) {
      await mkdir(join(at(file), '..'), { recursive: true })
      await writeFile(at(file), '')
    }
  })

  afterAll(async () => {
    await rm(game, { recursive: true, force: true })
  })

  it('mounts every archive on "/": the file\'s own first, then base', () => {
    expect(
      findPathRoots(at('def/def/sign/board/info/mt_white_markers.sii'))
    ).toEqual([at('def'), at('base'), at('dlc_arizona')])
  })

  it('finds the archive of a file with no def folder above it', () => {
    expect(findPathRoots(at('base/material/sign/frame/white_box.mat'))[0]).toBe(
      at('base')
    )
  })

  it('links a path to a file of another archive', () => {
    const index = new WorkspaceIndex()
    const sii = at('def/def/sign/board/info/mt_white_markers.sii')
    const uri = URI.file(sii).toString()
    index.setFromText(
      uri,
      'SiiNunit\n{\nsign_board : .b {\n  font_face: "/font/sign/us_sign_e.font"\n  material: "/material/sign/frame/white_box.mat"\n}\n}\n'
    )
    const file = index.get(uri)!
    const text = file.document.getText()
    // URIs give the drive letter in lowercase.
    const resolved = (needle: string) =>
      resolvePathRef(
        file,
        pathAt(file, text.indexOf(needle) + 2)!
      )?.toLowerCase()
    expect(resolved('/font/')).toBe(
      at('base/font/sign/us_sign_e.font').toLowerCase()
    )
    expect(resolved('/material/')).toBe(
      at('base/material/sign/frame/white_box.mat').toLowerCase()
    )
  })
})

describe('a mod without manifest.sii', () => {
  // Only the game extracted has def/def (the def.scs archive holds a def
  // folder); a mod has def/ right at its root.
  it('starts "/" at the folder holding def/', async () => {
    const mod = await mkdtemp(join(tmpdir(), 'scs-nomanifest-test-'))
    const file = join(mod, 'def', 'vehicle', 'truck.sii')
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, '')
    expect(findPathRoots(file)).toEqual([mod])
    await rm(mod, { recursive: true, force: true })
  })
})
