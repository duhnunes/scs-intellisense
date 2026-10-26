import {
  ErrorCodes,
  FileChangeType,
  ResponseError,
  type Connection,
  type DocumentLink,
  type InitializeParams,
  type Location as LspLocation,
  type LocationLink,
  type ServerCapabilities,
  type TextDocuments,
  type TextEdit,
  type WorkspaceEdit,
} from 'vscode-languageserver/node'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { POINTER_TYPES } from '../completion/pointer'
import { describeError, getLogger } from '../logger'
import type { SchemaClient } from '../schema/client'
import { moveEdits } from './fileMoves'
import { pathAt, pathReferences, resolvePathRef } from './filePaths'
import {
  findDefinitions,
  findReferences,
  nameAt,
  renameEdits,
  renameProblem,
  type Location,
} from './navigation'
import {
  WorkspaceIndex,
  type IndexedFile,
  type PointerCheck,
} from './workspaceIndex'

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
  getSchemaClient: () => SchemaClient | undefined,
  /** After the folders are read, and after files change on disk. */
  onIndexed?: () => void
): {
  onInitialize: (params: InitializeParams) => void
  onInitialized: () => void
} {
  let folders: string[] = []
  let linkSupport = false

  const isPointer: PointerCheck = async (className, key, bracketed) => {
    const schema = await getSchemaClient()?.getSchemaContent(className)
    const def = schema?.key?.[key]
    if (!def || !POINTER_TYPES.has(def.type)) return false
    // `items: 5` on an array is its count; the elements are `items[n]`.
    return bracketed || !def.isArray
  }

  // Settled once the folders are read, and again after each new read.
  // A move must wait for it: computed on a half-read index, the edits
  // missed every file not read yet (renaming a folder 10 s after opening
  // ATS Expansion: 36 paths of 105, owner's test), and nothing said so.
  // Made before the first read starts, so a move even before it waits.
  let indexed!: () => void
  let ready = new Promise<void>((resolve) => (indexed = resolve))
  let reads = 0
  let readsDone = 0

  const rescan = async () => {
    // A new read after the index was ready: moves wait for it again.
    if (reads > 0 && reads === readsDone)
      ready = new Promise<void>((resolve) => (indexed = resolve))
    reads++
    const started = Date.now()
    try {
      const count = await index.scan(
        folders,
        (uri) => documents.get(uri) !== undefined
      )
      logger.info(
        'INDEX_READY',
        `Indexed ${count} .sii/.sui/.mat/.tobj files in ${Date.now() - started} ms`
      )
      onIndexed?.()
    } catch (error) {
      logger.error(
        'INDEX_FAILED',
        'Indexing the folders failed',
        describeError(error)
      )
    }
    readsDone++
    if (readsDone === reads) indexed()
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
    onIndexed?.()
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
      const offset = file.document.offsetAt(params.position)

      // Paths are document links (onDocumentLinks), not definitions.
      const found = await nameAt(file, offset, index, isPointer)
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

  // Every path naming a file of the mod is a link: Ctrl+click opens it.
  // A link, not a definition: VS Code underlines it on Ctrl+hover without
  // trying to preview the target, which for a binary .pmd showed nothing
  // (owner's test). A path to one of the game's files gets no link.
  const linksOf = (file: IndexedFile): DocumentLink[] => {
    const links: DocumentLink[] = []
    for (const ref of file.paths) {
      const target = resolvePathRef(file, ref)
      if (!target) continue
      links.push({
        range: {
          start: file.document.positionAt(ref.range.start),
          end: file.document.positionAt(ref.range.end),
        },
        target: URI.file(target).toString(),
      })
    }
    return links
  }

  // .mat, .tobj and .soundref aren't this extension's languages, so VS
  // Code never asks the server for their links: the client does, with this
  // request, for the paths the index already holds (owner noticed no
  // Ctrl+click in a .soundref).
  connection.onRequest(
    'scsIntellisense/pathLinks',
    (params: { uri: string }): DocumentLink[] => {
      const file = index.get(params.uri)
      return file ? linksOf(file) : []
    }
  )

  connection.onDocumentLinks((params): DocumentLink[] => {
    try {
      const file = fileAt(params.textDocument.uri)
      return file ? linksOf(file) : []
    } catch (error) {
      logger.error(
        'LINKS_FAILED',
        'Finding the links to files failed',
        describeError(error),
        params.textDocument.uri
      )
      return []
    }
  })

  connection.onReferences(async (params) => {
    try {
      const file = fileAt(params.textDocument.uri)
      if (!file) return null
      const offset = file.document.offsetAt(params.position)

      // A path: every path naming the same file, .mat and .tobj included.
      const ref = pathAt(file, offset)
      if (ref) {
        const target = resolvePathRef(file, ref)
        if (!target) return null
        return pathReferences(index, target).map(({ file: other, ref: r }) =>
          toLsp({ uri: other.uri, file: other, range: r.range })
        )
      }

      const found = await nameAt(file, offset, index, isPointer)
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

  // Before VS Code renames or moves a file or folder (Explorer, drag and
  // drop): the paths pointing at it are rewritten in the same step, with
  // no question asked, like TypeScript's imports. Moves done outside VS
  // Code don't pass through here.
  // .mat/.tobj in the editor: the client sends their text (they aren't
  // this server's languages), so unsaved paths are seen.
  connection.onNotification(
    'scsIntellisense/textureFileChanged',
    (params: { uri: string; text: string }) =>
      index.setFromText(params.uri, params.text)
  )
  connection.onNotification(
    'scsIntellisense/textureFileClosed',
    (params: { uri: string }) => {
      const filePath = URI.parse(params.uri).fsPath
      if (index.covers(filePath)) index.refreshFromDisk(filePath)
      else index.remove(filePath)
    }
  )

  connection.workspace.onWillRenameFiles(async (params) => {
    try {
      if (reads === 0 || readsDone < reads) {
        logger.info(
          'PATHS_WAITING',
          `A move waits for the folders to be read (${index.size} files so far)`
        )
        await ready
      }
      const edits = moveEdits(
        index,
        params.files.map((file) => ({
          from: URI.parse(file.oldUri).fsPath,
          to: URI.parse(file.newUri).fsPath,
        }))
      )
      if (edits.length === 0) {
        // Said, so a move that changes nothing isn't a mystery (no dialog
        // from VS Code either: it only asks when there are edits).
        logger.info(
          'PATHS_NONE',
          `Moved ${params.files.length} item(s): no path in the open folders points to them`
        )
        return null
      }
      const changes: Record<string, TextEdit[]> = {}
      for (const edit of edits)
        (changes[edit.file.uri] ??= []).push({
          range: {
            start: edit.file.document.positionAt(edit.range.start),
            end: edit.file.document.positionAt(edit.range.end),
          },
          newText: edit.newText,
        })
      logger.info(
        'PATHS_UPDATED',
        `Moved ${params.files.length} item(s): ${edits.length} paths updated in ${Object.keys(changes).length} files`
      )
      return { changes }
    } catch (error) {
      logger.error(
        'PATHS_UPDATE_FAILED',
        'Updating paths after a move failed',
        describeError(error)
      )
      return null
    }
  })

  return { onInitialize, onInitialized }
}

/** What the server declares for these features. */
export const INDEX_CAPABILITIES: ServerCapabilities = {
  definitionProvider: true,
  referencesProvider: true,
  documentLinkProvider: { resolveProvider: false },
  renameProvider: { prepareProvider: true },
  workspace: {
    workspaceFolders: { supported: true, changeNotifications: true },
    // Any file or folder: a moved .pmd or .tobj is pointed at too.
    fileOperations: {
      willRename: { filters: [{ scheme: 'file', pattern: { glob: '**/*' } }] },
    },
  },
}
