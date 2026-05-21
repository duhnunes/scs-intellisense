import { ClassDefinitions } from './@types/data/class-defs'
import { SiiNunitClassName } from './@types/data/sii-classes'
import type { AttributeDef, SiiClass, SiiFile } from './@types/structure'
import {
  CompletionItemKind,
  type CompletionItem,
} from 'vscode-languageserver/node'
import { valueSuggestions } from './utils/attr-types'
import { snippetForTypes } from './utils/snippet-types'

interface ParsedAttribute extends AttributeDef {
  keyRange: { start: number; end: number }
  valueRange: { start: number; end: number }
}
interface ParsedClass extends SiiClass {
  attributes: ParsedAttribute[]
  classNameStart: number
  classNameEnd: number
  unitNameStart: number
  unitNameEnd: number
  bodyStart: number
  bodyEnd: number
}
interface ParsedFile extends SiiFile {
  classes: ParsedClass[]
}

// detect comment to not completions inside
export function isOffsetInsideComment(text: string, offset: number): boolean {
  if (offset < 0) return false

  // check line comments '//' and '#'
  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1
  const lineEnd = text.indexOf('\n', offset)
  const lineSlice = text.slice(
    lineStart,
    lineEnd === -1 ? text.length : lineEnd
  )

  const idxSlash = lineSlice.indexOf('//')
  if (idxSlash !== -1) {
    const commentStartInDoc = lineStart + idxSlash
    if (offset >= commentStartInDoc) return true
  }
  const idxHash = lineSlice.indexOf('#')
  if (idxHash !== -1) {
    const commentStartInDoc = lineStart + idxHash
    if (offset >= commentStartInDoc) return true
  }

  const lastOpen = text.lastIndexOf('/*', offset)
  if (lastOpen === -1) return false
  const nextClose = text.indexOf('*/', lastOpen + 2)
  if (nextClose === -1 || nextClose >= offset) return true

  return false
}

/**
 * Provide completion items
 * Use parseSii internaly to support `SII` and `SUI`
 */
