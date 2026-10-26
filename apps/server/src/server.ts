import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  CodeActionKind,
  CompletionItemKind,
  CompletionTriggerKind,
  MarkupKind,
  type CodeAction,
  type CompletionItem,
  type DocumentSymbol,
  type Hover,
  type InitializeResult,
  type TextEdit,
} from 'vscode-languageserver/node'

import path from 'node:path'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import {
  registerSemantic,
  semanticTokensLegend,
  setSemanticHighlighting,
} from './semantic'
import { describeError, getLogger, initLogger } from './logger'
import { checkDocument, toDiagnostics } from './diagnostic'
import type { SchemaLookup } from './diagnostic/schemaRules'
import { buildCodeActions } from './diagnostic/codeActions'
import { SchemaClient } from './schema/client'
import {
  getWorkspaceIndex,
  INDEX_CAPABILITIES,
  registerIndex,
} from './index/handlers'
import { isFileLocalName } from './index/workspaceIndex'
import {
  asFragmentDocument,
  CLASS_SEPARATOR,
  fragmentClassName,
  lookupClasses,
  lookupClassesAsync,
} from './index/fragments'
import { normalizeSiiText, readScsDocument } from './sii'
import { detectExtFromUri, detectModeFromExt } from './parser/docParser'
import {
  buildClassNameCompletionItems,
  isClassNamePosition,
} from './completion/className'
import {
  buildAttributeKeyCompletionItems,
  findAttributeKeyPosition,
} from './completion/attributeKey'
import {
  buildAttributeValueCompletionItems,
  findAttributeValuePosition,
} from './completion/attributeValue'
import {
  findFilePathAt,
  listFilePathCandidates,
  type FilePathPosition,
} from './completion/filePath'
import {
  buildPointerCompletionItems,
  type OtherFileUnit,
} from './completion/pointer'
import {
  findIncludePathAt,
  listIncludeCandidates,
  type IncludePathPosition,
} from './completion/includePath'
import { buildClassNameHover, findClassNameAtPosition } from './hover/className'
import {
  buildAttributeKeyHover,
  findAttributeKeyAtPosition,
} from './hover/attributeKey'
import { buildDocumentSymbols } from './symbols/documentSymbols'
import { indentFromEditor, type FormatterOptions } from './formatter/format'
import {
  checkFormatting,
  formatFiles,
  type FileFormatResult,
  type FileToFormat,
  type FormatCheckResult,
} from './formatter/workspaceFormat'
import { formatRange, type FormatRangeResult } from './formatter/rangeFormat'
import {
  DEFAULT_SETTINGS,
  describeSettings,
  parseSettings,
  type ServerSettings,
} from './settings'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

initLogger(connection)
const logger = getLogger()

registerSemantic(connection, documents)
// Once the folders are read, or a file changes on disk, open .sui
// fragments are checked again with their including units' class.
const workspaceIndex = registerIndex(
  connection,
  documents,
  () => schemaClient,
  () => recheckOpenFragments()
)

// The single schema fetch/cache instance for this server process.
// Completion, hover, and future attribute validation all consult this —
// none of them should ever call fetch() or touch the disk cache directly.
let schemaClient: SchemaClient | undefined

// The current scs-intellisense.* settings. Set in onInitialize and
// replaced on every scsIntellisense/updateSettings, so handlers must read
// it per request, never copy a value out of it at startup.
let settings: ServerSettings = DEFAULT_SETTINGS

let hasStoragePath = false

/** For other server modules (completion, hover, ...) to consult the
 *  schema once it's ready. Returns undefined until onInitialize has run
 *  and the client sent a usable storage path. */
