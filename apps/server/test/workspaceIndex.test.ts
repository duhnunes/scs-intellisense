import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URI } from 'vscode-uri'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  findDefinitions,
  findReferences,
  nameAt,
  renameEdits,
  renameProblem,
  type Location,
} from '../src/index/navigation'
import { WorkspaceIndex, type PointerCheck } from '../src/index/workspaceIndex'

// Which keys are pointers, as the schema would say.
const POINTERS: Record<string, Record<string, { isArray: boolean }>> = {
  sign_template: { items: { isArray: true }, board: { isArray: false } },
}
const isPointer: PointerCheck = async (className, key, bracketed) => {
  const def = POINTERS[className]?.[key]
  return !!def && (bracketed || !def.isArray)
}

const FILES: Record<string, string> = {
  'def/sign/templates.sii': `SiiNunit
{
sign_template : sign.tmpl.a {
  items: 2
  items[0]: .item.0
  items[1]: sign.item.b
  board: "sign.board.x"
  name: "sign.board.x"
  @include "parts.sui"
}
sign_template_item : .item.0 {
}
}
`,
  'def/sign/parts.sui': `board: sign.board.x
`,
  'def/sign/items.sii': `SiiNunit
{
sign_template_item : sign.item.b {
}
sign_template_item : .item.0 {
}
}
`,
  'def/sign/boards.sii': `SiiNunit
{
sign_board : "sign.board.x" {
}
}
`,
  'def/sign/boards_dlc.sii': `SiiNunit
{
sign_board : sign.board.x {
}
}
`,
  '.git/ignored.sii': `SiiNunit
{
sign_board : sign.board.x {
}
}
`,
}

describe('workspace index', () => {
  let root: string
  const index = new WorkspaceIndex()
  const uri = (file: string) => URI.file(join(root, file)).toString()
  // The index keeps no text: a file's as on disk, or as the editor set it.
  const editorText = new Map<string, string>()
  // Keyed in lowercase: a path from a URI has the drive letter in lowercase.
  const textOf = (filePath: string) =>
    editorText.get(filePath.toLowerCase()) ?? readFileSync(filePath, 'utf8')
  /** Each location as "file: text at the range". */
  const show = (locations: Location[] | undefined) =>
    locations
      ?.map(
        (l) =>
          `${l.uri.slice(l.uri.lastIndexOf('/') + 1)}: ${textOf(l.file.filePath).slice(l.range.start, l.range.end)}`
      )
      .sort()

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'scs-index-test-'))
    for (const [file, text] of Object.entries(FILES)) {
      await mkdir(join(root, file, '..'), { recursive: true })
      await writeFile(join(root, file), text)
    }
    await index.scan([root], () => false)
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reads every .sii/.sui of the folders, but not hidden folders', () => {
    expect(index.size).toBe(5)
  })

  it('finds every definition of a name, quoted or not', () => {
    expect(
      show(
        findDefinitions(index, 'sign.board.x', uri('def/sign/templates.sii'))
      )
    ).toEqual(['boards.sii: sign.board.x', 'boards_dlc.sii: sign.board.x'])
  })

  it('keeps a nameless unit in its own file', () => {
    expect(
      show(findDefinitions(index, '.item.0', uri('def/sign/templates.sii')))
    ).toEqual(['templates.sii: .item.0'])
  })

  it('finds the pointers to a name, in .sui fragments too, but not counts or strings', async () => {
    expect(
      show(
        await findReferences(
          index,
          'sign.board.x',
          uri('def/sign/boards.sii'),
          isPointer,
          false
        )
      )
    ).toEqual(['parts.sui: sign.board.x', 'templates.sii: sign.board.x'])
    expect(
      show(
        await findReferences(
          index,
          '2',
          uri('def/sign/templates.sii'),
          isPointer,
          false
        )
      )
    ).toEqual([])
  })

  it('knows what is under the cursor', async () => {
    const file = index.get(uri('def/sign/templates.sii'))!
    const text = readFileSync(file.filePath, 'utf8')
    const at = (needle: string) =>
      nameAt(file, text.indexOf(needle) + 2, index, isPointer)
    expect(await at('sign.item.b')).toMatchObject({
      name: 'sign.item.b',
      isDefinition: false,
    })
    expect(await at('sign.tmpl.a')).toMatchObject({
      name: 'sign.tmpl.a',
      isDefinition: true,
    })
    // A string attribute with the same text isn't a pointer.
    const name = text.indexOf('name: "sign.board.x"') + 'name: "'.length + 2
    expect(await nameAt(file, name, index, isPointer)).toBeUndefined()
  })

  it('renames the definitions and every pointer, keeping quotes', async () => {
    expect(
      show(
        await renameEdits(
          index,
          'sign.board.x',
          'sign.board.y',
          uri('def/sign/boards.sii'),
          isPointer
        )
      )
    ).toEqual([
      'boards.sii: sign.board.x',
      'boards_dlc.sii: sign.board.x',
      'parts.sui: sign.board.x',
      'templates.sii: sign.board.x',
    ])
  })

  it('renames nothing when the name is not defined in the folders', async () => {
    expect(
      await renameEdits(
        index,
        'game.unit',
        'x.y',
        uri('def/sign/boards.sii'),
        isPointer
      )
    ).toBeUndefined()
  })

  it('follows edits from an open editor', () => {
    const file = uri('def/sign/items.sii')
    const text = 'SiiNunit\n{\nsign_template_item : sign.item.c {\n}\n}\n'
    index.setFromText(file, text)
    editorText.set(join(root, 'def/sign/items.sii').toLowerCase(), text)
    expect(show(findDefinitions(index, 'sign.item.c', file))).toEqual([
      'items.sii: sign.item.c',
    ])
    editorText.clear()
    index.refreshFromDisk(join(root, 'def/sign/items.sii'))
    expect(findDefinitions(index, 'sign.item.c', file)).toEqual([])
  })
})

