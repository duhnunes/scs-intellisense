import type { CommentRange, TokenEntry } from '@/src/interfaces/token'
import { tokenTypes } from '..'
import { queueToken } from '../helpers'

export function scanComments(
  text: string,
  textLength: number
): { ranges: CommentRange[]; tokens: TokenEntry[] } {
  const commentRanges: CommentRange[] = []
  const tokens: TokenEntry[] = []

  let i = 0
  const len = text.length
  let inSingle = false
  let inDouble = false
  let blockDepth = 0

  while (i < len) {
    const ch = text.charAt(i)
    const next = i + 1 < len ? text.charAt(i + 1) : ''

    // handle closing of block comment first (when inside any block depth)
    if (blockDepth > 0) {
      if (ch === '*' && next === '/') {
        const end = i + 2
        // close the last opened block comment only when depth reaches 0
        blockDepth--
        if (blockDepth === 0) {
          const last =
            commentRanges.length > 0
              ? commentRanges[commentRanges.length - 1]
              : undefined
          if (last && last.end === undefined) {
            last.end = end
          }
        }
        i += 2
        continue
      }
      i++
      continue
    }
    // handle string toogles (respect escapes) only when not inside block comment
    if (!inSingle && ch === '"' && text.charAt(i - 1) !== '\\') {
      inDouble = !inDouble
      i++
      continue
    }
    if (!inDouble && ch === "'" && text.charAt(i - 1) !== '\\') {
      inSingle = !inSingle
      i++
      continue
    }

    // If inside any string, skip comment detection
    if (inSingle || inDouble) {
      i++
      continue
    }

    // line comment //
    if (ch === '/' && next === '/') {
      const start = i
      i += 2
      while (i < len && text.charAt(i) !== '\n') i++
      const end = i
      commentRanges.push({ start, end })
      continue
    }

    // block comment /*
    if (ch === '/' && next === '*') {
      const start = i
      blockDepth++
      if (blockDepth === 1) {
        commentRanges.push({ start })
      }
      i += 2
      continue
    }

    // hash comment #
    if (ch === '#') {
      const start = i
      i++
      while (i < len && text.charAt(i) !== '\n') i++
      const end = i
      commentRanges.push({ start, end })
      continue
    }

    i++
  }

  // finalize any unterminated block comments: set end to text.length
  for (const cr of commentRanges) {
    if (cr.end === undefined) cr.end = len
  }

  // sort ranges by start
  commentRanges.sort((a, b) => a.start - b.start)

  const commentTokenIdx = tokenTypes.indexOf('comment')
  if (commentTokenIdx >= 0) {
    for (const cr of commentRanges) {
      const start = cr.start
      const end = typeof cr.end === 'number' ? cr.end : textLength
      if (start < end)
        queueToken(tokens, start, end, commentTokenIdx, textLength)
    }
  }

  return { ranges: commentRanges, tokens }
}