export function provideCompletionItems(
  documentText: string,
  cursorOffset: number
): CompletionItem[] {
  try {
    const siiFile = parseSii(documentText)
    if (isOffsetInsideComment(documentText, cursorOffset)) {
      return []
    }

    let cursorInsideAnyBody = false
    for (const c of siiFile.classes) {
      if (typeof c.bodyStart === 'number' && typeof c.bodyEnd === 'number') {
        if (cursorOffset > c.bodyStart && cursorOffset < c.bodyEnd) {
          cursorInsideAnyBody = true
          break
        }
      }
    }

    if (!cursorInsideAnyBody) {
      const lineStartOffset = (() => {
        const prevNewline = documentText.lastIndexOf(
          '\n',
          Math.max(0, cursorOffset - 1)
        )
        return prevNewline === -1 ? 0 : prevNewline + 1
      })()

      const lineEndOffset = (() => {
        const nextNewline = documentText.indexOf('\n', cursorOffset)
        return nextNewline === -1 ? documentText.length : nextNewline
      })()

      const lineText = documentText.slice(lineStartOffset, lineEndOffset)
      const trimmedLine = lineText.trim()

      if (trimmedLine.startsWith('@')) {
        const tokenStart = lineStartOffset + lineText.indexOf('@')
        if (cursorOffset >= tokenStart && cursorOffset <= lineEndOffset) {
          return [
            {
              label: '@include',
              kind: CompletionItemKind.Property,
              documentation: {
                kind: 'markdown',
                value: 'Include another .sui file: `@include "file.sui"`',
              },
              insertTextFormat: 2,
              insertText: '@include "${1:file.sui}"',
              sortText: '@include',
              filterText: 'include',
              preselect: true,
            },
          ]
        }
      }

      // accept "class_name", "class_name :", "class_name : unit.name"
      const headerMatch = lineText.match(
        /^(\s*)([A-Za-z0-9_.-]*)(?:\s*:\s*(.*))?$/
      )

      if (headerMatch) {
        const indent = headerMatch[1] ?? ''
        const classNamePartial = headerMatch[2] ?? ''
        const classNameStart = lineStartOffset + indent.length
        const classNameEnd = classNameStart + classNamePartial.length

        if (
          cursorOffset >= classNameStart &&
          cursorOffset <= Math.max(classNameEnd, classNameStart + 1)
        ) {
          return [...SiiNunitClassName]
            .filter(
              (n) =>
                classNamePartial.length === 0 ||
                n.toLowerCase().startsWith(classNamePartial.toLowerCase())
            )
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .map((name) => ({
              label: name,
              kind: CompletionItemKind.Class,
              documentation: {
                kind: 'markdown',
                value: 'SiiNunit inside **class_name**',
              },
              insertTextFormat: 2,
              insertText: `${name} : \${1:unit.name} {\n\t$0\n}`,
              sortText: name.toLowerCase(),
            }))
        }
      }
    }

    for (const cls of siiFile.classes) {
      // # CLASS_NAME 1
      if (
        cls.classNameStart !== undefined &&
        cursorOffset >= cls.classNameStart &&
        cursorOffset <= cls.classNameEnd
      ) {
        return [...SiiNunitClassName]
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
          .map((name) => ({
            label: name,
            kind: CompletionItemKind.Class,
            documentation: {
              kind: 'markdown',
              value: 'Siinunit inside **class_name**',
            },
            insertTextFormat: 2,
            insertText: `${name} : \${1:unit.name} {\n\t$0\n}`,
            sortText: name.toLowerCase(),
          }))
      }

      // # UNIT_NAME
      if (
        cls.unitNameStart !== undefined &&
        cursorOffset >= cls.unitNameStart &&
        cursorOffset <= cls.unitNameEnd
      ) {
        return []
      }

      // # ATTRIBUTES
      const classStart = cls.bodyStart
      const classEnd = cls.bodyEnd
      if (
        classStart !== undefined &&
        classEnd !== undefined &&
        cursorOffset > classStart &&
        cursorOffset < classEnd
      ) {
        const def = ClassDefinitions[cls.className]
        if (!def) return []

        for (const attr of cls.attributes) {
          if (
            cursorOffset >= attr.valueRange.start &&
            cursorOffset <= attr.valueRange.end
          ) {
            const type = Array.isArray(attr.type) ? attr.type[0] : attr.type
            return (
              valueSuggestions[type] ?? [
                { label: '<value>', kind: CompletionItemKind.Text },
              ]
            )
          }
        }

        const existingKeys = cls.attributes.map((attr) => attr.key)

        const sortedAttrs = [...def.attributes].sort((a, b) =>
          a.key.toLowerCase().localeCompare(b.key.toLowerCase())
        )

        // @include
        if (!existingKeys.includes('@include')) {
          const includeAttr: AttributeDef = {
            key: '@include',
            type: 'resource_tie',
            description: 'Include another `.sui` file',
          } as AttributeDef
          sortedAttrs.push(includeAttr)
          sortedAttrs.sort((a, b) =>
            a.key.toLowerCase().localeCompare(b.key.toLowerCase())
          )
        }

        return sortedAttrs.map((attr: AttributeDef) => {
          const isInclude = attr.key === '@include'
          const typeLabel = Array.isArray(attr.type)
            ? attr.type.join(' | ')
            : attr.type
          const snippet = isInclude
            ? '@include "${1:file.sui}"'
            : snippetForTypes(attr.type)
          const insertText = isInclude ? snippet : `${attr.key}: ${snippet}`

          return {
            label: attr.key,
            kind: CompletionItemKind.Property,
            detail: typeLabel,
            documentation: {
              kind: 'markdown',
              value: `Type: **${attr.key}**\`${Array.isArray(attr.type) ? attr.type.join(' | ') : attr.type}\`\nDescription: ${attr.description ?? ''}`,
            },
            insertTextFormat: 2,
            insertText,
            sortText: attr.key.toLowerCase(),
            filterText: isInclude ? 'include' : undefined,
            preselect: isInclude ? true : undefined,
          } as CompletionItem
        })
      }
    }

    // # CLASS_NAME inside "SiiNunit {"
    const siiStart = documentText.indexOf('SiiNunit {')
    if (siiStart !== -1 && cursorOffset > siiStart + 'SiiNunit {'.length) {
      return [...SiiNunitClassName]
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map((name) => ({
          label: name,
          kind: CompletionItemKind.Class,
          documentation: {
            kind: 'markdown',
            value: 'SiiNunit inside **class_name**',
          },
          insertTextFormat: 2,
          insertText: `${name} : \${1:unit.name} {\n\t$0\n}`,
          sortText: name.toLowerCase(),
        }))
    }

    return []
  } catch (err) {
    return []
  }
}

/**
 * ParseSii
 * - Support SII (with `SiiNunit {...}` and SUI files
 * - Return ParsedFile with classes[]. Which class have className, unitName and attribute[] with absolute ranges.
 */
export function parseSii(documentText: string): ParsedFile {
  const classes: ParsedClass[] = []

  // With "SiiNunit"
  const rootIndex = documentText.indexOf('SiiNunit')
  if (rootIndex !== -1) {
    const braceOpen = documentText.indexOf('{', rootIndex)
    if (braceOpen !== -1) {
      const braceClose = findMatchingBrace(documentText, braceOpen)
      const body =
        braceClose !== -1
          ? documentText.slice(braceOpen + 1, braceClose)
          : documentText.slice(braceOpen + 1)
      parseClassesInto(documentText, braceOpen + 1, body, classes)
      return { magicMark: 'SiiNunit', classes }
    }
  }

  // Without "SiiNunit"
  parseClassesInto(documentText, 0, documentText, classes)
  return { magicMark: 'SiiNunit', classes }
}

/**
 * parseClassesInto
 * - baseOffset: offset in the document where 'text' begins (to calculate absolute ranges)
 * - text: section to be parsed (this could be the SiiNunit body or the entire document)
 * - classesOut: array where the found classes will be pushed.
 */
