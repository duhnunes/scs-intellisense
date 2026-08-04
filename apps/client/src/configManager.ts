import * as vscode from 'vscode'
import type { LanguageClient } from 'vscode-languageclient/node'

export class ConfigManager {
  private readonly extSection = 'scs-intellisense'
  private readonly extKey = 'semanticHighlighting'

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: LanguageClient
  ) {
    this.applyCurrentSettings()
    this.listenForChanges()
    this.registerCommands()
  }

  private applyCurrentSettings() {
    const extConfig = vscode.workspace.getConfiguration(this.extSection)
    const enabled = extConfig.get<boolean>(this.extKey, true)

    vscode.workspace
      .getConfiguration('editor')
      .update(
        'semanticHighlighting.enabled',
        enabled,
        vscode.ConfigurationTarget.Global
      )
  }

  private listenForChanges() {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${this.extSection}.${this.extKey}`)) {
        const newValue = vscode.workspace
          .getConfiguration(this.extSection)
          .get<boolean>(this.extKey, true)

        vscode.workspace
          .getConfiguration('editor')
          .update(
            'semanticHighlighting.enabled',
            newValue,
            vscode.ConfigurationTarget.Global
          )
      }
    })
  }

  private registerCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('scsIntellisense.refreshSchema', () =>
        this.refreshSchema()
      )
    )
  }

  private async refreshSchema() {
    type RefreshResult =
      | { ok: true; changed: boolean }
      | { ok: false; message: string }

    try {
      const result = await this.client.sendRequest<RefreshResult>(
        'scsIntellisense/refreshSchema'
      )

      if (!result.ok) {
        vscode.window.showErrorMessage(
          `SCS-Intellisense: failed to update the schema database — ${result.message}`
        )
        return
      }

      vscode.window.showInformationMessage(
        result.changed
          ? 'SCS-Intellisense: schema database updated.'
          : 'SCS-Intellisense: schema database is already up to date.'
      )
    } catch (err) {
      vscode.window.showErrorMessage(
        `SCS-Intellisense: failed to update the schema database — ${String(err)}`
      )
    }
  }
}