export function getSchemaClient(): SchemaClient | undefined {
  return schemaClient
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const initOptions = params.initializationOptions as
    | { globalStoragePath?: string; settings?: unknown }
    | undefined
  settings = parseSettings(initOptions?.settings)
  setSemanticHighlighting(settings.semanticHighlighting)

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Not experimental, not schema-dependent — always on. Powers the
      // Outline view, breadcrumbs, and "Go to Symbol in Editor".
      documentSymbolProvider: true,
      // Quick fixes for diagnostics. Always on like diagnostics: a fix only
      // changes the file when the user picks it.
      codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
      // Go to Definition, Find References, Rename across the open
      // folders. Always on too: they only act when asked.
      ...INDEX_CAPABILITIES,
    },
  }
  workspaceIndex.onInitialize(params)

  // Every feature is declared, on or off, and each handler checks its
  // setting on every request: that's what lets a setting take effect
  // without a window reload. A feature that's off answers right away with
  // nothing, before reading the document. The formatter couldn't work any
  // other way anyway: the extension is the default formatter for
  // .sii/.sui (configurationDefaults in the client's package.json), and
  // VS Code flags a default formatter that declares no formatting as
  // unable to format these files, on every .sii.
  result.capabilities.completionProvider = {
    resolveProvider: false,
    // VS Code doesn't suggest inside strings on its own, so these open the
    // @include path list: the opening quote, and each folder separator.
    triggerCharacters: INCLUDE_TRIGGER_CHARACTERS,
  }
  result.capabilities.hoverProvider = true
  result.capabilities.documentFormattingProvider = true
  result.capabilities.documentRangeFormattingProvider = true
  result.capabilities.semanticTokensProvider = {
    legend: semanticTokensLegend,
    full: true,
    range: false,
  }

  const globalStoragePath = initOptions?.globalStoragePath

  if (globalStoragePath) {
    schemaClient = new SchemaClient({
      cacheDir: globalStoragePath,
      logger,
      fetchTimeoutMs: settings.fetchTimeoutMs,
    })
    // Fire-and-forget: server startup (and the capabilities response
    // above) must never block on disk I/O or a network round-trip.
    // init() loads whatever's cached on disk first (near-instant), then
    // refreshManifest() checks for something newer in the background.
    void schemaClient
      .init()
      // Files opened before the manifest was in get the schema rules now.
      .then(() => publishAllDiagnostics())
      .then(() => schemaClient?.refreshManifest())
      .then((changed) => {
        if (changed) publishAllDiagnostics()
      })
      .catch((err) => {
        logger.error(
          'SCHEMA_STARTUP_FAILED',
          'The schema database could not be loaded',
          describeError(err)
        )
      })
  }
  hasStoragePath = Boolean(initOptions?.globalStoragePath)

  return result
})

// Logged here, not in onInitialize: the client only starts listening for
// notifications after it gets the initialize response, so an entry sent
// before that is dropped (and LSP doesn't allow it anyway).
connection.onInitialized(() => {
  workspaceIndex.onInitialized()
  logger.info('SERVER_STARTED', 'Server started')
  logger.debug(
    'SETTINGS_RECEIVED',
    `Server settings: ${describeSettings(settings)}`
  )
  if (!hasStoragePath) {
    logger.warn(
      'SCHEMA_NO_STORAGE_PATH',
      'No storage folder was given to the server, so the schema database is off for this session (no completion or hover data)'
    )
  }
})

// Backs the client's Refresh Schema Database command: checks right now
// and retries schemas that failed recently. `changed` tells the client
// whether to say "updated" or "already up to date".
connection.onRequest('scsIntellisense/refreshSchema', async () => {
  if (!schemaClient) {
    return {
      ok: false,
      message: 'Schema cache is not initialized for this session',
    }
  }
  try {
    const changed = await schemaClient.refreshManifest(true)
    if (changed) publishAllDiagnostics()
    return { ok: true, changed }
  } catch (err) {
    logger.error(
      'SCHEMA_REFRESH_FAILED',
      'Refresh Schema Database failed',
      describeError(err)
    )
    return { ok: false, message: String(err) }
  }
})

// Backs the "Check Formatting" (write: false) and "Format All Files"
// (write: true) commands. The client finds the files and sends them in
// batches; see formatter/workspaceFormat.ts.
connection.onRequest(
  'scsIntellisense/formatFiles',
  async (params: {
    files: (FileToFormat & { editorOptions?: EditorIndentOptions })[]
    write: boolean
    /** The editor settings for .sii/.sui files that aren't open. Open
     *  files carry their own editorOptions, as VS Code resolved them. */
    editorOptions: EditorIndentOptions
  }): Promise<FileFormatResult[]> =>
    formatFiles(
      params.files.map(({ editorOptions, ...file }) => ({
        ...file,
        indent: indentFromEditor(editorOptions ?? params.editorOptions),
      })),
      params.write,
      {
        braceStyle: settings.formatterBraceStyle,
        indentUnits: settings.formatterIndentUnits,
      }
    )
)

const INCLUDE_TRIGGER_CHARACTERS = ['"', '/']