describe('rename: the new name', () => {
  it.each(['sign.board.y', '.item.1', 'a_b.c9'])('accepts %s', (name) => {
    expect(renameProblem(name)).toBeUndefined()
  })

  it.each([
    ['', 'empty'],
    ['a..b', 'empty tokens'],
    ['a.b.', 'empty tokens'],
    ['a.waytoolongtoken', '12 characters'],
    ['a-b', 'invalid characters'],
    ['"a.b"', 'without quotes'],
  ])('refuses %s', (name, reason) => {
    expect(renameProblem(name)).toContain(reason)
  })
})

describe('fragment classes follow edits', () => {
  // Who includes a fragment is kept per file (classesOf() runs on every
  // edit of an open .sui): it must follow the includer's edits.
  const at = (file: string) => URI.file(join(tmpdir(), 'mod', file)).toString()
  const unit = (className: string, include: string) =>
    `SiiNunit\n{\n${className} : .u {\n@include "${include}"\n}\n}\n`

  it('updates when the including file changes or goes', () => {
    const index = new WorkspaceIndex()
    index.setFromText(at('def/parts.sui'), 'price: 1\n')
    const fragment = () => index.get(at('def/parts.sui'))!
    index.setFromText(
      at('def/a.sii'),
      unit('accessory_engine_data', 'parts.sui')
    )
    expect(index.classesOf(fragment())).toEqual(['accessory_engine_data'])

    index.setFromText(
      at('def/a.sii'),
      unit('accessory_cabin_data', 'parts.sui')
    )
    expect(index.classesOf(fragment())).toEqual(['accessory_cabin_data'])

    index.setFromText(
      at('def/a.sii'),
      unit('accessory_cabin_data', 'other.sui')
    )
    expect(index.classesOf(fragment())).toEqual([])

    index.setFromText(
      at('def/a.sii'),
      unit('accessory_cabin_data', 'parts.sui')
    )
    index.remove(URI.parse(at('def/a.sii')).fsPath)
    expect(index.classesOf(fragment())).toEqual([])
  })
})
