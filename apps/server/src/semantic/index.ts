import {
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  type Connection,
  type TextDocuments,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { describeError, getLogger } from '../logger'
import { detectExtFromUri, detectModeFromExt } from '../parser/docParser'
import { isNumericValueType, readScsDocument } from '../sii'
import type { SiiAttribute, SiiRange } from '../interfaces/structure'
import type { TokenEntry } from '../interfaces/token'
import { computeLineStarts, pushTokenByRange, queueToken } from './helpers'

// # TOKEN TYPES
export const tokenTypes = [
  'keyword',
  'class',
  'parameter',
  'string',
  'number',
  'comment',
  'method',
  'namespace',
]
const tokenModifiers: string[] = []

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes,
  tokenModifiers,
}

const logger = getLogger()

/**
 * Semantic tokens are deliberately a projection of the shared SII reader.
 * They must not parse source text independently.
 */
export function provideSemanticTokensForDocument(
  documentText: string,
  documentUri?: string
): SemanticTokens {
  try {
    const ext = detectExtFromUri(documentUri)
    const detectedMode = detectModeFromExt(ext)
    const mode = detectedMode === 'unknown' ? 'sii' : detectedMode
    const document = readScsDocument(documentText, mode)
    const textLength = document.text.length
    const lineStarts = computeLineStarts(document.text)
    const tokensToEmit: TokenEntry[] = []

    const commentToken = tokenTypes.indexOf('comment')
    for (const comment of document.comments) {
      queueRange(tokensToEmit, comment.range, commentToken, textLength)
    }

    const keywordToken = tokenTypes.indexOf('keyword')
    if (document.magicMark) {
      queueRange(
        tokensToEmit,
        document.magicMark.range,
        keywordToken,
        textLength
      )
    }

    const classToken = tokenTypes.indexOf('class')
    const namespaceToken = tokenTypes.indexOf('namespace')
    for (const unit of document.units) {
      // `ui::text`: "ui" is the namespace, "text" the class, and the
      // "::" between them stays uncolored like any other punctuation.
      if (unit.namespaceRange) {
        queueRange(
          tokensToEmit,
          unit.namespaceRange,
          namespaceToken,
          textLength
        )
        queueRange(
          tokensToEmit,
          { start: unit.namespaceRange.end + 2, end: unit.classNameRange.end },
          classToken,
          textLength
        )
      } else {
        queueRange(tokensToEmit, unit.classNameRange, classToken, textLength)
      }
      for (const attribute of unit.attributes) {
        queueAttributeTokens(tokensToEmit, attribute, textLength)
      }
    }
    for (const attribute of document.attributes) {
      queueAttributeTokens(tokensToEmit, attribute, textLength)
    }

    const stringToken = tokenTypes.indexOf('string')
    for (const include of document.includes) {
      queueRange(tokensToEmit, include.keyRange, keywordToken, textLength)
      queueRange(tokensToEmit, include.valueRange, stringToken, textLength)
    }

    tokensToEmit.sort((left, right) => {
      if (left.start !== right.start) return left.start - right.start
      if (left.end !== right.end) return left.end - right.end
      return left.tokenTypeIndex - right.tokenTypeIndex
    })

    const builder = new SemanticTokensBuilder()
    for (const token of tokensToEmit) {
      pushTokenByRange(
        builder,
        lineStarts,
        token.start,
        token.end,
        token.tokenTypeIndex,
        textLength
      )
    }
    return builder.build() as SemanticTokens
  } catch (err) {
    logger.error(
      'SEMANTIC_FAILED',
      'Building the highlighting (semantic tokens) failed',
      describeError(err),
      documentUri
    )
    return { data: [] } as SemanticTokens
  }
}

export function registerSemantic(
  connection: Connection,
  documents: TextDocuments<TextDocument>
) {
  globalThis.connection = connection

  connection.languages.semanticTokens.on((params) => {
    try {
      const doc = documents.get(params.textDocument.uri)
      if (!doc) {
        logger.debug(
          'DOC_NOT_FOUND',
          'Highlighting requested for a document the server does not have open',
          undefined,
          params.textDocument.uri
        )
        return { data: [] } as SemanticTokens
      }

      return provideSemanticTokensForDocument(doc.getText(), doc.uri)
    } catch (err) {
      logger.error(
        'SEMANTIC_FAILED',
        'Building the highlighting (semantic tokens) failed',
        describeError(err),
        params.textDocument.uri
      )
      return { data: [] } as SemanticTokens
    }
  })
}

function queueAttributeTokens(
  tokens: TokenEntry[],
  attribute: SiiAttribute,
  textLength: number
): void {
  const keyToken = tokenTypes.indexOf(
    attribute.kind === 'include' ? 'keyword' : 'parameter'
  )
  queueRange(tokens, attribute.keyRange, keyToken, textLength)

  const valueToken = getValueTokenType(attribute)
  if (valueToken < 0 || attribute.valueRange.start >= attribute.valueRange.end)
    return

  if (attribute.valueParts.length > 0) {
    for (const part of attribute.valueParts) {
      queueRange(tokens, part.range, valueToken, textLength)
    }
    return
  }

  queueRange(tokens, attribute.valueRange, valueToken, textLength)
}

function getValueTokenType(attribute: SiiAttribute): number {
  if (isNumericValueType(attribute.valueType))
    return tokenTypes.indexOf('number')
  if (attribute.valueType === 'bool') return tokenTypes.indexOf('keyword')
  if (
    attribute.valueType === 'token' ||
    attribute.valueType === 'owner_ptr' ||
    attribute.valueType === 'link_ptr'
  )
    return tokenTypes.indexOf('method')
  return tokenTypes.indexOf('string')
}

function queueRange(
  tokens: TokenEntry[],
  range: SiiRange,
  tokenTypeIndex: number,
  textLength: number
): void {
  queueToken(tokens, range.start, range.end, tokenTypeIndex, textLength)
}
