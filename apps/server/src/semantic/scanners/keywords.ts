import type { CommentRange, TokenEntry } from '@/src/interfaces/token'
import { tokenTypes } from '..'
import { queueToken, rangeIntersectsComments } from '../helpers'

export function scanKeywords(
  text: string,
  comments: CommentRange[],
  textLength: number
): TokenEntry[] {
  const tokens: TokenEntry[] = []
  const magicIndex = text.indexOf('SiiNunit')
  if (magicIndex !== -1) {
    const start = magicIndex
    const end = magicIndex + 'SiiNunit'.length
    if (!rangeIntersectsComments(comments, start, end)) {
      const idx = tokenTypes.indexOf('keyword')
      if (idx >= 0) queueToken(tokens, start, end, idx, textLength)
    }
  }

  return tokens
}