/** Named units of the other indexed files, for pointer completion. A
 *  nameless unit (".x") only exists in its own file. */
function unitsInOtherFiles(uri: string): OtherFileUnit[] {
  const index = getWorkspaceIndex()
  const here = index.get(uri)
  const units: OtherFileUnit[] = []
  for (const file of index.all()) {
    if (file === here) continue
    const where = path.basename(URI.parse(file.uri).fsPath)
    for (const unit of file.units)
      if (!isFileLocalName(unit.name))
        units.push({ name: unit.name, className: unit.className, where })
  }
  return units
}

/** `className` is `target` or a subclass of it, by the manifest's
 *  superclass chain. */
function isKindOf(
  client: SchemaClient,
  className: string,
  target: string
): boolean {
  let current: string | null | undefined = className
  // A cycle in the data would never end: the chain is short anyway.
  for (let depth = 0; current && depth < 32; depth++) {
    if (current === target) return true
    current = client.getSchemaEntry(current)?.superclass
  }
  return false
}

async function buildFilePathItems(
  filePath: string,
  position: FilePathPosition,
  extensions: string[],
  normalizedDoc: TextDocument
): Promise<CompletionItem[]> {
  const range = {
    start: normalizedDoc.positionAt(position.segment.start),
    end: normalizedDoc.positionAt(position.segment.end),
  }
  // Right after the opening quote: the "/" comes with the item.
  const prefix = position.typed === '' ? '/' : ''
  const candidates = await listFilePathCandidates(
    filePath,
    position.typed,
    extensions
  )
  return candidates.map(
    (candidate): CompletionItem =>
      candidate.isFolder
        ? {
            label: `${candidate.name}/`,
            kind: CompletionItemKind.Folder,
            // Files first, as in @include.
            sortText: `1${candidate.name}`,
            filterText: `${prefix}${candidate.name}/`,
            textEdit: { range, newText: `${prefix}${candidate.name}/` },
            command: { title: '', command: 'editor.action.triggerSuggest' },
          }
        : {
            label: candidate.name,
            kind: CompletionItemKind.File,
            sortText: `0${candidate.name}`,
            filterText: `${prefix}${candidate.name}`,
            textEdit: { range, newText: `${prefix}${candidate.name}` },
          }
  )
}

async function buildIncludePathItems(
  filePath: string,
  position: IncludePathPosition,
  normalizedDoc: TextDocument
): Promise<CompletionItem[]> {
  const range = {
    start: normalizedDoc.positionAt(position.segment.start),
    end: normalizedDoc.positionAt(position.segment.end),
  }
  const candidates = await listIncludeCandidates(filePath, position.typed)
  return candidates.map(
    (candidate): CompletionItem =>
      candidate.isFolder
        ? {
            label: `${candidate.name}/`,
            kind: CompletionItemKind.Folder,
            // Files first: most includes are in the same folder.
            sortText: `1${candidate.name}`,
            textEdit: { range, newText: `${candidate.name}/` },
            // Opens the list again inside the folder just picked.
            command: { title: '', command: 'editor.action.triggerSuggest' },
          }
        : {
            label: candidate.name,
            kind: CompletionItemKind.File,
            sortText: `0${candidate.name}`,
            textEdit: { range, newText: candidate.name },
          }
  )
}

