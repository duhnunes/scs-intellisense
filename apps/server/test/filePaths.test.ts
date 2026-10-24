import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URI } from 'vscode-uri'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pathAt, pathReferences, resolvePathRef } from '../src/index/filePaths'
import { WorkspaceIndex } from '../src/index/workspaceIndex'

// A mod split in parts: "/" is base/.
const FILES: Record<string, string> = {
  'manifest.sii': '',
  'base/def/vehicle/truck.sii': `SiiNunit
{
accessory_cabin_data : cab.truck {
  model: "/vehicle/truck/cabin.pmd"
  shadow: "/vehicle/share/shadow.tobj"
  sounds[]: "OY|/sound/horn.soundref"
  @include "parts/cab.sui"
}
}
`,
  'base/def/vehicle/truck_b.sii': `SiiNunit
{
accessory_cabin_data : cab.truck_b {
  model: "/vehicle/truck/cabin.pmd"
}
}
`,
  'base/def/vehicle/parts/cab.sui': 'name: "x"\n',
  'base/vehicle/truck/cabin.pmd': '',
  'base/vehicle/truck/cabin.tobj': 'map\t2d\tcabin.dds\n',
  'base/vehicle/truck/cabin.dds': '',
  'base/vehicle/truck/cabin.mat':
    'material : "eut2.dif" {\n\ttexture : "cabin.tobj"\n}\n',
  'base/sound/horn.soundref': '',
}

describe('paths: go to the file, and who uses it', () => {
  let mod: string
  const index = new WorkspaceIndex()
  const at = (file: string) => join(mod, ...file.split('/'))
  const indexed = (file: string) => index.get(URI.file(at(file)).toString())!
  /** The path at `needle` in `file`, and the file it resolves to. */
  const resolve = (file: string, needle: string) => {
    const entry = indexed(file)
    const ref = pathAt(entry, entry.document.getText().indexOf(needle) + 1)
    const target = ref && resolvePathRef(entry, ref)
    return target?.slice(mod.length + 1).replace(/\\/g, '/')
  }

  beforeAll(async () => {
    mod = await mkdtemp(join(tmpdir(), 'scs-paths-test-'))
    for (const [file, text] of Object.entries(FILES)) {
      await mkdir(join(at(file), '..'), { recursive: true })
      await writeFile(at(file), text)
    }
    await index.scan([mod], () => false)
  })

  afterAll(async () => {
    await rm(mod, { recursive: true, force: true })
  })

  it('resolves a "/" path from the mod part, after a "name|" too', () => {
    expect(resolve('base/def/vehicle/truck.sii', '/vehicle/truck')).toBe(
      'base/vehicle/truck/cabin.pmd'
    )
    expect(resolve('base/def/vehicle/truck.sii', '/sound/')).toBe(
      'base/sound/horn.soundref'
    )
  })

  it("resolves a relative @include from the file's folder", () => {
    expect(resolve('base/def/vehicle/truck.sii', 'parts/cab')).toBe(
      'base/def/vehicle/parts/cab.sui'
    )
  })

  it("has nowhere to go for a file the mod does not have (the game's)", () => {
    expect(resolve('base/def/vehicle/truck.sii', '/vehicle/share')).toBe(
      undefined
    )
  })

  it('lists every path naming the same file', () => {
    const users = (target: string) =>
      pathReferences(index, at(target))
        .map(
          ({ file, ref }) =>
            `${file.filePath.slice(mod.length + 1).replace(/\\/g, '/')}: ${ref.text}`
        )
        .sort()
    expect(users('base/vehicle/truck/cabin.pmd')).toEqual([
      'base/def/vehicle/truck.sii: /vehicle/truck/cabin.pmd',
      'base/def/vehicle/truck_b.sii: /vehicle/truck/cabin.pmd',
    ])
    // .mat and text .tobj files are users too.
    expect(users('base/vehicle/truck/cabin.tobj')).toEqual([
      'base/vehicle/truck/cabin.mat: cabin.tobj',
    ])
    expect(users('base/vehicle/truck/cabin.dds')).toEqual([
      'base/vehicle/truck/cabin.tobj: cabin.dds',
    ])
  })
})
