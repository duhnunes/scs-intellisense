import * as vscode from 'vscode'
import type { ExtensionLog } from './log'

/** One path the server rewrote: where, what it was, what it became. */
interface PathChange {
  /** The file, where it is after the move. */
  uri: vscode.Uri
  line: number
  oldText: string
  newText: string
}

interface Move {
  files: { from: vscode.Uri; to: vscode.Uri }[]
  changes: PathChange[]
}

/**
 * Puts paths back when a move is undone. VS Code groups the server's path
 * edits with the move for Ctrl+Z, but undoing a folder rename put the
 * folder back and left the edits (owner's test, ATS Expansion: 61 .mat
 * files kept the new folder name). So the paths of the last move are
 * remembered with their old text; when that move is reversed, every line
 * still holding the new text gets the old one back. Where VS Code did
 * undo them, nothing is left to do.
 */
export class MoveUndo implements vscode.Disposable {
  private last: Move | undefined
  private readonly log: ExtensionLog
  private readonly subscription: vscode.Disposable

  constructor(log: ExtensionLog) {
    this.log = log
    this.subscription = vscode.workspace.onDidRenameFiles((event) =>
      this.renamed(event)
    )
  }

  /** From the willRenameFiles middleware, before VS Code applies `edit`:
   *  reads the text each edit replaces. */
  async remember(
    event: vscode.FileWillRenameEvent,
    edit: vscode.WorkspaceEdit | null | undefined
  ): Promise<void> {
    const files = event.files.map((file) => ({
      from: file.oldUri,
      to: file.newUri,
    }))
    if (!edit || edit.size === 0) {
      this.last = undefined
      return
    }
    const changes: PathChange[] = []
    for (const [uri, edits] of edit.entries()) {
      let document: vscode.TextDocument
      try {
        document = await vscode.workspace.openTextDocument(uri)
      } catch {
        continue
      }
      for (const change of edits)
        if ('range' in change && 'newText' in change)
          changes.push({
            uri: movedUri(uri, files),
            line: change.range.start.line,
            oldText: document.getText(change.range),
            newText: change.newText,
          })
    }
    this.last = { files, changes }
  }

  dispose(): void {
    this.subscription.dispose()
  }

  private renamed(event: vscode.FileRenameEvent): void {
    const move = this.last
    const reverses =
      move !== undefined &&
      event.files.every((file) =>
        move.files.some(
          (moved) =>
            sameUri(file.oldUri, moved.to) && sameUri(file.newUri, moved.from)
        )
      )
    this.log.debug(
      'MOVE_SEEN',
      `Renamed ${event.files.map((file) => `${vscode.workspace.asRelativePath(file.oldUri)} -> ${vscode.workspace.asRelativePath(file.newUri)}`).join(', ')}${reverses ? ' (undoes the last move)' : ''}`
    )
    if (!move) return
    // Any other rename makes the remembered one stale.
    this.last = undefined
    if (!reverses) return
    // VS Code applies its own undo of the edits right after the files.
    setTimeout(() => void this.restore(move), 300)
  }

  private async restore(move: Move): Promise<void> {
    const back = move.files.map(({ from, to }) => ({ from: to, to: from }))
    const edit = new vscode.WorkspaceEdit()
    let count = 0
    for (const change of move.changes) {
      const uri = movedUri(change.uri, back)
      let document: vscode.TextDocument
      try {
        document = await vscode.workspace.openTextDocument(uri)
      } catch {
        continue
      }
      if (change.line >= document.lineCount) continue
      const line = document.lineAt(change.line).text
      const at = line.indexOf(change.newText)
      if (at < 0) continue
      edit.replace(
        uri,
        new vscode.Range(
          change.line,
          at,
          change.line,
          at + change.newText.length
        ),
        change.oldText
      )
      count++
    }
    if (count === 0) {
      this.log.debug(
        'PATHS_RESTORE_NONE',
        `A move was undone: all ${move.changes.length} path(s) were already back`
      )
      return
    }
    await vscode.workspace.applyEdit(edit)
    this.log.info(
      'PATHS_RESTORED',
      `A move was undone: ${count} path(s) VS Code left changed were put back in ${edit.size} file(s)`
    )
  }
}

/** Where `uri` is after `files` moved: a moved file, or one inside a
 *  moved folder. */
export function movedUri(
  uri: vscode.Uri,
  files: readonly { from: vscode.Uri; to: vscode.Uri }[]
): vscode.Uri {
  const path = uri.fsPath.toLowerCase()
  for (const { from, to } of files) {
    const start = from.fsPath.toLowerCase()
    if (path === start) return to
    if (path.startsWith(start + '\\') || path.startsWith(start + '/'))
      return vscode.Uri.joinPath(
        to,
        ...uri.fsPath.slice(start.length + 1).split(/[\\/]/)
      )
  }
  return uri
}

function sameUri(a: vscode.Uri, b: vscode.Uri): boolean {
  return a.fsPath.toLowerCase() === b.fsPath.toLowerCase()
}