connection.onCompletion(async (params) => {
  try {
    const doc = documents.get(params.textDocument.uri)
    // Asked on every keystroke. With the experimental completion off,
    // only the @include path is suggested (it's always on, like
    // diagnostics), so a line without "@include" answers before any work.
    if (
      !settings.completionEnabled &&
      !doc
        ?.getText({
          start: { line: params.position.line, character: 0 },
          end: { line: params.position.line + 1, character: 0 },
        })
        .includes('@include')
    )
      return []
    if (!doc) {
      logger.debug(
        'DOC_NOT_FOUND',
        'Completion requested for a document the server does not have open',
        undefined,
        params.textDocument.uri
      )
      return []
    }

    const ext = detectExtFromUri(doc.uri)
    const mode = detectModeFromExt(ext)
    const parsed = readScsDocument(
      doc.getText(),
      mode === 'unknown' ? 'sii' : mode
    )

    // Same reasoning as diagnostic/index.ts: `parsed`'s ranges are
    // relative to the normalized (CRLF -> LF) text, so the client's
    // position has to be resolved against that same normalized text —
    // not against `doc` directly — or the position drifts on any
    // Windows-saved .sii file.
    const normalizedDoc = TextDocument.create(
      doc.uri,
      doc.languageId,
      doc.version,
      parsed.text
    )
    const offset = normalizedDoc.offsetAt(params.position)

    // The @include path needs no schema: just the files next to this one.
    const includePath = findIncludePathAt(parsed, offset)
    if (includePath) {
      return buildIncludePathItems(
        URI.parse(doc.uri).fsPath,
        includePath,
        normalizedDoc
      )
    }
    // Everything else comes from the schema: experimental.
    if (!settings.completionEnabled) return []

    if (!schemaClient) {
      logger.debug(
        'COMPLETION_NO_SCHEMA',
        'Completion requested before the schema database was ready'
      )
      return []
    }

    // '"' and '/' are trigger characters only for paths (@include, and
    // attributes that take a file); typed anywhere else (a string value,
    // a comment), they suggest nothing.
    const triggered =
      params.context?.triggerKind === CompletionTriggerKind.TriggerCharacter

    // A .sui fragment's attributes, as the body of the including unit.
    const classed = asFragmentDocument(parsed, fragmentClassOf(doc.uri))
    const valuePosition = findAttributeValuePosition(classed, offset)
    if (valuePosition) {
      const schema = await schemaOf(valuePosition.unit.className)
      const def = schema?.key?.[valuePosition.attribute.key]
      if (
        Array.isArray(def?.expectedExtensions) &&
        def.expectedExtensions.length
      ) {
        const filePath = findFilePathAt(valuePosition, parsed.text, offset)
        return filePath
          ? buildFilePathItems(
              URI.parse(doc.uri).fsPath,
              filePath,
              def.expectedExtensions,
              normalizedDoc
            )
          : []
      }
      if (triggered || !def) return []

      const toRange = (range: { start: number; end: number }) => ({
        start: normalizedDoc.positionAt(range.start),
        end: normalizedDoc.positionAt(range.end),
      })
      const client = schemaClient
      const pointers = buildPointerCompletionItems(
        valuePosition,
        def,
        classed,
        (className, target) => isKindOf(client, className, target),
        unitsInOtherFiles(doc.uri)
      )
      if (pointers.length > 0) {
        return pointers.map(
          (item): CompletionItem => ({
            label: item.label,
            kind: CompletionItemKind.Reference,
            detail: item.detail,
            sortText: item.sortText,
            textEdit: { range: toRange(item.range), newText: item.newText },
          })
        )
      }
      // Enums have a list to offer; every other value gets nothing.
      return buildAttributeValueCompletionItems(valuePosition, schema).map(
        (item): CompletionItem => ({
          label: item.label,
          kind: CompletionItemKind.EnumMember,
          detail: item.detail,
          sortText: item.sortText,
          textEdit: { range: toRange(item.range), newText: item.newText },
        })
      )
    }
    if (triggered) return []

    // A fragment with a class is a unit body: no unit header goes in it.
    if (classed === parsed && isClassNamePosition(parsed, offset)) {
      return buildClassNameCompletionItems(schemaClient.getManifest()).map(
        (item): CompletionItem => ({
          label: item.label,
          kind: CompletionItemKind.Class,
          detail: item.detail,
          documentation: item.documentation,
          sortText: item.sortText,
        })
      )
    }

    const unit = findAttributeKeyPosition(classed, offset)
    if (unit) {
      // First real (non-mocked) use of the lazy per-class fetch: this
      // is the only completion path that ever needs a specific class's
      // full attribute list, not just what's already in the manifest.
      const schema = await schemaOf(unit.className)
      return buildAttributeKeyCompletionItems(schema).map(
        (item): CompletionItem => ({
          label: item.label,
          kind: CompletionItemKind.Property,
          detail: item.detail,
          documentation: item.documentation,
        })
      )
    }

    return []
  } catch (error) {
    logger.error(
      'COMPLETION_FAILED',
      'Completion failed',
      describeError(error),
      params.textDocument?.uri
    )
    return []
  }
})

