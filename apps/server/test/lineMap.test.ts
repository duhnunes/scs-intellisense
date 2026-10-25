import { TextDocument } from 'vscode-languageserver-textdocument'
import { describe, expect, it } from 'vitest'
import { LineMap } from '../src/index/lineMap'

// The index drops each file's text and keeps a LineMap: it must answer as
// TextDocument did, for the normalized text the index holds (LF only).
describe('LineMap', () => {
  const texts = [
    '',
    'one line',
    'SiiNunit\n{\na : .b {\n  k: 1\n}\n}\n',
    '\n\n\n',
    'no final newline\nlast',
  ]

  it('converts offsets like TextDocument', () => {
    for (const text of texts) {
      const map = new LineMap(text)
      const document = TextDocument.create('file:///x.sii', 'sii', 0, text)
      for (let offset = -2; offset <= text.length + 2; offset++)
        expect(map.positionAt(offset)).toEqual(document.positionAt(offset))
    }
  })

  it('converts positions like TextDocument, clamping past a line end', () => {
    for (const text of texts) {
      const map = new LineMap(text)
      const document = TextDocument.create('file:///x.sii', 'sii', 0, text)
      for (let line = 0; line <= 8; line++)
        for (let character = 0; character <= 12; character++)
          expect(map.offsetAt({ line, character })).toBe(
            document.offsetAt({ line, character })
          )
    }
  })
})
