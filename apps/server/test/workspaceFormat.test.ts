import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { URI } from 'vscode-uri'
import {
  checkFormatting,
  decodeSiiFile,
  detectEol,
  encodeSiiFile,
  formatFiles,
} from '../src/formatter/workspaceFormat'

const formatted = 'SiiNunit {\n  a : x.y {\n    k: 1\n  }\n}\n'
const unformatted = 'SiiNunit\n{\na:x.y\n{\nk:    1\n}\n}\n'

describe('checkFormatting', () => {
  it('reports an already formatted file as unchanged', () => {
    expect(checkFormatting(formatted, 'sii')).toEqual({ status: 'unchanged' })
  })

  it('does not count CRLF line endings as a formatting change', () => {
    expect(checkFormatting(formatted.replace(/\n/g, '\r\n'), 'sii')).toEqual({
      status: 'unchanged',
    })
  })

  it('returns the formatted text for a file that changes', () => {
    expect(checkFormatting(unformatted, 'sii')).toEqual({
      status: 'changed',
      formatted,
    })
  })

  it('skips a file with a structural error and says where', () => {
    expect(
      checkFormatting('SiiNunit {\n  a : x.y {\n    k: 1\n}\n', 'sii')
    ).toEqual({
      status: 'skipped',
      reason: 'structural',
      line: 5,
      message: "Expected '}' to close SiiNunit",
    })
  })

  it('keeps whitespace inside values and comments', () => {
    const result = checkFormatting(
      'SiiNunit\n{\na : x.y\n{\ntext:   "a   b" #  spaced   comment\n}\n}\n',
      'sii'
    )
    expect(result.status).toBe('changed')
    if (result.status !== 'changed') return
    expect(result.formatted).toContain('text: "a   b" #  spaced   comment')
  })
})

describe('file encoding', () => {
  const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'))

  it('decodes UTF-8 text and detects LF or CRLF', () => {
    expect(decodeSiiFile(bytes('a\nb\n'))).toEqual({
      ok: true,
      text: 'a\nb\n',
      hasBom: false,
      eol: '\n',
    })
    expect(decodeSiiFile(bytes('a\r\nb\r\n'))).toMatchObject({ eol: '\r\n' })
  })

  it('detects and strips a BOM', () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('SiiNunit')])
    expect(decodeSiiFile(withBom)).toMatchObject({
      ok: true,
      text: 'SiiNunit',
      hasBom: true,
    })
  })

  it('refuses binary, encrypted and non-UTF-8 files', () => {
    expect(decodeSiiFile(bytes('BSII\u0003'))).toEqual({
      ok: false,
      reason: 'binary',
    })
    expect(decodeSiiFile(bytes('ScsC....'))).toEqual({
      ok: false,
      reason: 'binary',
    })
    expect(decodeSiiFile(new Uint8Array([0x61, 0x00, 0x62]))).toEqual({
      ok: false,
      reason: 'binary',
    })
    // "é" in Windows-1252 is a lone 0xE9, which isn't valid UTF-8.
    expect(decodeSiiFile(new Uint8Array([0x61, 0xe9, 0x62]))).toEqual({
      ok: false,
      reason: 'notUtf8',
    })
  })

  it('picks the line ending most lines use', () => {
    expect(detectEol('a\r\nb\r\nc\n')).toBe('\r\n')
    expect(detectEol('a\nb\nc\r\n')).toBe('\n')
    expect(detectEol('no line breaks')).toBe('\n')
  })

  it('writes back the original line endings and BOM', () => {
    expect(
      encodeSiiFile('a\nb\n', { hasBom: false, eol: '\r\n' }).toString()
    ).toBe('a\r\nb\r\n')
    expect([...encodeSiiFile('a', { hasBom: true, eol: '\n' })]).toEqual([
      0xef, 0xbb, 0xbf, 0x61,
    ])
  })
})

describe('formatFiles on disk', () => {
  let folder: string
  const uriOf = (name: string) => URI.file(join(folder, name)).toString()
  const write = (name: string, content: string | Buffer) =>
    writeFileSync(join(folder, name), content)
  const read = (name: string) => readFileSync(join(folder, name))

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'scs-format-'))
  })
  afterEach(() => {
    rmSync(folder, { recursive: true, force: true })
  })

  it('checks without writing anything', async () => {
    write('a.sii', unformatted)
    const results = await formatFiles([{ uri: uriOf('a.sii') }], false)
    expect(results).toEqual([{ uri: uriOf('a.sii'), status: 'changed' }])
    expect(read('a.sii').toString()).toBe(unformatted)
  })

  it('uses a file own indent over the shared one', async () => {
    write('a.sii', unformatted)
    write('b.sii', unformatted)
    await formatFiles(
      [{ uri: uriOf('a.sii'), indent: '\t' }, { uri: uriOf('b.sii') }],
      true,
      { indent: '    ' }
    )
    expect(read('a.sii').toString()).toBe(
      'SiiNunit {\n\ta : x.y {\n\t\tk: 1\n\t}\n}\n'
    )
    expect(read('b.sii').toString()).toBe(
      'SiiNunit {\n    a : x.y {\n        k: 1\n    }\n}\n'
    )
  })

  it('formats a CRLF file with a BOM and keeps both', async () => {
    write(
      'a.sii',
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(unformatted.replace(/\n/g, '\r\n')),
      ])
    )
    await formatFiles([{ uri: uriOf('a.sii') }], true)
    const written = read('a.sii')
    expect([...written.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(written.subarray(3).toString()).toBe(
      formatted.replace(/\n/g, '\r\n')
    )
  })

  it('never writes an open file, and returns its new text instead', async () => {
    write('a.sii', 'on disk')
    const openText = unformatted.replace(/\n/g, '\r\n')
    const [result] = await formatFiles(
      [{ uri: uriOf('a.sii'), openText }],
      true
    )
    expect(result).toEqual({
      uri: uriOf('a.sii'),
      status: 'changed',
      newText: formatted.replace(/\n/g, '\r\n'),
    })
    expect(read('a.sii').toString()).toBe('on disk')
  })

  it('leaves skipped files untouched', async () => {
    const broken = 'SiiNunit {\n  a : x.y {\n'
    write('broken.sii', broken)
    write('binary.sii', Buffer.from('BSII\u0000\u0001'))
    const results = await formatFiles(
      [{ uri: uriOf('broken.sii') }, { uri: uriOf('binary.sii') }],
      true
    )
    expect(results.map((r) => r.reason)).toEqual(['structural', 'binary'])
    expect(read('broken.sii').toString()).toBe(broken)
  })

  it('reports a missing file as a read error', async () => {
    const [result] = await formatFiles([{ uri: uriOf('missing.sii') }], false)
    expect(result).toMatchObject({ status: 'skipped', reason: 'readError' })
  })

  it('formats .sui files without a SiiNunit root', async () => {
    write('a.sui', 'a:x.y\n{\nk:    1\n}\n')
    await formatFiles([{ uri: uriOf('a.sui') }], true)
    expect(read('a.sui').toString()).toBe('a : x.y {\n  k: 1\n}\n')
  })
})