// The client sends every setting again whenever any scs-intellisense.*
// setting changes. Most take effect on the next request by themselves;
// the ones whose result is already on screen are redone here.
connection.onNotification('scsIntellisense/updateSettings', (raw: unknown) => {
  const previous = settings
  settings = parseSettings(raw)
  // The client logs every setting (SETTINGS_UPDATED); this confirms what
  // reached the server.
  logger.debug(
    'SETTINGS_RECEIVED',
    `Server settings: ${describeSettings(settings)}`
  )

  schemaClient?.setFetchTimeout(settings.fetchTimeoutMs)

  // Diagnostics already shown are re-sent with the new severities, for
  // every open document, instead of waiting for the next edit to each.
  if (previous.enabledSeverities.join() !== settings.enabledSeverities.join())
    publishAllDiagnostics()

  // Asks VS Code to request the colors again, which now come back empty
  // (or full).
  if (previous.semanticHighlighting !== settings.semanticHighlighting) {
    setSemanticHighlighting(settings.semanticHighlighting)
    connection.languages.semanticTokens.refresh()
  }
})

documents.onDidChangeContent((change) => {
  publishDiagnostics(change.document)
  recheckOpenFragments(change.document.uri)
})

let fragmentRecheck: NodeJS.Timeout | undefined

/**
 * A .sui fragment's checks depend on the files that @include it, so an
 * open one is checked again when any other file changes (in the editor,
 * on disk, or once the folders are read), after a short pause so typing
 * elsewhere doesn't redo it on every key.
 */
function recheckOpenFragments(exceptUri?: string): void {
  clearTimeout(fragmentRecheck)
  fragmentRecheck = setTimeout(() => {
    for (const doc of documents.all())
      if (doc.uri !== exceptUri && doc.uri.toLowerCase().endsWith('.sui'))
        publishDiagnostics(doc)
  }, 300)
}

/** The schema rules read class files already in memory, so they answer
 *  right away; publishDiagnostics() loads the missing ones. */
const loadedSchema: SchemaLookup = (className) =>
  lookupClasses(className, (one) => schemaClient?.peekSchemaContent(one))

/** A class's schema, loading it if needed; a .sui fragment included by
 *  units of several classes gets them merged. */
function schemaOf(className: string) {
  return lookupClassesAsync(className, async (one) =>
    schemaClient?.getSchemaContent(one)
  )
}

/** The class(es) of the units that @include this .sui, if it's a
 *  fragment of bare attributes; undefined otherwise. */
function fragmentClassOf(uri: string): string | undefined {
  if (!uri.toLowerCase().endsWith('.sui')) return undefined
  const index = getWorkspaceIndex()
  const file = index.get(uri)
  return file ? fragmentClassName(index.classesOf(file)) : undefined
}

/**
 * Sends a document's diagnostics, with the schema rules for every class
 * whose file is in memory. If some class file isn't loaded yet, it's
 * loaded and the diagnostics are sent once more, unless the document
 * changed meanwhile (the next edit checks it again anyway). After the
 * first time, a class is in memory, so typing never makes a warning
 * disappear and come back.
 */
function publishDiagnostics(doc: TextDocument): void {
  try {
    const checked = checkDocument(
      doc,
      settings.enabledSeverities,
      loadedSchema,
      fragmentClassOf(doc.uri)
    )
    connection.sendDiagnostics({
      uri: doc.uri,
      diagnostics: toDiagnostics(checked),
    })

    const client = schemaClient
    if (!client || !settings.enabledSeverities.includes('warning')) return
    const missing = [
      ...new Set(
        checked.classed.units.flatMap((unit) =>
          unit.className.split(CLASS_SEPARATOR)
        )
      ),
    ].filter(
      (className) =>
        client.getSchemaEntry(className) && !client.peekSchemaContent(className)
    )
    if (missing.length === 0) return

    void Promise.all(missing.map((c) => client.getSchemaContent(c))).then(
      (loaded) => {
        if (!loaded.some(Boolean)) return
        if (documents.get(doc.uri)?.version !== doc.version) return
        publishDiagnostics(doc)
      }
    )
  } catch (error) {
    logger.error(
      'DIAGNOSTICS_FAILED',
      'Checking the file for problems failed',
      describeError(error),
      doc.uri
    )
  }
}

function publishAllDiagnostics(): void {
  for (const doc of documents.all()) publishDiagnostics(doc)
}

interface EditorIndentOptions {
  tabSize: number
  insertSpaces: boolean
}

function describeIndent(options: EditorIndentOptions): string {
  return options.insertSpaces ? `${options.tabSize} spaces` : 'tab'
}

