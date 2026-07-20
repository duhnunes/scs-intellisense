import type { SemanticTokensBuilder } from 'vscode-languageserver'
import type { TokenEntry } from '../interfaces/token'

// helper: calculates line starts
export function computeLineStarts(text: string) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}

// helper: offset -> {line, char} (uses binary search if file is large)
export function offsetToPosition(lineStarts: number[], offset: number) {
  let low = 0,
    high = lineStarts.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const midVal = lineStarts[mid] ?? Number.MAX_SAFE_INTEGER
    if (midVal <= offset) low = mid + 1
    else high = mid - 1
  }
  const line = Math.max(0, low - 1)
  const char = offset - (lineStarts[line] ?? 0)
  return { line, char }
}

// helper: push token(s) whithout crossing lines
export function pushTokenByRange(
  builder: SemanticTokensBuilder,
  lineStarts: number[],
  startOffset: number,
  endOffset: number,
  tokenTypeIndex: number,
  textLength: number
) {
  if (typeof startOffset !== 'number' || typeof endOffset !== 'number') return
  if (tokenTypeIndex == null || tokenTypeIndex < 0) return
  if (startOffset >= endOffset) return
  if (startOffset < 0) startOffset = 0
  if (endOffset > textLength) endOffset = textLength
  let cur = startOffset
  while (cur < endOffset) {
    const startPos = offsetToPosition(lineStarts, cur)
    const nextLineStart =
      startPos.line + 1 < lineStarts.length
        ? (lineStarts[startPos.line + 1] ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER
    // The line-feed is not part of a semantic token. The source passed to
    // this helper is normalized, so subtracting one excludes exactly it.
    const lineEndOffset =
      nextLineStart === Number.MAX_SAFE_INTEGER
        ? nextLineStart
        : nextLineStart - 1
    const chunkEnd = Math.min(endOffset, lineEndOffset)
    const length = chunkEnd - cur
    if (length > 0)
      builder.push(startPos.line, startPos.char, length, tokenTypeIndex, 0)
    cur = chunkEnd > cur ? chunkEnd : nextLineStart
  }
}

// helper: find all occurrences from substring between startOffset and endOffset
export function findAllOccurrences(
  text: string,
  substr: string,
  startOffset = 0,
  endOffset = text.length
) {
  const results: number[] = []
  if (!substr) return results
  let idx = text.indexOf(substr, startOffset)
  while (idx !== -1 && idx < endOffset) {
    results.push(idx)
    idx = text.indexOf(substr, idx + substr.length)
  }
  return results
}

// helper: check if a given [start, end] intersects any comment range
export function rangeIntersectsComments(
  commentRanges: { start: number; end?: number }[],
  start: number,
  end: number
) {
  if (!commentRanges || commentRanges.length === 0) return false

  let lo = 0,
    hi = commentRanges.length - 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const cr = commentRanges[mid]
    if (cr === undefined) break

    const crStart = cr.start
    const crEnd = typeof cr.end === 'number' ? cr.end : Number.MAX_SAFE_INTEGER

    if (end <= crStart) hi = mid - 1
    else if (start >= crEnd) lo = mid + 1
    else return true
  }
  return false
}

// helper: queueToken with validations
export function queueToken(
  tokens: TokenEntry[],
  start: number,
  end: number,
  tokenTypeIndex: number,
  textLength: number
) {
  if (typeof start !== 'number' || typeof end !== 'number') return
  if (tokenTypeIndex == null || tokenTypeIndex < 0) return
  if (start >= end) return
  if (start < 0) start = 0
  if (end > textLength) end = textLength
  tokens.push({ start, end, tokenTypeIndex })
}
