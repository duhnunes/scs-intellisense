import * as vscode from 'vscode'
import type { LanguageClient } from 'vscode-languageclient/node'
import type { ExtensionLog } from './log'

/** Mirrors FileFormatResult in the server's formatter/workspaceFormat.ts. */
interface FileFormatResult {
  uri: string
  status: 'unchanged' | 'changed' | 'skipped'
  reason?:
    | 'structural'
    | 'contentMismatch'
    | 'binary'
    | 'notUtf8'
    | 'readError'
    | 'writeError'
  line?: number
  message?: string
  newText?: string
}

/** Files per request, so a big workspace shows progress and can be
 *  cancelled between batches instead of blocking on one huge request. */
const BATCH_SIZE = 100

/**
 * "Check Formatting" and "Format All Files": the formatter run over every
 * .sii/.sui in the workspace, like `prettier --check` / `prettier --write`.
 * Finding files, the confirmation, editor edits and the report live here;
 * reading, formatting and writing files happen in the server.
 */
export function registerWorkspaceFormatCommands(
  context: vscode.ExtensionContext,
  client: LanguageClient,
  log: ExtensionLog
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('scsIntellisense.checkFormatting', () =>
      runWorkspaceFormat(client, log, false)
    ),
    vscode.commands.registerCommand('scsIntellisense.formatAllFiles', () =>
      runWorkspaceFormat(client, log, true)
    )
  )
}

async function runWorkspaceFormat(
  client: LanguageClient,
  log: ExtensionLog,
  write: boolean
) {
  const commandName = write ? 'Format All Files' : 'Check Formatting'

  // The server only formats with the settings it got at startup, so the
  // setting has to be on (and the window reloaded) for this to be honest.
  const formatterEnabled = vscode.workspace
    .getConfiguration('scs-intellisense')
    .get<boolean>('formatter.enabled', false)
  if (!formatterEnabled) {
    vscode.window.showInformationMessage(
      'SCS IntelliSense: the formatter is experimental and off. Enable "scs-intellisense.formatter.enabled" and reload the window to use this command.'
    )
    return
  }

  if (!vscode.workspace.workspaceFolders?.length) {
    vscode.window.showInformationMessage(
      `SCS IntelliSense: open a folder to run ${commandName}.`
    )
    return
  }

  const uris = (
    await vscode.workspace.findFiles('**/*.{sii,sui}', '**/node_modules/**')
  ).sort((a, b) => a.fsPath.localeCompare(b.fsPath))

  if (uris.length === 0) {
    vscode.window.showInformationMessage(
      'SCS IntelliSense: no .sii or .sui files found in this workspace.'
    )
    return
  }

  const checked = await processInBatches(
    client,
    uris,
    false,
    `Checking formatting of ${uris.length} files`
  )
  if (!checked) return

  if (!write) {
    report(log, commandName, uris.length, checked.results, checked.cancelled)
    return
  }

  const toFormat = checked.results.filter((r) => r.status === 'changed')
  const skipped = checked.results.filter((r) => r.status === 'skipped')
  if (toFormat.length === 0) {
    report(log, commandName, uris.length, checked.results, checked.cancelled)
    return
  }

  const skippedNote =
    skipped.length > 0
      ? ` ${skipped.length} file(s) will be skipped (see the Output after running).`
      : ''
  const answer = await vscode.window.showWarningMessage(
    `Format ${toFormat.length} of ${uris.length} .sii/.sui files?`,
    {
      modal: true,
      detail: `Files that aren't open are changed directly on disk, and Ctrl+Z can't undo that. If the mod is under version control (git), you can review or revert the changes there.${skippedNote}`,
    },
    'Format'
  )
  if (answer !== 'Format') return

  // Only the files the check said would change are sent again, so the
  // server reformats from the current content, not from the check's copy.
  const formatted = await processInBatches(
    client,
    toFormat.map((r) => vscode.Uri.parse(r.uri)),
    true,
    `Formatting ${toFormat.length} files`
  )
  if (!formatted) return

  await applyOpenEditorEdits(formatted.results)

  const unchanged = checked.results.filter((r) => r.status === 'unchanged')
  report(
    log,
    commandName,
    uris.length,
    [...unchanged, ...skipped, ...formatted.results],
    formatted.cancelled
  )
}

