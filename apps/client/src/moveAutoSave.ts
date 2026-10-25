import * as vscode from 'vscode'
import type { ExtensionLog } from './log'
import { movedUri } from './moveUndo'

/** A move whose path edits touched these files. */
interface Move {
  files: { from: vscode.Uri; to: vscode.Uri }[]
  /** Each edited file where it is after the move, and whether the user
   *  had it unsaved, or open in a tab, before. */
  edited: { uri: vscode.Uri; wasDirty: boolean; hadTab: boolean }[]
}

/**
 * Saves files a move edited, and closes the tabs it opened. VS Code opens
 * a tab, unsaved, for every file whose paths a move changed: renaming
 * f350_heavy_duty in ATS Expansion left 57 of them (owner's test). Which
 * ones are saved is up to the `fileMoves.*` settings (filesToSave()); the
 * rest stay for review, with their lines marked (pathEditMarks.ts). Files
 * the user already had unsaved are left alone, and so are tabs already
 * open. Undoing such a move (Ctrl+Z in the Explorer) does the same with
 * the restored files.
 */
export class MoveAutoSave implements vscode.Disposable {
  private pending: Move | undefined
  private saved: Move | undefined
  private readonly log: ExtensionLog
  private readonly subscription: vscode.Disposable

  constructor(log: ExtensionLog) {
    this.log = log
    this.subscription = vscode.workspace.onDidRenameFiles((event) =>
      this.renamed(event)
    )
  }

  /** From the willRenameFiles middleware, before VS Code applies `edit`. */
  remember(
    event: vscode.FileWillRenameEvent,
    edit: vscode.WorkspaceEdit | null | undefined
  ): void {
    const files = event.files.map((file) => ({
      from: file.oldUri,
      to: file.newUri,
    }))
    if (!edit || edit.size === 0) {
      this.pending = undefined
      return
    }
    const tabs = openTabs()
    this.pending = {
      files,
      edited: edit.entries().map(([uri]) => ({
        uri: movedUri(uri, files),
        wasDirty:
          vscode.workspace.textDocuments.find((document) =>
            sameUri(document.uri, uri)
          )?.isDirty ?? false,
        hadTab: tabs.some((tab) => sameUri(tab, uri)),
      })),
    }
  }

  dispose(): void {
    this.subscription.dispose()
  }

  private renamed(event: vscode.FileRenameEvent): void {
    const pending = this.pending
    this.pending = undefined
    if (pending && sameMoves(event, pending.files, false)) {
      this.saved = undefined
      const toSave = filesToSave(pending.edited)
      if (toSave.length === 0) return
      const move = { ...pending, edited: toSave }
      this.saved = move
      // The edits are in by now; the tabs can open a little later.
      for (const delay of [500, 2000])
        setTimeout(() => void this.tidy(move.edited, delay === 500), delay)
      return
    }
    const saved = this.saved
    this.saved = undefined
    if (!saved || !sameMoves(event, saved.files, true)) return
    // Undone: VS Code puts back what it can, then moveUndo.ts the rest
    // (300 ms after the move), leaving those files unsaved again.
    const back = saved.files.map(({ from, to }) => ({ from: to, to: from }))
    const edited = saved.edited.map((file) => ({
      ...file,
      uri: movedUri(file.uri, back),
    }))
    for (const delay of [1500, 4000])
      setTimeout(() => void this.tidy(edited, false), delay)
  }

  /** Saves the edited files the user had no unsaved changes in, and closes
   *  the tabs that weren't open before. */
  private async tidy(edited: Move['edited'], report: boolean): Promise<void> {
    let count = 0
    for (const file of edited) {
      if (file.wasDirty) continue
      const document = vscode.workspace.textDocuments.find((open) =>
        sameUri(open.uri, file.uri)
      )
      if (document?.isDirty && (await document.save())) count++
    }
    const close = vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter(
        (tab) =>
          tab.input instanceof vscode.TabInputText &&
          !tab.isDirty &&
          edited.some(
            (file) =>
              !file.hadTab &&
              sameUri(file.uri, (tab.input as vscode.TabInputText).uri)
          )
      )
    if (close.length > 0) await vscode.window.tabGroups.close(close)
    if (count === 0 && close.length === 0) return
    this.log.info(
      'PATHS_SAVED',
      `Saved ${count} file(s) whose paths a move updated and closed ${close.length} tab(s) it opened`
    )
    const notify = vscode.workspace
      .getConfiguration('scs-intellisense')
      .get<boolean>('fileMoves.notify', true)
    if (report && notify && count > 0)
      void vscode.window.showInformationMessage(
        `SCS IntelliSense updated the paths in ${count} files and saved them.`
      )
  }
}

/**
 * The edited files to save, by the settings: every file of a type in
 * `fileMoves.alwaysSave` (`.mat` by default: written by SCS Blender Tools'
 * converter, and 56 of the 57 files that rename opened), and the others
 * too when there are more than `fileMoves.saveAbove` of them.
 */
function filesToSave(edited: Move['edited']): Move['edited'] {
  const settings = vscode.workspace.getConfiguration('scs-intellisense')
  if (!settings.get<boolean>('fileMoves.autoSave', true)) return []
  const always = settings
    .get<string[]>('fileMoves.alwaysSave', ['.mat'])
    .map((type) => type.toLowerCase())
  const limit = settings.get<number>('fileMoves.saveAbove', 6)
  const isAlways = (file: Move['edited'][number]) =>
    always.some((type) => file.uri.fsPath.toLowerCase().endsWith(type))
  const others = edited.filter((file) => !isAlways(file))
  return others.length > limit ? edited : edited.filter(isAlways)
}

/** The files open in tabs, where they are now. */
function openTabs(): vscode.Uri[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .flatMap((tab) =>
      tab.input instanceof vscode.TabInputText ? [tab.input.uri] : []
    )
}

/** `event` is the move `files` (or, `reversed`, its undo). */
function sameMoves(
  event: vscode.FileRenameEvent,
  files: { from: vscode.Uri; to: vscode.Uri }[],
  reversed: boolean
): boolean {
  return event.files.every((file) =>
    files.some((moved) =>
      reversed
        ? sameUri(file.oldUri, moved.to) && sameUri(file.newUri, moved.from)
        : sameUri(file.oldUri, moved.from) && sameUri(file.newUri, moved.to)
    )
  )
}

function sameUri(a: vscode.Uri, b: vscode.Uri): boolean {
  return a.fsPath.toLowerCase() === b.fsPath.toLowerCase()
}