function parseClassesInto(
  documentText: string,
  baseOffset: number,
  text: string,
  classesOut: ParsedClass[]
) {
  // Scan to ClassName
  const classHeaderRegex = /([A-Za-z0-9_.-]+)\s*:\s*([A-Za-z0-9_.-]+)\s*\{/g
  let match
  while ((match = classHeaderRegex.exec(text)) !== null) {
    const [full, className, unitName] = match
    const headerIndexInText = match.index
    const headerIndexInDoc = baseOffset + headerIndexInText

    const classNameIndexInHeader = full.indexOf(className)
    const unitNameIndexInHeader = full.indexOf(
      unitName,
      classNameIndexInHeader + className.length
    )

    const classNameStart = headerIndexInDoc + classNameIndexInHeader
    const classNameEnd = classNameStart + className.length

    const unitNameStart = headerIndexInDoc + unitNameIndexInHeader
    const unitNameEnd = unitNameStart + unitName.length

    const braceOpenInText = headerIndexInText + full.lastIndexOf('{')
    const braceOpenInDoc = baseOffset + braceOpenInText
    const braceCloseInDoc = findMatchingBrace(documentText, braceOpenInDoc)
    const bodyStart = braceOpenInDoc + 1
    const bodyEnd =
      braceCloseInDoc !== -1 ? braceCloseInDoc : documentText.length
    const body = documentText.slice(bodyStart, bodyEnd)

    const attributes: ParsedAttribute[] = extractAttributesFromBody(
      documentText,
      body,
      bodyStart,
      className
    )

    classesOut.push({
      className,
      unitName,
      attributes,
      classNameStart,
      classNameEnd,
      unitNameStart,
      unitNameEnd,
      bodyStart,
      bodyEnd,
    })

    if (braceCloseInDoc !== -1) {
      const nextPos = braceCloseInDoc - baseOffset + 1
      classHeaderRegex.lastIndex = nextPos
    }
  }
}

/**
 * extractAttributesFromBody
 * - body: block text (only content inside { ... })
 * - bodyStartOffset: absolute offset from document where body begins
 * - return ParsedAttribute[] with absolute keyRange/valueRange
 */
function extractAttributesFromBody(
  documentText: string,
  body: string,
  bodyStartOffset: number,
  className: string,
  documentUri?: string
): ParsedAttribute[] {
  const lines = body.split(/\r?\n/)
  const attrs: ParsedAttribute[] = []
  let cursor = 0
  for (const rawLine of lines) {
    const line = rawLine
    const lineStartInDoc = bodyStartOffset + cursor
    cursor += rawLine.length + 1

    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue

    // @Include
    if (trimmed.startsWith('@include')) {
      const includeIndex = line.indexOf('@include')
      const keyStart = lineStartInDoc + includeIndex
      const keyEnd = keyStart + '@include'.length

      const after = line.slice(includeIndex + '@include'.length)
      const m = after.match(/^\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
      let valueText = ''
      let valueStart = keyEnd
      let valueEnd = keyEnd
      if (m) {
        valueText = m[1] ?? m[2] ?? m[3] ?? ''
        const matchIndexInAfter = after.indexOf(m[0])
        const rawValueIndexInAfter = matchIndexInAfter + m[0].indexOf(valueText)
        valueStart =
          lineStartInDoc +
          includeIndex +
          '@include'.length +
          rawValueIndexInAfter
        valueEnd = valueStart + valueText.length
      }

      attrs.push({
        key: '@include',
        type: 'resource_tie',
        keyRange: { start: keyStart, end: keyEnd },
        valueRange: { start: valueStart, end: valueEnd },
        description: '',
      })
      continue
    }

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const afterColon = line.slice(colonIndex + 1)
    const leadingSpacesMatch = afterColon.match(/^\s*/)
    const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0

    // key e value raw
    const keyRaw = line.slice(0, colonIndex)
    const key = keyRaw.trim()
    const value = afterColon.trim()

    const keyStart = lineStartInDoc + line.indexOf(key)
    const keyEnd = keyStart + key.length

    const valueStart = lineStartInDoc + colonIndex + 1 + leadingSpaces
    const valueEnd =
      value.length > 0 ? lineStartInDoc + line.length : valueStart

    const def = ClassDefinitions[className]
    const defAttr = def?.attributes.find((a) => a.key === key)

    attrs.push({
      key,
      type: defAttr?.type ?? 'string',
      keyRange: { start: keyStart, end: keyEnd },
      valueRange: { start: valueStart, end: valueEnd },
      description: '',
    })
  }
  return attrs
}

/**
 * findMatchingBrace
 * - given an index of '{' in the document, find the corresponding index of '}' (balancing)
 * - returns -1 if not found.
 */
function findMatchingBrace(text: string, openIndex: number): number {
  if (openIndex < 0 || text[openIndex] !== '{') return -1
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
