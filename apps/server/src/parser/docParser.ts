import { URI } from 'vscode-uri'
import path from 'node:path'
import type {
  ParsedClass,
  ParseOptions,
  ScsFileExt,
  ScsFileMode,
} from '../interfaces/parser'
import { ScsFileExt as ScsExtEnum } from '../interfaces/parser'
import { findMatchingBrace, parseClasses } from './classParser'

export function normalizeText(text: string): string {
  if (!text) return text
  let t = text.replace(/\r\n/g, '\n')
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1)
  return t
}

export function detectExtFromUri(documentUri?: string): ScsFileExt | '' {
  if (!documentUri) return ''
  try {
    const fsPath = URI.parse(documentUri).fsPath
    const ext = path.extname(fsPath).toLowerCase()
    if (ext === ScsExtEnum.SII) return ScsExtEnum.SII
    if (ext === ScsExtEnum.SUI) return ScsExtEnum.SUI
    return ''
  } catch {
    return ''
  }
}

export function detectModeFromExt(
  ext: ScsFileExt | '' | undefined
): ScsFileMode {
  if (ext === ScsExtEnum.SUI) return 'sui'
  if (ext === ScsExtEnum.SII) return 'sii'
  return 'unknown'
}

/**
 *  parseDocument
 *  - text: raw document text (will be normalized)
 *  - options: uri/ext/mode hints
 */
export function parseDocument(text: string, options?: ParseOptions) {
  const normalized =
    options?.normalizeLineEndings === false ? text : normalizeText(text)
  const ext = (options?.ext ?? detectExtFromUri(options?.uri)) as
    | ScsFileExt
    | ''
    | undefined
  const _mode = options?.mode ?? detectModeFromExt(ext)

  const classes: ParsedClass[] = []

  if (_mode === 'sii') {
    const rootIndex = normalized.indexOf('SiiNunit')
    if (rootIndex !== -1) {
      const braceOpen = normalized.indexOf('{', rootIndex)
      if (braceOpen !== -1) {
        // parse the body of SiiNunit
        const braceClose = findMatchingBrace(normalized, braceOpen)
        const bodyStart = braceOpen + 1
        const bodyEnd = braceClose !== -1 ? braceClose : normalized.length
        const body = normalized.slice(bodyStart, bodyEnd)
        parseClasses(normalized, bodyStart, body, classes)
        return { magicMark: 'SiiNunit', classes }
      }
    }
  }

  if (_mode === 'sui') {
    parseClasses(normalized, 0, normalized, classes)
    return { magicMark: 'document.sui', classes }
  }

  parseClasses(normalized, 0, normalized, classes)
  return { magicMark: _mode === 'sii' ? 'document.sii' : 'document', classes }
}
