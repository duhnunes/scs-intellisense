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
