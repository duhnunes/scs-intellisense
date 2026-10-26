import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pathReferences } from '../src/index/filePaths'
import { moveEdits } from '../src/index/fileMoves'
import { WorkspaceIndex } from '../src/index/workspaceIndex'
import { normalizeSiiText } from '../src/sii'

// A sound bank is named with the event after '#': in a .sii
// (`scene_music: "/sound/music/scene.bank#scene/logo_ats"`, 494 in ATS
// 1.61) and in a .soundref (`source="/sound/.../x.bank#event"`, all 860).
const FILES: Record<string, string> = {
  'manifest.sii': '',
  'def/world/scene.sii': `SiiNunit
{
scene_data : .s {
  scene_music: "/sound/music/scene.bank#scene/logo_ats"
  sound: "ROY|/sound/music/scene.bank#scene/other"
}
}
`,
  'sound/truck/horn.soundref': 'source="/sound/music/scene.bank#horn/air"\r\n',
  'sound/music/scene.bank': '',
}

describe('sound banks', () => {
  let mod: string
  const index = new WorkspaceIndex()
  const at = (file: string) => join(mod, ...file.split('/'))
  const relative = (filePath: string) =>
    filePath.slice(mod.length + 1).replace(/\\/g, '/')

  beforeAll(async () => {
    mod = await mkdtemp(join(tmpdir(), 'scs-banks-test-'))
    for (const [file, text] of Object.entries(FILES)) {
      await mkdir(join(at(file), '..'), { recursive: true })
      await writeFile(at(file), text)
    }
    await index.scan([mod], () => false)
  })

  afterAll(async () => {
    await rm(mod, { recursive: true, force: true })
  })

  it('renames the bank in every path, keeping the event', () => {
    const edits = moveEdits(index, [
      { from: at('sound/music/scene.bank'), to: at('sound/music/intro.bank') },
    ])
      .map((edit) => {
        const text = normalizeSiiText(readFileSync(edit.file.filePath, 'utf8'))
        return `${relative(edit.file.filePath)}: ${text.slice(edit.range.start, edit.range.end)} -> ${edit.newText}`
      })
      .sort()
    expect(edits).toEqual([
      'def/world/scene.sii: /sound/music/scene.bank -> /sound/music/intro.bank',
      'def/world/scene.sii: /sound/music/scene.bank -> /sound/music/intro.bank',
      'sound/truck/horn.soundref: /sound/music/scene.bank -> /sound/music/intro.bank',
    ])
  })

  it('lists every path naming the bank', () => {
    expect(
      pathReferences(index, at('sound/music/scene.bank'))
        .map(({ file }) => relative(file.filePath))
        .sort()
    ).toEqual([
      'def/world/scene.sii',
      'def/world/scene.sii',
      'sound/truck/horn.soundref',
    ])
  })
})