connection.onHover(async (params): Promise<Hover | null> => {
  try {
    if (!settings.hoverEnabled) return null
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null

    const ext = detectExtFromUri(doc.uri)
    const mode = detectModeFromExt(ext)
    const parsed = readScsDocument(
      doc.getText(),
      mode === 'unknown' ? 'sii' : mode
    )

    // Same CRLF-safety reasoning as onCompletion and getDiagnostics:
    // `parsed`'s ranges are relative to the normalized text, so the
    // position has to be resolved against that same text.
    const normalizedDoc = TextDocument.create(
      doc.uri,
      doc.languageId,
      doc.version,
      parsed.text
    )
    const offset = normalizedDoc.offsetAt(params.position)

    const className = findClassNameAtPosition(parsed, offset)
    if (className) {
      // class_name hover only ever needs the manifest, already in
      // memory — no fetch, same data completion already uses for
      // class_name.
      const hover = buildClassNameHover(className, schemaClient?.getManifest())
      return hover ? toHoverResult(hover.markdown) : null
    }

    const attribute = findAttributeKeyAtPosition(
      asFragmentDocument(parsed, fragmentClassOf(doc.uri)),
      offset
    )
    if (attribute) {
      if (!schemaClient) return null
      // Same lazy per-class fetch completion's attribute_key path
      // already uses — cached after the first hover/completion for
      // this class, whichever happens first.
      const schema = await schemaOf(attribute.className)
      const hover = buildAttributeKeyHover(attribute.key, schema)
      return hover ? toHoverResult(hover.markdown) : null
    }

    return null
  } catch (error) {
    logger.error(
      'HOVER_FAILED',
      'Hover failed',
      describeError(error),
      params.textDocument?.uri
    )
    return null
  }
})

connection.onCodeAction((params): CodeAction[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []
    return buildCodeActions(
      doc,
      params,
      settings.enabledSeverities,
      loadedSchema,
      fragmentClassOf(doc.uri)
    )
  } catch (error) {
    logger.error(
      'QUICKFIX_FAILED',
      'Finding quick fixes failed',
      describeError(error),
      params.textDocument.uri
    )
    return []
  }
})

connection.onDocumentSymbol((params): DocumentSymbol[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []

    const ext = detectExtFromUri(doc.uri)
    const mode = detectModeFromExt(ext)
    const parsed = readScsDocument(
      doc.getText(),
      mode === 'unknown' ? 'sii' : mode
    )

    // Same CRLF-safety reasoning as every other handler here.
    const normalizedDoc = TextDocument.create(
      doc.uri,
      doc.languageId,
      doc.version,
      parsed.text
    )

    return buildDocumentSymbols(parsed, normalizedDoc)
  } catch (error) {
    logger.error(
      'SYMBOLS_FAILED',
      'Building the Outline (document symbols) failed',
      describeError(error),
      params.textDocument?.uri
    )
    return []
  }
})

connection.onDocumentFormatting((params): TextEdit[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc || !isFormatterOn(params.textDocument.uri)) return []

    const mode = detectModeFromExt(detectExtFromUri(doc.uri))

    // checkFormatting() is the same path the workspace commands use, so
    // Format Document and format on save get its safety check too: the
    // result is applied only if nothing but whitespace changed. It also
    // skips files with structural issues (missing ':', missing '}',
    // etc.): the tree is incomplete there, most often because the user
    // is mid-typing, and rebuilding the file from it isn't safe.
    // Business-rule issues (invalid className, duplicates...) don't
    // affect the ranges the formatter uses, so they don't block it.
    const result = checkFormatting(
      doc.getText(),
      mode === 'sui' ? 'sui' : 'sii',
      formatterOptions(params.options)
    )
    logFormatOutcome(result, params.options, params.textDocument.uri)
    if (result.status !== 'changed') return []

    // The formatter reconstructs the whole file from the tree, so the
    // simplest and safest edit is "replace everything" — no need to
    // diff against the original to compute a minimal set of edits.
    const fullRange = {
      start: { line: 0, character: 0 },
      end: doc.positionAt(doc.getText().length),
    }
    return [{ range: fullRange, newText: result.formatted }]
  } catch (error) {
    logger.error(
      'FORMAT_FAILED',
      'Format Document failed',
      describeError(error),
      params.textDocument?.uri
    )
    return []
  }
})

