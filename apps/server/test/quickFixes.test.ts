import { describe, expect, it } from 'vitest'
import type { CodeActionParams } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDiagnostics } from '../src/diagnostic'
import { buildCodeActions } from '../src/diagnostic/codeActions'
import type { SiiSeverity } from '../src/interfaces/structure'
import { sii } from './helpers'

const ALL: SiiSeverity[] = ['error', 'warning', 'information', 'hint']

/** The quick fixes VS Code would list for `input`, through the same LSP
 *  layer the server uses. Without `at`, the whole file is selected. */
function quickFixes(
  input: string,
  options: { uri?: string; at?: string; only?: string[] } = {}
) {
  const uri = options.uri ?? 'file:///x.sii'
  const doc = TextDocument.create(uri, 'sii', 1, input)
  const start = options.at ? input.indexOf(options.at) : 0
  const end = options.at ? start + options.at.length : input.length
  const params: CodeActionParams = {
    textDocument: { uri },
    range: { start: doc.positionAt(start), end: doc.positionAt(end) },
    context: {
      diagnostics: getDiagnostics(doc, ALL),
      ...(options.only ? { only: options.only } : {}),
    },
  }
  const actions = buildCodeActions(doc, params, ALL)
  return {
    titles: actions.map((action) => action.title),
    actions,
    /** The text after applying the fix with this title. */
    apply(title: string): string {
      const action = actions.find((candidate) => candidate.title === title)
      if (!action) throw new Error(`No quick fix "${title}"`)
      return TextDocument.applyEdits(doc, action.edit!.changes![uri]!)
    },
  }
}

const codesOf = (input: string, uri = 'file:///x.sii') =>
  getDiagnostics(TextDocument.create(uri, 'sii', 1, input), ALL).map(
    (diagnostic) => diagnostic.code
  )

