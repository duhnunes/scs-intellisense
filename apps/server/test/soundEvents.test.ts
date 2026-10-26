import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findAttributeValuePosition } from '../src/completion/attributeValue'
import {
  findSoundEventAt,
  listSoundEvents,
} from '../src/completion/soundEvents'
import { readSiiDocument } from '../src/sii'
import { sii } from './helpers'

/** The bank and the event typed so far, with the cursor at '^' ('|' is
 *  part of "name|/path"). */
function at(line: string) {
  const text = sii(`a : .b {\n${line.replace('^', '')}\n}`)
  const document = readSiiDocument(text)
  const offset = text.indexOf(line.split('^')[0]!) + line.indexOf('^')
  const position = findAttributeValuePosition(document, offset)
  const found = position && findSoundEventAt(position, document.text, offset)
  return (
    found && {
      bank: found.bank,
      typed: document.text.slice(found.range.start, found.range.end),
    }
  )
}

describe('sound events: where the cursor is', () => {
  it('finds a bank and its #', () => {
    expect(at('  scene_music: "/sound/music/scene.bank#^"')).toEqual({
      bank: '/sound/music/scene.bank',
      typed: '',
    })
    expect(at('  scene_music: "/sound/music/scene.bank#scene/lo^"')).toEqual({
      bank: '/sound/music/scene.bank',
      typed: 'scene/lo',
    })
  })

  it('finds it after a "name|" too', () => {
    expect(at('  sound: "ROY|/sound/world/semaphore.bank#sem^"')).toEqual({
      bank: '/sound/world/semaphore.bank',
      typed: 'sem',
    })
  })

  it('stays out of other values', () => {
    expect(at('  model: "/vehicle/truck/cab^"')).toBeUndefined()
    expect(at('  name: "a #^"')).toBeUndefined()
    expect(at('  scene_music: /sound/music/scene.bank#^')).toBeUndefined()
  })
})

describe('sound events: the list', () => {
  let mod: string
  beforeAll(async () => {
    mod = await mkdtemp(join(tmpdir(), 'scs-events-test-'))
    await writeFile(join(mod, 'manifest.sii'), '')
    await mkdir(join(mod, 'sound', 'music'), { recursive: true })
    await mkdir(join(mod, 'def'), { recursive: true })
    // As FMOD Studio writes it (base/sound/music/music.bank.guids).
    await writeFile(
      join(mod, 'sound', 'music', 'music.bank.guids'),
      '{6bccab1e-12d0-4bd9-8c32-4c4fb5a6f3c8} event:/music/delivery\r\n' +
        '{199421b9-03ea-4688-970e-75c22179db96} event:/music/garage\r\n' +
        '{a1b2c3d4-0000-0000-0000-000000000000} bus:/music\r\n'
    )
  })
  afterAll(async () => {
    await rm(mod, { recursive: true, force: true })
  })

  it('reads the events of the bank, not its buses', () => {
    expect(
      listSoundEvents(join(mod, 'def', 'x.sii'), '/sound/music/music.bank')
    ).toEqual(['music/delivery', 'music/garage'])
  })

  it("has nothing for a bank without .guids, as the game's", () => {
    expect(
      listSoundEvents(join(mod, 'def', 'x.sii'), '/sound/music/scene.bank')
    ).toEqual([])
  })
})
