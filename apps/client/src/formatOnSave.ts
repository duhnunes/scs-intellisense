import * as vscode from 'vscode'
import {
  DocumentFormattingRequest,
  type LanguageClient,
} from 'vscode-languageclient/node'

const LANGUAGES = new Set(['sii', 'sui'])

/**
 * Formats .sii/.sui files on save when `formatter.formatOnSave` is on, so
 * users don't have to set `editor.formatOnSave` or `editor.defaultFormatter`
 * themselves. Edits are asked from this extension's own server, never from
 * whatever formatter VS Code would pick, and are applied as part of the
 * save, so Ctrl+Z undoes them.
 */
export function registerFormatOnSave(
  context: vscode.ExtensionContext,
  client: LanguageClient
) {
  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((event) => {
      const { document } = event
      if (!LANGUAGES.has(document.languageId)) return

      // Same rule as VS Code's own format on save: auto-save after a delay
      // doesn't format, or the file would change while the user types.
      if (event.reason === vscode.TextDocumentSaveReason.AfterDelay) return

      const settings = vscode.workspace.getConfiguration('scs-intellisense')
      if (!settings.get<boolean>('formatter.enabled', false)) return
      if (!settings.get<boolean>('formatter.formatOnSave', true)) return

      // If the user turned on VS Code's own format on save for these files,
      // VS Code already formats them; doing it here too would be wasted work.
      const editor = vscode.workspace.getConfiguration('editor', document)
      if (editor.get<boolean>('formatOnSave', false)) return

      event.waitUntil(formatEdits(client, document, editor))
    })
  )
}

async function formatEdits(
  client: LanguageClient,
  document: vscode.TextDocument,
  editor: vscode.WorkspaceConfiguration
): Promise<vscode.TextEdit[]> {
  try {
    const edits = await client.sendRequest(DocumentFormattingRequest.type, {
      textDocument: { uri: client.code2ProtocolConverter.asUri(document.uri) },
      options: {
        tabSize: editor.get<number>('tabSize', 2),
        insertSpaces: editor.get<boolean>('insertSpaces', true),
      },
    })
    return (await client.protocol2CodeConverter.asTextEdits(edits)) ?? []
  } catch {
    // The server has no formatter when formatter.enabled was turned on
    // without reloading the window (it's a startup setting). Saving must
    // never fail because of formatting, so the file is saved as it is.
    return []
  }
}
