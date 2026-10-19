import { readFile, writeFile } from 'node:fs/promises'
import { URI } from 'vscode-uri'
import { detectExtFromUri, detectModeFromExt } from '../parser/docParser'
import { maskSiiComments, readScsDocument } from '../sii'
import type { SiiDocument } from '../interfaces/structure'
import { formatSiiDocument, type FormatterOptions } from './format'

/**
 * Formatting many files at once (the "Format All Files" and "Check
 * Formatting" commands). Unlike Format Document, most of these files
 * aren't open in an editor, so this module also reads and writes them —
 * which is why it has to care about encodings, BOMs and line endings that
 * VS Code normally handles for an open document.
 */

export type FormatCheckResult =
  | { status: 'unchanged' }
  | { status: 'changed'; formatted: string }
  | { status: 'skipped'; reason: 'structural'; line: number; message: string }
  | { status: 'skipped'; reason: 'contentMismatch' }

/**
 * Formats `text` without writing anything, and refuses (contentMismatch)
 * whenever the result doesn't keep every piece of content the original
 * had. That safety check is the point: this runs over files nobody is
 * looking at, so a formatter bug must never reach the disk.
 */
export function checkFormatting(
  text: string,
  mode: 'sii' | 'sui',
  options: Partial<FormatterOptions> = {}
): FormatCheckResult {
  const parsed = readScsDocument(text, mode)

  // Same rule as Format Document: an incomplete tree isn't safe to
  // rebuild a file from.
  const firstIssue = parsed.issues[0]
  if (firstIssue) {
    return {
      status: 'skipped',
      reason: 'structural',
      line: lineAt(parsed.text, firstIssue.range.start),
      message: firstIssue.message,
    }
  }

  const formatted = formatSiiDocument(parsed, options)
  if (formatted === parsed.text) return { status: 'unchanged' }
  if (!keepsContent(parsed, formatted)) {
    return { status: 'skipped', reason: 'contentMismatch' }
  }
  return { status: 'changed', formatted }
}

/**
 * The formatter may only change whitespace between pieces of content.
 * Two checks, because each one alone has a blind spot:
 *  - the pieces (comments, class and unit names, keys, values, includes)
 *    must come back identical and in the same order, which catches
 *    whitespace changes *inside* a value or a comment;
 *  - all non-whitespace characters outside comments must match, which
 *    catches anything the reader doesn't record as a piece (a stray
 *    character, say). Comments are left out of this one because the
 *    formatter may legitimately move a header comment past the '{'
 *    (`a : b #note` + `{` becomes `a : b { #note`); the piece check
 *    still makes sure every comment survives, unchanged and in order.
 */
function keepsContent(original: SiiDocument, formatted: string): boolean {
  const reparsed = readScsDocument(formatted, original.mode)
  if (reparsed.issues.length > 0) return false

  const before = contentPieces(original)
  const after = contentPieces(reparsed)
  if (before.length !== after.length) return false
  if (before.some((piece, index) => piece !== after[index])) return false

  return (
    squash(maskSiiComments(original.text)) ===
    squash(maskSiiComments(reparsed.text))
  )
}

function contentPieces(document: SiiDocument): string[] {
  const pieces: { start: number; text: string }[] = []
  const add = (range: { start: number; end: number }) =>
    pieces.push({
      start: range.start,
      text: document.text.slice(range.start, range.end),
    })

  for (const comment of document.comments) add(comment.range)
  for (const include of document.includes) {
    add(include.keyRange)
    add(include.valueRange)
  }
  for (const unit of document.units) {
    add(unit.classNameRange)
    add(unit.unitNameRange)
    for (const attribute of unit.attributes) {
      add(attribute.keyRange)
      add(attribute.valueRange)
    }
  }

  return pieces.sort((a, b) => a.start - b.start).map((piece) => piece.text)
}

function squash(text: string): string {
  return text.replace(/\s+/g, '')
}

function lineAt(text: string, offset: number): number {
  let line = 1
  for (let index = 0; index < offset && index < text.length; index++) {
    if (text[index] === '\n') line++
  }
  return line
}

// # Reading and writing files

export type DecodedFile =
  | { ok: true; text: string; hasBom: boolean; eol: '\n' | '\r\n' }
  | { ok: false; reason: 'binary' | 'notUtf8' }

/**
 * Game and mod files are plain UTF-8 text. Anything else is left alone
 * rather than guessed at: decoding a Windows-1252 file as UTF-8 and
 * writing it back would corrupt every accented character in it.
 */