async function processInBatches(
  client: LanguageClient,
  uris: vscode.Uri[],
  write: boolean,
  title: string
): Promise<{ results: FileFormatResult[]; cancelled: boolean } | undefined> {
  const openDocuments = new Map(
    vscode.workspace.textDocuments.map((doc) => [doc.uri.toString(), doc])
  )

  try {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `SCS IntelliSense: ${title}`,
        cancellable: true,
      },
      async (progress, token) => {
        const results: FileFormatResult[] = []
        for (let start = 0; start < uris.length; start += BATCH_SIZE) {
          if (token.isCancellationRequested) return { results, cancelled: true }

          const files = uris.slice(start, start + BATCH_SIZE).map((uri) => {
            const open = openDocuments.get(uri.toString())
            return open
              ? { uri: uri.toString(), openText: open.getText() }
              : { uri: uri.toString() }
          })
          results.push(
            ...(await client.sendRequest<FileFormatResult[]>(
              'scsIntellisense/formatFiles',
              { files, write }
            ))
          )
          progress.report({
            increment: (files.length / uris.length) * 100,
            message: `${results.length}/${uris.length}`,
          })
        }
        return { results, cancelled: false }
      }
    )
  } catch (error) {
    vscode.window.showErrorMessage(
      `SCS IntelliSense: ${title} failed — ${String(error)}`
    )
    return undefined
  }
}

/** Open files come back as text instead of being written to disk, so
 *  they go through the editor: undoable, and unsaved changes aren't lost.
 *  A file that had no unsaved changes is saved afterwards, to match what
 *  happens to every file that isn't open. */
async function applyOpenEditorEdits(results: FileFormatResult[]) {
  for (const result of results) {
    if (result.newText === undefined) continue
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === result.uri
    )
    if (!document) continue

    const wasDirty = document.isDirty
    const edit = new vscode.WorkspaceEdit()
    edit.replace(
      document.uri,
      new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      ),
      result.newText
    )
    if ((await vscode.workspace.applyEdit(edit)) && !wasDirty) {
      await document.save()
    }
  }
}

const SKIP_REASONS: Record<NonNullable<FileFormatResult['reason']>, string> = {
  structural: 'structural error',
  contentMismatch:
    'the formatter would change the content, not just spacing (a bug in SCS IntelliSense — please report it)',
  binary: 'binary or encrypted file',
  notUtf8: 'not UTF-8 text',
  readError: 'could not read the file',
  writeError: 'could not write the file',
}

function describeSkip(result: FileFormatResult): string {
  const reason = result.reason ? SKIP_REASONS[result.reason] : 'skipped'
  if (result.reason === 'structural') {
    return `${reason} at line ${result.line}: ${result.message}`
  }
  return result.message ? `${reason}: ${result.message}` : reason
}

/** Only files that change or are skipped are listed — a file that is
 *  already formatted needs no action, and listing thousands of them would
 *  bury the ones that do. */
function report(
  log: ExtensionLog,
  commandName: string,
  total: number,
  results: FileFormatResult[],
  cancelled: boolean
) {
  const write = commandName === 'Format All Files'
  const changed = results.filter((r) => r.status === 'changed')
  const skipped = results.filter((r) => r.status === 'skipped')
  const unchanged = results.filter((r) => r.status === 'unchanged')
  const path = (r: FileFormatResult) =>
    vscode.workspace.asRelativePath(vscode.Uri.parse(r.uri))

  log.reportLine(
    `${new Date().toISOString()} ${commandName} — ${total} .sii/.sui files`
  )
  for (const r of changed) {
    log.reportLine(`  ${write ? 'formatted   ' : 'would change'}  ${path(r)}`)
  }
  for (const r of skipped) {
    log.reportLine(`  skipped       ${path(r)} — ${describeSkip(r)}`)
  }
  if (cancelled) {
    log.reportLine(
      `  cancelled: ${total - results.length} file(s) were not processed`
    )
  }

  const summary = `${changed.length} ${write ? 'formatted' : 'would change'}, ${unchanged.length} already formatted, ${skipped.length} skipped`
  log.reportLine(`Summary: ${summary}`)
  log.channel.show(true)

  vscode.window.showInformationMessage(
    `SCS IntelliSense: ${commandName}${cancelled ? ' (cancelled)' : ''} — ${summary}.`
  )
}
