import { ClassDefinitions } from '../@types/data/class-defs'
import { SiiNunitClassName } from '../@types/data/sii-classes'
import type { AttributeDef, AttributeType } from '../@types/structure'
import {
  CompletionItemKind,
  type CompletionItem,
} from 'vscode-languageserver/node'
import { valueSuggestions } from '../utils/attr-types'
import { snippetForTypes } from '../utils/snippet-types'
import { isOffsetInsideComment } from './utils'
import { getLogger } from '../logger'
import { parseDocument } from '../lang/parser/docParser'
import type { ParsedAttribute } from '../lang/parser/types'

const logger = getLogger()

/**
 * Provide completion items
 * Use parseSii internaly to support `SII` and `SUI`
 */
export function provideCompletionItems(
  documentText: string,
  cursorOffset: number
): CompletionItem[] {
  try {
    const siiFile = parseDocument(documentText)
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
        if (!cls.className) return []
        const def = ClassDefinitions[cls.className]
        if (!def) return []

        for (const attr of cls.attributes) {
          if (
            cursorOffset >= attr.valueRange.start &&
            cursorOffset <= attr.valueRange.end
          ) {
            const rawType = Array.isArray(attr.type) ? attr.type[0] : attr.type
            const typeKey = (rawType ?? 'string') as AttributeType
            return (
              valueSuggestions[typeKey] ?? [
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
            : snippetForTypes(
                (attr.type ?? 'string') as AttributeType | AttributeType[]
              )
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
    logger.error(err)
    return []
  }
}

/**
 * extractAttributesFromBody
 * - body: block text (only content inside { ... })
 * - bodyStartOffset: absolute offset from document where body begins
 * - return ParsedAttribute[] with absolute keyRange/valueRange
 */
export function extractAttributesFromBody(
  documentText: string,
  body: string,
  bodyStartOffset: number,
  className: string,
  _documentUri?: string
): ParsedAttribute[] {
  void _documentUri

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
      let valueStart = keyEnd
      let valueEnd = keyEnd
      if (m) {
        const valueTextFound = m[1] ?? m[2] ?? m[3] ?? ''
        const matchIndexInAfter = after.indexOf(m[0])
        const rawValueIndexInAfter =
          matchIndexInAfter + m[0].indexOf(valueTextFound)
        valueStart =
          lineStartInDoc +
          includeIndex +
          '@include'.length +
          rawValueIndexInAfter
        valueEnd = valueStart + valueTextFound.length
      }

      attrs.push({
        key: '@include',
        type: 'resource_tie',
        keyRange: { start: keyStart, end: keyEnd },
        valueRange: { start: valueStart, end: valueEnd },
        description: '',
        isArray: false,
        arrayElementType: undefined,
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
      type: defAttr?.type ?? undefined,
      keyRange: { start: keyStart, end: keyEnd },
      valueRange: { start: valueStart, end: valueEnd },
      arrayElementType: defAttr?.arrayElementType,
      isArray: !!defAttr?.isArray,
      description: '',
    })
  }
  return attrs
}