export function decodeSiiFile(bytes: Uint8Array): DecodedFile {
  // Binary SII ("BSII") and encrypted ("ScsC") files exist in the game
  // archives. None were found in an extracted ATS 1.61, but a mod folder
  // can still contain one.
  const magic = String.fromCharCode(...bytes.subarray(0, 4))
  if (magic === 'BSII' || magic === 'ScsC' || bytes.includes(0)) {
    return { ok: false, reason: 'binary' }
  }

  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      hasBom ? bytes.subarray(3) : bytes
    )
  } catch {
    return { ok: false, reason: 'notUtf8' }
  }

  return { ok: true, text, hasBom, eol: detectEol(text) }
}

/** CRLF when most line breaks are CRLF, so a file written on Windows
 *  doesn't come back from the formatter as LF (which git would report as
 *  every line changed). */
export function detectEol(text: string): '\n' | '\r\n' {
  const crlf = text.split('\r\n').length - 1
  const lf = text.split('\n').length - 1 - crlf
  return crlf > lf ? '\r\n' : '\n'
}

/** The formatter's output is LF-only; this restores the file's own line
 *  endings and BOM. */
export function encodeSiiFile(
  formatted: string,
  file: { hasBom: boolean; eol: '\n' | '\r\n' }
): Buffer {
  const text =
    file.eol === '\r\n' ? formatted.replace(/\n/g, '\r\n') : formatted
  const body = Buffer.from(text, 'utf8')
  return file.hasBom
    ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])
    : body
}

export interface FileToFormat {
  uri: string
  /** The editor's current text, when the file is open. It wins over the
   *  file on disk, which may be older (unsaved changes), and it is never
   *  written to disk here — the client applies it as an editor edit. */
  openText?: string
}

export type SkipReason =
  | 'structural'
  | 'contentMismatch'
  | 'binary'
  | 'notUtf8'
  | 'readError'
  | 'writeError'

export interface FileFormatResult {
  uri: string
  status: 'unchanged' | 'changed' | 'skipped'
  reason?: SkipReason
  /** 1-based line of the first structural issue. */
  line?: number
  message?: string
  /** For open files, when writing: the new editor text, with the
   *  document's own line endings. */
  newText?: string
}

/**
 * Checks (write = false) or formats (write = true) each file. Files that
 * aren't open are rewritten on disk directly; open ones get `newText`
 * back so the client can apply it as a normal, undoable editor edit.
 */
export async function formatFiles(
  files: FileToFormat[],
  write: boolean,
  options: Partial<FormatterOptions> = {}
): Promise<FileFormatResult[]> {
  const results: FileFormatResult[] = []
  for (const file of files) {
    results.push(await formatFile(file, write, options))
  }
  return results
}

async function formatFile(
  file: FileToFormat,
  write: boolean,
  options: Partial<FormatterOptions>
): Promise<FileFormatResult> {
  const { uri } = file
  const mode =
    detectModeFromExt(detectExtFromUri(uri)) === 'sui' ? 'sui' : 'sii'

  let decoded: DecodedFile
  if (file.openText !== undefined) {
    decoded = {
      ok: true,
      text: file.openText,
      hasBom: false,
      eol: detectEol(file.openText),
    }
  } else {
    try {
      decoded = decodeSiiFile(await readFile(URI.parse(uri).fsPath))
    } catch (error) {
      return {
        uri,
        status: 'skipped',
        reason: 'readError',
        message: String(error),
      }
    }
  }
  if (!decoded.ok) return { uri, status: 'skipped', reason: decoded.reason }

  const result = checkFormatting(decoded.text, mode, options)
  if (result.status === 'unchanged') return { uri, status: 'unchanged' }
  if (result.status === 'skipped') {
    return result.reason === 'structural'
      ? {
          uri,
          status: 'skipped',
          reason: 'structural',
          line: result.line,
          message: result.message,
        }
      : { uri, status: 'skipped', reason: 'contentMismatch' }
  }

  if (!write) return { uri, status: 'changed' }

  if (file.openText !== undefined) {
    const newText =
      decoded.eol === '\r\n'
        ? result.formatted.replace(/\n/g, '\r\n')
        : result.formatted
    return { uri, status: 'changed', newText }
  }

  try {
    await writeFile(
      URI.parse(uri).fsPath,
      encodeSiiFile(result.formatted, decoded)
    )
  } catch (error) {
    return {
      uri,
      status: 'skipped',
      reason: 'writeError',
      message: String(error),
    }
  }
  return { uri, status: 'changed' }
}
