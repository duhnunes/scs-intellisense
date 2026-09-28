import {
  SymbolKind,
  type DocumentSymbol,
  type Range,
} from 'vscode-languageserver/node'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type {
  SiiAttribute,
  SiiDocument,
  SiiInclude,
  SiiRange,
  SiiUnit,
} from '../interfaces/structure'

/**
 * Builds the Document Symbol tree for one file — powers the Outline
 * view, breadcrumbs, and "Go to Symbol in Editor". Pure consumer of the
 * tree the reader already produces (same principle as diagnostic/rules.ts
 * and every completion/hover module): no re-tokenizing, no schema fetch
 * — this works identically whether or not the schema database is even
 * reachable.
 *
 * `normalizedDoc` must be a TextDocument built over `document.text`
 * (the *normalized* text) — same CRLF-safety reasoning used everywhere
 * else ranges get converted: `document`'s ranges are offsets into that
 * normalized text, not the original file bytes.
 */
export function buildDocumentSymbols(
  document: SiiDocument,
  normalizedDoc: TextDocument
): DocumentSymbol[] {
  const toRange = (range: SiiRange): Range => ({
    start: normalizedDoc.positionAt(range.start),
    end: normalizedDoc.positionAt(range.end),
  })

  const symbols: DocumentSymbol[] = [
    ...document.units.map((unit) => buildUnitSymbol(unit, toRange)),
    ...document.includes.map((include) =>
      buildTopLevelIncludeSymbol(include, toRange)
    ),
  ]

  // Units and top-level includes come from two separate arrays on
  // `document` — sort by position so the Outline reflects the file's
  // actual top-to-bottom order, not "all units, then all includes".
  symbols.sort((a, b) => compareStart(a.range, b.range))

  return symbols
}

function buildUnitSymbol(
  unit: SiiUnit,
  toRange: (range: SiiRange) => Range
): DocumentSymbol {
  // A unit mid-typing can have an empty unitNameRange (reader.ts reports
  // that separately as a structural issue) — fall back to the className
  // so there's still something reasonable to select/jump to, instead of
  // a zero-width selectionRange with nothing for the editor to land on.
  const hasUnitName = unit.unitNameRange.end > unit.unitNameRange.start
  const name = hasUnitName ? unit.unitName : unit.className || '(unnamed unit)'
  const selectionSource = hasUnitName ? unit.unitNameRange : unit.classNameRange

  return {
    name,
    detail: unit.className || undefined,
    kind: SymbolKind.Class,
    range: toRange(unit.range),
    selectionRange: toRange(selectionSource),
    children: unit.attributes.map((attribute) =>
      buildAttributeSymbol(attribute, toRange)
    ),
  }
}

function buildAttributeSymbol(
  attribute: SiiAttribute,
  toRange: (range: SiiRange) => Range
): DocumentSymbol {
  if (attribute.kind === 'include') {
    return {
      name: '@include',
      kind: SymbolKind.Module,
      range: toRange(attribute.range),
      selectionRange: toRange(attribute.valueRange),
    }
  }

  return {
    name: attribute.isArray ? `${attribute.key}[]` : attribute.key,
    kind: SymbolKind.Property,
    range: toRange(attribute.range),
    selectionRange: toRange(attribute.keyRange),
  }
}

function buildTopLevelIncludeSymbol(
  include: SiiInclude,
  toRange: (range: SiiRange) => Range
): DocumentSymbol {
  return {
    name: '@include',
    detail: include.path || undefined,
    kind: SymbolKind.Module,
    range: toRange(include.range),
    selectionRange: toRange(include.valueRange),
  }
}

function compareStart(a: Range, b: Range): number {
  if (a.start.line !== b.start.line) return a.start.line - b.start.line
  return a.start.character - b.start.character
}
