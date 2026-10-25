import * as os from 'node:os'
import * as vscode from 'vscode'
import { editorIndentFor } from './indent'
import type { ExtensionLog } from './log'

const ISSUES_URL = 'https://github.com/duhnunes/scs-intellisense/issues'

/** Log entries included in a report: enough to see what led to a bug,
 *  short enough to paste into an issue or a forum post. */
const REPORT_LOG_LINES = 50

/**
 * "Copy Bug Report Info": copies what a bug report needs (versions,
 * settings, recent log) to the clipboard, so users paste one block into
 * an issue or the forum topic instead of collecting it by hand.
 */
export function registerBugReportCommand(
  context: vscode.ExtensionContext,
  log: ExtensionLog
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'scsIntellisense.copyBugReportInfo',
      async () => {
        await vscode.env.clipboard.writeText(buildReport(context, log))
        const open = 'Open GitHub Issues'
        const choice = await vscode.window.showInformationMessage(
          'SCS IntelliSense: bug report info copied. Paste it into your issue or forum post; it includes the recent log, so check it before posting publicly.',
          open
        )
        if (choice === open)
          vscode.env.openExternal(vscode.Uri.parse(ISSUES_URL))
      }
    )
  )
}

function buildReport(
  context: vscode.ExtensionContext,
  log: ExtensionLog
): string {
  const settings = vscode.workspace.getConfiguration('scs-intellisense')
  const onOff = (key: string, fallback: boolean) =>
    settings.get<boolean>(key, fallback) ? 'on' : 'off'
  const editor = vscode.window.activeTextEditor
  const entries = log.recentEntries().slice(-REPORT_LOG_LINES)

  // The indentation the formatter would use for the active file: it
  // follows the editor, so it matters for formatting bugs.
  const indent = editor ? editorIndentFor(editor.document) : undefined
  const indentText = indent
    ? indent.insertSpaces
      ? `${indent.tabSize} spaces`
      : 'tab'
    : 'no active file'

  return [
    '### SCS IntelliSense bug report info',
    '',
    `- Extension: ${context.extension.packageJSON.version}`,
    `- VS Code: ${vscode.version}`,
    `- OS: ${os.type()} ${os.release()} (${process.arch})`,
    `- Completion: ${onOff('completion.enabled', false)}`,
    `- Hover: ${onOff('hover.enabled', false)}`,
    `- Formatter: ${onOff('formatter.enabled', false)} (format on save: ${onOff('formatter.formatOnSave', true)}, brace style: ${settings.get('formatter.braceStyle', '1tbs')}, indent units: ${onOff('formatter.indentUnits', true)}, indentation: ${indentText})`,
    `- Diagnostics shown: ${settings.get<string[]>('diagnostics.enabledSeverities', []).join(', ')}`,
    `- File moves: auto save ${onOff('fileMoves.autoSave', true)} (always: ${settings.get<string[]>('fileMoves.alwaysSave', ['.mat']).join(', ') || 'none'}, above ${settings.get<number>('fileMoves.saveAbove', 6)} files, notify: ${onOff('fileMoves.notify', true)})`,
    `- Active file: ${editor ? `${vscode.workspace.asRelativePath(editor.document.uri)} (${editor.document.languageId})` : 'none'}`,
    '',
    `Recent log (last ${entries.length} entries, all levels):`,
    '```',
    ...(entries.length > 0 ? entries : ['(empty)']),
    '```',
  ].join('\n')
}
