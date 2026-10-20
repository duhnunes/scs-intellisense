import * as vscode from 'vscode'
import {
  DocumentFormattingRequest,
  type LanguageClient,
} from 'vscode-languageclient/node'
import { editorIndentFor } from './indent'

const LANGUAGES = new Set(['sii', 'sui'])

/** Lowercase, since VS Code compares extension ids case-insensitively. */
const EXTENSION_ID = 'duhnunes.scs-intellisense'

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

      // If VS Code's own format on save is on AND it would use this
      // extension for the file, VS Code formats it already. Only then is
      // this redundant. This extension is the default formatter for
      // .sii/.sui (configurationDefaults), so that's the case unless the
      // user picked another formatter for [sii] themselves.
      const editor = vscode.workspace.getConfiguration('editor', document)
      if (editor.get<boolean>('formatOnSave', false)) {
        const defaultFormatter = editor.get<string>('defaultFormatter')
        if (
          !defaultFormatter ||
          defaultFormatter.toLowerCase() === EXTENSION_ID
        )
          return
      }

      event.waitUntil(formatEdits(client, document))
    })
  )
}

async function formatEdits(
  client: LanguageClient,
  document: vscode.TextDocument
): Promise<vscode.TextEdit[]> {
  try {
    const edits = await client.sendRequest(DocumentFormattingRequest.type, {
      textDocument: { uri: client.code2ProtocolConverter.asUri(document.uri) },
      // The indentation the editor itself uses for this file, the same
      // one VS Code sends with Format Document.
      options: editorIndentFor(document),
    })
    return (await client.protocol2CodeConverter.asTextEdits(edits)) ?? []
  } catch {
    // The server isn't running yet, or the request failed. Saving must
    // never fail because of formatting, so the file is saved as it is.
    // (When formatter.enabled was turned on without reloading the window,
    // the server answers with no edits instead.)
    return []
  }
}