// Format Selection: the units the selection touches, with the same
// structural-issue rule and safety check as Format Document.
connection.onDocumentRangeFormatting((params): TextEdit[] => {
  try {
    const doc = documents.get(params.textDocument.uri)
    if (!doc || !isFormatterOn(params.textDocument.uri)) return []

    const mode = detectModeFromExt(detectExtFromUri(doc.uri))
    // Offsets go through the normalized text (no BOM, LF only), like
    // every other handler; line and column are the same in both.
    const normalizedDoc = TextDocument.create(
      doc.uri,
      doc.languageId,
      doc.version,
      normalizeSiiText(doc.getText())
    )
    const result = formatRange(
      doc.getText(),
      mode === 'sui' ? 'sui' : 'sii',
      {
        start: normalizedDoc.offsetAt(params.range.start),
        end: normalizedDoc.offsetAt(params.range.end),
      },
      formatterOptions(params.options)
    )
    logFormatOutcome(result, params.options, params.textDocument.uri)
    if (result.status !== 'changed') return []

    const eol = doc.getText().includes('\r\n') ? '\r\n' : '\n'
    return [
      {
        range: {
          start: normalizedDoc.positionAt(result.edit.range.start),
          end: normalizedDoc.positionAt(result.edit.range.end),
        },
        newText: result.edit.newText.replace(/\n/g, eol),
      },
    ]
  } catch (error) {
    logger.error(
      'FORMAT_FAILED',
      'Format Selection failed',
      describeError(error),
      params.textDocument?.uri
    )
    return []
  }
})

/** The formatter is always declared (see onInitialize), so every request
 *  checks the setting first. */
function isFormatterOn(uri: string): boolean {
  if (settings.formatterEnabled) return true
  logger.debug(
    'FORMAT_DISABLED',
    'Not formatted: the formatter is off (scs-intellisense.formatter.enabled)',
    undefined,
    uri
  )
  return false
}

function formatterOptions(editorOptions: {
  tabSize: number
  insertSpaces: boolean
}): FormatterOptions {
  return {
    braceStyle: settings.formatterBraceStyle,
    indentUnits: settings.formatterIndentUnits,
    // What VS Code sends with the request: editor.tabSize and
    // editor.insertSpaces as they apply to this file (detected from its
    // content when editor.detectIndentation is on). Using them keeps
    // formatting and the editor's own indent on Enter in step.
    indent: indentFromEditor(editorOptions),
  }
}

/**
 * Every outcome is logged, at debug for the routine ones, so a bug report
 * can tell whether the formatter ran on a file and what it did.
 */
function logFormatOutcome(
  result: FormatCheckResult | FormatRangeResult,
  editorOptions: { tabSize: number; insertSpaces: boolean },
  uri: string
): void {
  if (result.status === 'unchanged') {
    logger.debug(
      'FORMAT_UNCHANGED',
      'Already formatted, nothing to change',
      undefined,
      uri
    )
    return
  }
  if (result.status === 'skipped') {
    // A structural issue is normal while typing (format on save hits it
    // all the time), so it's debug. A content mismatch is a formatter
    // bug: a warning, so it shows up in bug reports.
    if (result.reason === 'structural') {
      logger.debug(
        'FORMAT_SKIPPED',
        `Not formatted: structural issue at line ${result.line} (${result.message})`,
        undefined,
        uri
      )
    } else {
      logger.warn(
        'FORMAT_UNSAFE_RESULT',
        'Not formatted: the result would change content, not just whitespace. This is a formatter bug, please report it',
        undefined,
        uri
      )
    }
    return
  }
  logger.debug(
    'FORMAT_APPLIED',
    `Formatted ${'edit' in result ? 'the selection' : 'the file'} (${settings.formatterBraceStyle} braces, indent ${describeIndent(editorOptions)}, units ${settings.formatterIndentUnits ? 'indented' : 'at column 0'})`,
    undefined,
    uri
  )
}

function toHoverResult(markdown: string): Hover {
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: markdown,
    },
  }
}

process.on('uncaughtException', (err) => {
  logger.error(
    'SERVER_UNCAUGHT_EXCEPTION',
    'Uncaught exception in the server',
    describeError(err)
  )
})

process.on('unhandledRejection', (reason) => {
  logger.error(
    'SERVER_UNHANDLED_REJECTION',
    'Unhandled promise rejection in the server',
    describeError(reason)
  )
})

documents.listen(connection)
connection.listen()