describe('quick fixes', () => {
  it('adds the missing final newline, with the file’s own line break', () => {
    const fixed = quickFixes('SiiNunit\n{\n}').apply(
      'Add a newline at the end of the file'
    )
    expect(fixed).toBe('SiiNunit\n{\n}\n')
    expect(codesOf(fixed)).toEqual([])

    expect(
      quickFixes('SiiNunit\r\n{\r\n}').apply(
        'Add a newline at the end of the file'
      )
    ).toBe('SiiNunit\r\n{\r\n}\r\n')
  })

  it('moves an indented @include to the start of its line', () => {
    const input = sii('  @include "a.sui"')
    const fixed = quickFixes(input).apply(
      'Move @include to the start of the line'
    )
    expect(fixed).toBe(sii('@include "a.sui"'))
    expect(codesOf(fixed)).toEqual([])
  })

  it('moves an @include that follows other content to its own line', () => {
    const input = sii('truck : .a { @include "b.sui"\n}')
    const fixed = quickFixes(input).apply('Move @include to its own line')
    expect(fixed).toBe(sii('truck : .a {\n@include "b.sui"\n}'))
    expect(codesOf(fixed)).toEqual([])
  })

  it.each([
    ['truck : x..y {\n}', 'Replace ".." with "."', 'truck : x.y {\n}'],
    ['truck : x...y {\n}', 'Replace "..." with "."', 'truck : x.y {\n}'],
    ['truck : x.y. {\n}', 'Remove the trailing "."', 'truck : x.y {\n}'],
    ['truck : x.y.. {\n}', 'Remove the trailing ".."', 'truck : x.y {\n}'],
    ['truck : ..x {\n}', 'Replace ".." with "."', 'truck : .x {\n}'],
    ['truck : "x..y" {\n}', 'Replace ".." with "."', 'truck : "x.y" {\n}'],
  ])('fixes the empty token in %j', (body, title, expected) => {
    const result = quickFixes(sii(body))
    expect(result.titles).toEqual([title])
    const fixed = result.apply(title)
    expect(fixed).toBe(sii(expected))
    expect(codesOf(fixed)).toEqual([])
  })

  it('offers both fixes for an unmatched quote, and prefers neither', () => {
    const result = quickFixes(sii('truck : "x.y {\n}'))
    expect(result.titles).toEqual([
      'Add the missing closing quote',
      'Remove the quote',
    ])
    expect(result.actions.some((action) => action.isPreferred)).toBe(false)
    expect(result.apply('Add the missing closing quote')).toBe(
      sii('truck : "x.y" {\n}')
    )
    expect(result.apply('Remove the quote')).toBe(sii('truck : x.y {\n}'))

    expect(
      quickFixes(sii('truck : x.y" {\n}')).apply(
        'Add the missing opening quote'
      )
    ).toBe(sii('truck : "x.y" {\n}'))
  })

  it('adds the missing colon between class name and unit name', () => {
    const fixed = quickFixes(sii('prefab_model prefab.house {\n}')).apply(
      "Add ':' between the class name and the unit name"
    )
    expect(fixed).toBe(sii('prefab_model : prefab.house {\n}'))
    expect(codesOf(fixed)).toEqual([])
  })

  it('replaces a stray character where the unit colon belongs', () => {
    const fixed = quickFixes(sii('prefab_model ; prefab.house {\n}')).apply(
      `Replace ";" with ':'`
    )
    expect(fixed).toBe(sii('prefab_model : prefab.house {\n}'))
    expect(codesOf(fixed)).toEqual([])
  })

  it.each([
    ['speed 10', "Add ':' after the attribute key", 'speed: 10'],
    ['speed  10', "Add ':' after the attribute key", 'speed:  10'],
    ['speed = 10', "Replace '=' with ':'", 'speed: 10'],
    ['speed=10', "Replace '=' with ':'", 'speed:10'],
  ])('fixes the missing attribute colon in %j', (line, title, expected) => {
    const fixed = quickFixes(sii(`truck : .a {\n${line}\n}`)).apply(title)
    expect(fixed).toBe(sii(`truck : .a {\n${expected}\n}`))
    expect(codesOf(fixed)).toEqual([])
  })

  it('offers nothing where the right fix is a guess', () => {
    // Uppercase: the game loads it, and other files may use the name.
    expect(quickFixes(sii('truck : .a.B {\n}')).titles).toEqual([])
    // A key alone on its line may not be an attribute at all.
    expect(quickFixes(sii('truck : .a {\nspeed\n}')).titles).toEqual([])
    // Where a missing '}' goes can't be known.
    expect(quickFixes('SiiNunit\n{\ntruck : .a {\n}\n').titles).toEqual([])
    // Duplicates: which one to rename is the user's call.
    expect(
      quickFixes(sii('truck : .a {\n}\ntruck : .a {\n}')).titles
    ).toEqual([])
  })

  it('only offers fixes for issues at the cursor or selection', () => {
    const input = sii('truck : x..y {\nspeed 10\n}')
    expect(quickFixes(input, { at: 'x..y' }).titles).toEqual([
      'Replace ".." with "."',
    ])
    expect(quickFixes(input, { at: 'speed' }).titles).toEqual([])
    expect(quickFixes(input, { at: '10' }).titles).toEqual([
      "Add ':' after the attribute key",
    ])
  })

  it('links each fix to the diagnostic it fixes', () => {
    const [action] = quickFixes('SiiNunit\n{\n}').actions
    expect(action?.diagnostics).toEqual([
      expect.objectContaining({ code: 'missing-final-newline' }),
    ])
  })

  it('answers only requests for quick fixes', () => {
    expect(quickFixes('SiiNunit\n{\n}', { only: ['source'] }).titles).toEqual(
      []
    )
    expect(
      quickFixes('SiiNunit\n{\n}', { only: ['quickfix'] }).titles
    ).toHaveLength(1)
  })

  it('works on .sui files', () => {
    const fixed = quickFixes('speed 10\n', { uri: 'file:///x.sui' }).apply(
      "Add ':' after the attribute key"
    )
    expect(fixed).toBe('speed: 10\n')
  })
})
