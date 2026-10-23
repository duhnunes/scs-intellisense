import * as vscode from 'vscode'
import type { ExtensionLog } from './log'

/**
 * Marks the lines whose paths the server rewrote when a file or folder
 * moved, the way git marks changed lines: a bar in the gutter and on the
 * scrollbar, so the user finds them in a long file before saving. VS Code
 * opens the changed files unsaved; the marks of a file go once it's
 * saved, closed, or back to what's on disk (Ctrl+Z on the move).
 */
export class PathEditMarks implements vscode.Disposable {
  // A left border on the whole line, in the theme's color for lines git
  // marks as modified: no image to load, and it reads as the same thing.
  private readonly decoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderStyle: 'solid',
    borderWidth: '0 0 0 3px',
    borderColor: new vscode.ThemeColor('editorGutter.modifiedBackground'),
    overviewRulerColor: new vscode.ThemeColor(
      'editorOverviewRuler.modifiedForeground'
    ),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  })
  /** Marked lines (0-based), by document URI. */
  private readonly marks = new Map<string, Set<number>>()
  private readonly subscriptions: vscode.Disposable[] = []

  private readonly log: ExtensionLog

  constructor(log: ExtensionLog) {
    this.log = log
    this.subscriptions.push(
      this.decoration,
      vscode.window.onDidChangeVisibleTextEditors(() => this.paint()),
      vscode.window.onDidChangeActiveTextEditor(() => this.paint()),
      vscode.workspace.onDidChangeTextDocument((event) => this.follow(event)),
      vscode.workspace.onDidSaveTextDocument((document) =>
        this.clear(document.uri)
      ),
      vscode.workspace.onDidCloseTextDocument((document) =>
        this.clear(document.uri)
      )
    )
  }

  /** The middleware for willRenameFiles: remembers the lines of the edits
   *  the server returned, at the files' new place if they moved too. */
  remember(
    event: vscode.FileWillRenameEvent,
    edit: vscode.WorkspaceEdit | null | undefined
  ): void {
    if (!edit) return
    for (const [uri, edits] of edit.entries()) {
      const key = movedUri(uri, event.files).toString()
      const lines = this.marks.get(key) ?? new Set<number>()
      for (const change of edits)
        if ('range' in change) lines.add(change.range.start.line)
      if (lines.size > 0) this.marks.set(key, lines)
    }
    const files = this.marks.size
    this.log.info(
      'PATH_MARKS_ADDED',
      `Marked the lines of ${edit.size} file(s) whose paths a move updated (${files} file(s) marked in all)`
    )
    // The files open (unsaved) once VS Code applies the edits, which can
    // wait for its "refactoring changes" dialog.
    for (const delay of [200, 1000, 3000]) setTimeout(() => this.paint(), delay)
  }

  dispose(): void {
    for (const subscription of this.subscriptions) subscription.dispose()
  }

  private paint(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const lines = this.marks.get(editor.document.uri.toString())
      if (!lines) continue
      editor.setDecorations(
        this.decoration,
        [...lines].map((line) => ({
          range: editor.document.lineAt(
            Math.min(line, editor.document.lineCount - 1)
          ).range,
          hoverMessage: 'Path updated by SCS IntelliSense after a file move',
        }))
      )
    }
  }

  /** Keeps the marks on their lines as the user edits above them; drops
   *  them when the file is back to what's saved. */
  private follow(event: vscode.TextDocumentChangeEvent): void {
    const key = event.document.uri.toString()
    const lines = this.marks.get(key)
    if (!lines) return
    // Undone back to what's saved (Ctrl+Z on the move).
    const undoing =
      event.reason === vscode.TextDocumentChangeReason.Undo ||
      event.reason === vscode.TextDocumentChangeReason.Redo
    if (undoing && !event.document.isDirty) {
      this.clear(event.document.uri)
      return
    }
    let moved = [...lines]
    for (const change of event.contentChanges) {
      const removed = change.range.end.line - change.range.start.line
      const added = change.text.split('\n').length - 1
      const delta = added - removed
      if (delta === 0) continue
      moved = moved.map((line) =>
        line > change.range.end.line ? line + delta : line
      )
    }
    this.marks.set(key, new Set(moved))
    this.paint()
  }

  private clear(uri: vscode.Uri): void {
    const key = uri.toString()
    if (!this.marks.delete(key)) return
    for (const editor of vscode.window.visibleTextEditors)
      if (editor.document.uri.toString() === key)
        editor.setDecorations(this.decoration, [])
  }
}

/** Where `uri` is after the renames: a moved file, or one inside a moved
 *  folder. */
function movedUri(
  uri: vscode.Uri,
  files: readonly { oldUri: vscode.Uri; newUri: vscode.Uri }[]
): vscode.Uri {
  const path = uri.fsPath.toLowerCase()
  for (const { oldUri, newUri } of files) {
    const from = oldUri.fsPath.toLowerCase()
    if (path === from) return newUri
    const inside = path.startsWith(from + '\\') || path.startsWith(from + '/')
    if (inside)
      return vscode.Uri.joinPath(
        newUri,
        ...uri.fsPath.slice(from.length + 1).split(/[\\/]/)
      )
  }
  return uri
}
