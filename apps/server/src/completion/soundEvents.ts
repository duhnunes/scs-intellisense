import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { SiiRange } from '../interfaces/structure'
import type { AttributeValuePosition } from './attributeValue'
import { findPathRoots } from './modFiles'

/**
 * Completion of the event after a sound bank's '#'
 * (`scene_music: "/sound/music/scene.bank#scene/logo_ats"`).
 *
 * FMOD Studio writes, next to each bank, `<bank>.guids`: one line per
 * object, `{guid} event:/music/delivery` (wiki, Documentation/Engine/Sound).
 * Of the 1,354 `bank#event` in ATS 1.61, 1,352 name an event of that file.
 * Only the mod's own banks can be read: the game's are in its archives.
 */

export interface SoundEventPosition {
  /** The bank's path, as written (`/sound/music/scene.bank`). */
  bank: string
  /** The event typed so far, after the '#', which the chosen item
   *  replaces. Offsets into the normalized text. */
  range: SiiRange
}

/** The `bank#event` at the cursor, when `position` is inside a quoted
 *  value whose path, before the cursor, is a bank and a '#'. */
export function findSoundEventAt(
  position: AttributeValuePosition,
  text: string,
  offset: number
): SoundEventPosition | undefined {
  if (!position.quoted) return undefined
  const valueStart = position.replaceRange.start
  const beforeCursor = text.slice(valueStart, offset)
  if (beforeCursor.includes('\n')) return undefined
  const pathStart = beforeCursor.lastIndexOf('|') + 1
  const match = /^(\/[^#"]*\.bank)#([^"#]*)$/i.exec(
    beforeCursor.slice(pathStart)
  )
  if (!match) return undefined
  return {
    bank: match[1]!,
    range: { start: offset - match[2]!.length, end: offset },
  }
}

/** The events of `bank` (a "/" path), from its `.guids` in the first root
 *  of `filePath` that has it; empty when none does. */
export function listSoundEvents(filePath: string, bank: string): string[] {
  for (const root of findPathRoots(filePath)) {
    const guids = path.join(root, `${bank}.guids`)
    if (!existsSync(guids)) continue
    let text: string
    try {
      text = readFileSync(guids, 'utf8')
    } catch {
      return []
    }
    return [...text.matchAll(/event:\/(\S+)/g)].map((match) => match[1]!)
  }
  return []
}
