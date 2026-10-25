import type { Position } from 'vscode-languageserver-textdocument'

/**
 * Offset ↔ line/column for an indexed file, without its text. The index
 * holds every file of the open folders (152,087 in the extracted ATS 1.61:
 * 125 million characters), and needs the text only for this; the start of
 * each line is a fraction of it. Same answers as `TextDocument` for the
 * index's normalized text (LF line breaks), clamping included.
 */
export class LineMap {
  private readonly lineStarts: Uint32Array
  readonly length: number

  constructor(text: string) {
    let count = 1
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++
    this.lineStarts = new Uint32Array(count)
    let line = 1
    for (let i = 0; i < text.length; i++)
      if (text.charCodeAt(i) === 10) this.lineStarts[line++] = i + 1
    this.length = text.length
  }

  positionAt(offset: number): Position {
    const clamped = Math.max(0, Math.min(offset, this.length))
    let low = 0
    let high = this.lineStarts.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (this.lineStarts[middle]! > clamped) high = middle
      else low = middle + 1
    }
    const line = low - 1
    return { line, character: clamped - this.lineStarts[line]! }
  }

  offsetAt(position: Position): number {
    if (position.line >= this.lineStarts.length) return this.length
    if (position.line < 0) return 0
    const start = this.lineStarts[position.line]!
    const isLast = position.line + 1 === this.lineStarts.length
    // A column past the end stops before the line break.
    const end = isLast ? this.length : this.lineStarts[position.line + 1]! - 1
    return Math.max(start, Math.min(start + position.character, end))
  }
}
