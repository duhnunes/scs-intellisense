import { describe, expect, it } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDiagnostics } from '../src/diagnostic'
import { formatSiiDocument } from '../src/formatter/format'
import { provideSemanticTokensForDocument, tokenTypes } from '../src/semantic'
import { readScsDocument, readSiiDocument } from '../src/sii'
import { buildDocumentSymbols } from '../src/symbols/documentSymbols'
import { sii } from './helpers'

/** Decodes LSP's relative token encoding into "text=type" pairs. */
function semanticTokens(input: string): string[] {
  const text = input.replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  const { data } = provideSemanticTokensForDocument(input, 'file:///x.sii')
  const tokens: string[] = []
  let line = 0
  let char = 0
  for (let i = 0; i < data.length; i += 5) {
    const [deltaLine, deltaChar, length, type] = data.slice(i, i + 4) as [
      number,
      number,
      number,
      number,
    ]
    line += deltaLine
    char = deltaLine === 0 ? char + deltaChar : deltaChar
    tokens.push(
      `${lines[line]?.slice(char, char + length)}=${tokenTypes[type]}`
    )
  }
  return tokens
}

describe('semantic highlighting', () => {
  it('colors a plain className as a class', () => {
    expect(semanticTokens(sii('truck : x.y {\n}'))).toContain('truck=class')
  })

  it('colors the namespace separately and leaves "::" uncolored', () => {
    const tokens = semanticTokens(sii('ui::text : x.y {\n}'))
    expect(tokens).toContain('ui=namespace')
    expect(tokens).toContain('text=class')
    expect(tokens.some((token) => token.includes('::'))).toBe(false)
  })
})

describe('document symbols (Outline)', () => {
  it('names each unit by its unitName, with the className as detail', () => {
    const document = readSiiDocument(
      sii('ui::text : .t1 {\n}\ntruck : x.y {\n}')
    )
    const textDocument = TextDocument.create(
      'file:///x.sii',
      'sii',
      1,
      document.text
    )
    expect(
      buildDocumentSymbols(document, textDocument).map((symbol) => [
        symbol.name,
        symbol.detail,
      ])
    ).toEqual([
      ['.t1', 'ui::text'],
      ['x.y', 'truck'],
    ])
  })
})

describe('formatter', () => {
  const format = (input: string, braceStyle: '1tbs' | 'allman' = '1tbs') =>
    formatSiiDocument(readSiiDocument(input), { braceStyle })

  it('normalizes the header, indentation and spacing', () => {
    expect(format('SiiNunit\n{\nui::text:.t1\n{\nkey:   value\n}\n}\n')).toBe(
      'SiiNunit {\n  ui::text : .t1 {\n    key: value\n  }\n}\n'
    )
  })

  it('supports the allman brace style', () => {
    expect(format('SiiNunit {\na : x.y {\nk: 1\n}\n}\n', 'allman')).toBe(
      'SiiNunit\n{\n  a : x.y\n  {\n    k: 1\n  }\n}\n'
    )
  })

  it('keeps @include at column 0 and trailing comments on their line', () => {
    const formatted = format(
      'SiiNunit {\na : x.y {\n    k: 1 # note\n@include "in.sui"\n}\n}\n'
    )
    expect(formatted).toContain('    k: 1 # note\n')
    expect(formatted).toContain('\n@include "in.sui"\n')
  })

  it('keeps a header comment on the header line', () => {
    // ATS 1.61 base/unit/hookup/lights/highway_tunnel_light.sii
    const input =
      'SiiNunit\n{\nlight_source : highway.tunnel.light #omni\n{\n\ttype: point\n}\n}\n'
    expect(format(input)).toBe(
      'SiiNunit {\n  light_source : highway.tunnel.light { #omni\n    type: point\n  }\n}\n'
    )
    expect(format(input, 'allman')).toBe(
      'SiiNunit\n{\n  light_source : highway.tunnel.light #omni\n  {\n    type: point\n  }\n}\n'
    )
  })

  it('keeps a comment after the opening brace on that line', () => {
    for (const style of ['1tbs', 'allman'] as const) {
      const once = format(
        'SiiNunit\n{\na : x.y #head\n{ #brace\nk: 1\n}\n}\n',
        style
      )
      expect(format(once, style)).toBe(once)
    }
    expect(format('SiiNunit {\na : x.y { #brace\nk: 1\n}\n}\n')).toBe(
      'SiiNunit {\n  a : x.y { #brace\n    k: 1\n  }\n}\n'
    )
  })

  it('never wraps a .sui file in SiiNunit', () => {
    expect(
      formatSiiDocument(readScsDocument('a:x.y\n{\nk:    1\n}\n', 'sui'))
    ).toBe('a : x.y {\n  k: 1\n}\n')
  })

  it('keeps values verbatim, quotes included', () => {
    expect(format(sii('a : "x.y" {\ntext: "a   b"\n}'))).toContain(
      'a : "x.y" {\n    text: "a   b"\n'
    )
  })
})

describe('diagnostics on Windows line endings', () => {
  it('reports positions in the original document', () => {
    const crlf = 'SiiNunit\r\n{\r\na : ab..cd {\r\n}\r\n}\r\n'
    const [diagnostic] = getDiagnostics(
      TextDocument.create('file:///x.sii', 'sii', 1, crlf)
    )
    expect(diagnostic?.range).toEqual({
      start: { line: 2, character: 6 },
      end: { line: 2, character: 8 },
    })
  })
})
