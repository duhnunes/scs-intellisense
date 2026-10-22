import {
  ErrorCodes,
  FileChangeType,
  ResponseError,
  type Connection,
  type InitializeParams,
  type Location as LspLocation,
  type LocationLink,
  type TextDocuments,
  type TextEdit,
  type WorkspaceEdit,
} from 'vscode-languageserver/node'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { describeError, getLogger } from '../logger'
import type { SchemaClient } from '../schema/client'
import {
  findDefinitions,
  findReferences,
  nameAt,
  renameEdits,
  renameProblem,
  type Location,
} from './navigation'
import { WorkspaceIndex, type PointerCheck } from './workspaceIndex'

const logger = getLogger()
const index = new WorkspaceIndex()

/** The index, for completion to offer units of other files. */
export function getWorkspaceIndex(): WorkspaceIndex {
  return index
}

/**
 * Go to Definition, Find References and Rename (F2) for unit names,
 * across the open folders. Always on, like quick fixes: they only do
 * something when the user asks.
 *
 * The rename only sees the text files of the open folders: a map
 * (binary) or another mod using the old name keeps it.
 */
export function registerIndex(
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  getSchemaClient: () => SchemaClient | undefined
): {
  onInitialize: (params: InitializeParams) => void
  onInitialized: () => void
} {
  let folders: string[] = []
  let linkSupport = false

  const isPointer: PointerCheck = async (className, key, bracketed) => {
    const schema = await getSchemaClient()?.getSchemaContent(className)
    const def = schema?.key?.[key]
    if (!def || (def.type !== 'owner_ptr' && def.type !== 'link_ptr'))
      return false
    // `items: 5` on an array is its count; the elements are `items[n]`.
    return bracketed || !def.isArray
  }

  const rescan = async () => {
    const started = Date.now()
    try {
      const count = await index.scan(
        folders,
        (uri) => documents.get(uri) !== undefined
      )
      logger.info(
        'INDEX_READY',
        `Indexed ${count} .sii/.sui files in ${Date.now() - started} ms`
      )
    } catch (error) {
      logger.error(
        'INDEX_FAILED',
        'Indexing the folders failed',
        describeError(error)
      )
    }
  }

  // The connection takes one initialize/initialized handler, server.ts's:
  // it calls these from them.
  const onInitialize = (params: InitializeParams) => {
    linkSupport =
      params.capabilities.textDocument?.definition?.linkSupport === true
    folders =
      params.workspaceFolders?.map((folder) => URI.parse(folder.uri).fsPath) ??
      (params.rootUri ? [URI.parse(params.rootUri).fsPath] : [])
  }

  const onInitialized = () => {
    void rescan()
    // Throws when the client can't send folder changes (VS Code can):
    // the index still works for the folders it started with.
    try {
      connection.workspace.onDidChangeWorkspaceFolders((event) => {
        const removed = new Set(
          event.removed.map((f) => URI.parse(f.uri).fsPath)
        )
        folders = [
          ...folders.filter((folder) => !removed.has(folder)),
          ...event.added.map((f) => URI.parse(f.uri).fsPath),
        ]
        void rescan()
      })
    } catch (error) {
      logger.debug(
        'INDEX_NO_FOLDER_EVENTS',
        'The editor does not report workspace folder changes',
        describeError(error)
      )
    }
  }

  documents.onDidChangeContent((change) =>
    index.setFromText(change.document.uri, change.document.getText())
  )
  documents.onDidClose((event) => {
    const filePath = URI.parse(event.document.uri).fsPath
    // Back to what's saved, or out if it isn't part of the folders.
    if (index.covers(filePath)) index.refreshFromDisk(filePath)
    else index.remove(filePath)
  })

  connection.onDidChangeWatchedFiles((params) => {
    for (const change of params.changes) {
      if (documents.get(change.uri)) continue // the editor's text wins
      const filePath = URI.parse(change.uri).fsPath
      if (change.type === FileChangeType.Deleted) index.remove(filePath)
      else index.refreshFromDisk(filePath)
    }
  })

  const fileAt = (uri: string) => {
    const open = documents.get(uri)
    if (open && !index.get(uri)) index.setFromText(uri, open.getText())
    return index.get(uri)
  }

  const toLsp = (location: Location): LspLocation => ({
    uri: location.uri,
    range: {
      start: location.file.document.positionAt(location.range.start),
      end: location.file.document.positionAt(location.range.end),
    },
  })

  connection.onDefinition(async (params) => {
    try {
      const file = fileAt(params.textDocument.uri)
      if (!file) return null
      const found = await nameAt(
        file,
        file.document.offsetAt(params.position),
        index,
        isPointer
      )
      if (!found) return null
      const definitions = findDefinitions(index, found.name, file.uri)
      if (!linkSupport) return definitions.map(toLsp)
      // A link says which text is the link: the whole name. Otherwise
      // VS Code underlines the word under the mouse, which ends at a "."
      // (sign_board.mt_0o004 would show as two links).
      const origin = {
        start: file.document.positionAt(found.range.start),
        end: file.document.positionAt(found.range.end),
      }
      return definitions.map((definition): LocationLink => {
        const { uri, range } = toLsp(definition)
        const whole = definition.unitRange ?? definition.range
        return {
          originSelectionRange: origin,
          targetUri: uri,
          targetRange: {
            start: definition.file.document.positionAt(whole.start),
            end: definition.file.document.positionAt(whole.end),
          },
          targetSelectionRange: range,
        }
      })
    } catch (error) {
      logger.error(
        'DEFINITION_FAILED',
        'Go to Definition failed',
        describeError(error),
        params.textDocument.uri
      )
      return null
    }
  })

  connection.onReferences(async (params) => {
    try {
      const file = fileAt(params.textDocument.uri)
      if (!file) return null
      const found = await nameAt(
        file,
        file.document.offsetAt(params.position),
        index,
        isPointer
      )
      if (!found) return null
      const locations = await findReferences(
        index,
        found.name,
        file.uri,
        isPointer,
        params.context.includeDeclaration
      )
      return locations.map(toLsp)
    } catch (error) {
      logger.error(
        'REFERENCES_FAILED',
        'Find References failed',
        describeError(error),
        params.textDocument.uri
      )
      return null
    }
  })

  connection.onPrepareRename(async (params) => {
    const file = fileAt(params.textDocument.uri)
    if (!file) return null
    const found = await nameAt(
      file,
      file.document.offsetAt(params.position),
      index,
      isPointer
    )
    if (!found) return null
    if (findDefinitions(index, found.name, file.uri).length === 0)
      throw new ResponseError(
        ErrorCodes.InvalidRequest,
        `"${found.name}" isn't defined in the open folders (it's the game's, or another mod's), so it can't be renamed here`
      )
    return {
      range: {
        start: file.document.positionAt(found.range.start),
        end: file.document.positionAt(found.range.end),
      },
      placeholder: found.name,
    }
  })

  connection.onRenameRequest(async (params): Promise<WorkspaceEdit | null> => {
    const file = fileAt(params.textDocument.uri)
    if (!file) return null
    const found = await nameAt(
      file,
      file.document.offsetAt(params.position),
      index,
      isPointer
    )
    if (!found) return null
    const problem = renameProblem(params.newName)
    if (problem) throw new ResponseError(ErrorCodes.InvalidParams, problem)

    const locations = await renameEdits(
      index,
      found.name,
      params.newName,
      file.uri,
      isPointer
    )
    if (!locations) return null
    const changes: Record<string, TextEdit[]> = {}
    for (const location of locations) {
      const { uri, range } = toLsp(location)
      ;(changes[uri] ??= []).push({ range, newText: params.newName })
    }
    logger.info(
      'RENAME_DONE',
      `Renamed "${found.name}" to "${params.newName}": ${locations.length} places in ${Object.keys(changes).length} files`
    )
    return { changes }
  })

  return { onInitialize, onInitialized }
}

/** What the server declares for these features. */
export const INDEX_CAPABILITIES = {
  definitionProvider: true,
  referencesProvider: true,
  renameProvider: { prepareProvider: true },
  workspace: {
    workspaceFolders: { supported: true, changeNotifications: true },
  },
} as const
