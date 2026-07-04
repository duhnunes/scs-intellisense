import type { ParsedClass } from '@/src/interfaces/parser'
import { tokenTypes } from '..'
import {
  findAllOccurrences,
  queueToken,
  rangeIntersectsComments,
} from '../helpers'
import type { CommentRange, TokenEntry } from '@/src/interfaces/token'

export function scanClasses(
  text: string,
  classes: ParsedClass[],
  comments: CommentRange[],
  textLength: number
): TokenEntry[] {
  const tokens: TokenEntry[] = []
  const classTokenIdx = tokenTypes.indexOf('class')

  for (const cls of classes) {
    let searchStart = 0
    let searchEnd = text.length
    if (
      typeof cls.classNameStart === 'number' &&
      typeof cls.classNameEnd === 'number'
    ) {
      searchStart = cls.classNameStart
      searchEnd = cls.classNameEnd + 1
    } else if (
      cls.range &&
      typeof cls.range.start === 'number' &&
      typeof cls.range.end === 'number'
    ) {
      searchStart = cls.range.start
      searchEnd = cls.range.end
    } else if (cls.bodyStart !== undefined && cls.bodyEnd !== undefined) {
      searchStart = cls.bodyStart - 50
      if (searchStart < 0) searchStart = 0
      searchEnd = cls.bodyEnd + 50
      if (searchEnd > text.length) searchEnd = text.length
    }

    // className
    const occurrences = findAllOccurrences(
      text,
      cls.className,
      searchStart,
      searchEnd
    )
    if (classTokenIdx >= 0 && occurrences.length > 0) {
      for (const occ of occurrences) {
        if (occ >= 0 && occ + cls.className.length <= textLength) {
          const start = occ
          const end = occ + cls.className.length
          if (!rangeIntersectsComments(comments, start, end)) {
            queueToken(tokens, start, end, classTokenIdx, textLength)
          }
        }
      }
    }
  }

  return tokens
}
