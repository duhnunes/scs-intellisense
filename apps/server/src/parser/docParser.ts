import path from 'node:path'
import type { Diagnostic } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { maskSiiComments, normalizeSiiText, readScsDocument } from '../sii'
import type { SiiAttribute, SiiDocument, SiiUnit } from '../interfaces/sii'
import type {
  ParseOptions,
  ParsedAttribute,
  ParsedClass,
  ScsFileExt,
  ScsFileMode,
} from '../interfaces/parser'
import { ScsFileExt as ScsExtEnum } from '../interfaces/parser'

/** @deprecated Use `normalizeSiiText` from `src/sii` in new consumers. */
export const normalizeText = normalizeSiiText

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

/** @deprecated Use `maskSiiComments` from `src/sii` in new consumers. */
export function stripComments(text: string): string {
  return maskSiiComments(text)
}

/**
 * Compatibility adapter for current validation consumers.
 * New features should call `readSiiDocument`/`readScsDocument` directly so
 * they receive comments, source ranges and parser issues in one result.
 */
export function parseDocument(
  text: string,
  options?: ParseOptions,
  diagnostics: Diagnostic[] = []
): { magicMark: string; classes: ParsedClass[] } | { classes: ParsedClass[] } {
  const ext = (options?.ext ?? detectExtFromUri(options?.uri)) as
    | ScsFileExt
    | ''
    | undefined
  const mode = options?.mode ?? detectModeFromExt(ext)
  if (mode === 'unknown') return { magicMark: '', classes: [] }

  const parsed = readScsDocument(text, mode, {
    normalizeLineEndings: options?.normalizeLineEndings,
  })
  appendDiagnostics(parsed, options?.uri, diagnostics)
  const classes = parsed.units.map(toParsedClass)

  return mode === 'sii'
    ? { magicMark: parsed.magicMark?.text ?? '', classes }
    : { classes }
}

function appendDiagnostics(
  parsed: SiiDocument,
  uri: string | undefined,
  diagnostics: Diagnostic[]
): void {
  if (parsed.issues.length === 0) return
  const document = TextDocument.create(uri ?? '', parsed.mode, 0, parsed.text)
  for (const issue of parsed.issues) {
    diagnostics.push({
      severity: 1,
      range: {
        start: document.positionAt(issue.range.start),
        end: document.positionAt(issue.range.end),
      },
      message: issue.message,
      source: 'sii.reader',
    })
  }
}

function toParsedClass(unit: SiiUnit): ParsedClass {
  return {
    className: unit.className,
    unitName: unit.unitName,
    attributes: unit.attributes.map(toParsedAttribute),
    classNameStart: unit.classNameRange.start,
    classNameEnd: unit.classNameRange.end,
    unitNameStart: unit.unitNameRange.start,
    unitNameEnd: unit.unitNameRange.end,
    bodyStart: unit.bodyRange.start,
    bodyEnd: unit.bodyRange.end,
  }
}

function toParsedAttribute(attribute: SiiAttribute): ParsedAttribute {
  return {
    key: attribute.key,
    type: attribute.valueType,
    isArray: attribute.isArray,
    arrayElementType: undefined,
    description: '',
    keyRange: attribute.keyRange,
    valueRange: attribute.valueRange,
  }
}
