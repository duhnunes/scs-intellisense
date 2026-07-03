import {
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  type Connection,
  type TextDocuments,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getLogger } from '../logger'
import { computeLineStarts, pushTokenByRange } from './helpers'
import {
  detectExtFromUri,
  detectModeFromExt,
  normalizeText,
  parseDocument,
} from '../parser/docParser'
import type { ParsedClass } from '../interfaces/parser'
import { scanComments } from './scanners/comments'
import { scanClasses } from './scanners/class'
import { scanAttributes } from './scanners/attributes'
import type { TokenEntry } from '../interfaces/token'
import { scanKeywords } from './scanners/keywords'

// # TOKEN TYPES
export const tokenTypes = [
  'keyword',
  'class',
  'parameter',
  'string',
  'number',
  'comment',
  'method',
]
const tokenModifiers: string[] = []

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes,
  tokenModifiers,
}

const logger = getLogger()

export function provideSemanticTokensForDocument(
  documentText: string,
  documentUri?: string
): SemanticTokens {
  try {
    const text = normalizeText(documentText)
    const ext = detectExtFromUri(documentUri)
    const mode = detectModeFromExt(ext)
    void mode // waiting to use

    const builder = new SemanticTokensBuilder()
    const lineStarts = computeLineStarts(text)
    const textLength = text.length

    const tokensToEmit: TokenEntry[] = []

    // Comments
    const { ranges: commentRanges, tokens: commentTokens } = scanComments(
      text,
      textLength
    )
    tokensToEmit.push(...commentTokens)

    // Keywords
    tokensToEmit.push(...scanKeywords(text, commentRanges, textLength))

    // Parse Classes
    const parsed =
      parseDocument(text, { uri: documentUri }) ??
      ({
        magicMark: '',
        classes: [],
      } as { magicMark: string; classes: ParsedClass[] })

    tokensToEmit.push(
      ...scanClasses(text, parsed.classes, commentRanges, textLength)
    )
    for (const cls of parsed.classes) {
      tokensToEmit.push(
        ...scanAttributes(text, cls.attributes, commentRanges, textLength)
      )
    }

    // Sort tokens
    const commentTokenIdx = tokenTypes.indexOf('comment')
    tokensToEmit.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      if (a.end !== b.end) return a.end - b.end
      // If same span, prefer non-comment tokens first, comment tokens last
      if (
        a.tokenTypeIndex === commentTokenIdx &&
        b.tokenTypeIndex !== commentTokenIdx
      )
        return 1
      if (
        b.tokenTypeIndex === commentTokenIdx &&
        a.tokenTypeIndex !== commentTokenIdx
      )
        return -1
      return a.tokenTypeIndex - b.tokenTypeIndex
    })

    for (const te of tokensToEmit) {
      pushTokenByRange(
        builder,
        lineStarts,
        te.start,
        te.end,
        te.tokenTypeIndex,
        textLength
      )
    }

    return builder.build() as SemanticTokens
  } catch (err) {
    const details =
      err && (err as Error).stack ? (err as Error).stack : String(err)
    logger.error('SEMANTIC_ERROR', 'Failed to build semantic tokens', details)
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
        logger.warn(
          'DOC_NOT_FOUND',
          'Document not found for semantic tokens request',
          undefined,
          params.textDocument.uri
        )
        return { data: [] } as SemanticTokens
      }

      return provideSemanticTokensForDocument(doc.getText(), doc.uri)
    } catch (err) {
      const details =
        err && (err as Error).stack ? (err as Error).stack : String(err)
      logger.error(
        'SEMANTIC_HANDLER_ERROR',
        'Semantic handler failed',
        details,
        params.textDocument.uri
      )
      return { data: [] } as SemanticTokens
    }
  })
}
