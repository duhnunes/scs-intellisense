import * as vscode from 'vscode'
import type { LanguageClient } from 'vscode-languageclient/node'

const DEFAULT_ENABLED_SEVERITIES = ['error', 'warning', 'information', 'hint']

export class ConfigManager {
  private readonly extSection = 'scs-intellisense'
  private readonly semanticHighlightingKey = 'semanticHighlighting'
  private readonly diagnosticsSeverityKey = 'diagnostics.enabledSeverities'

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: LanguageClient
  ) {
    this.applyCurrentSettings()
    this.listenForChanges()
    this.registerCommands()
  }

  private applyCurrentSettings() {
    // Only semanticHighlighting needs applying on startup — it controls a
    // built-in VSCode setting we mirror into. diagnostics.enabledSeverities
    // and schema.fetchTimeoutMs are read directly by the server itself
    // (via initializationOptions in extension.ts), so there's nothing to
    // push here at startup, only on later changes (see listenForChanges).
    const extConfig = vscode.workspace.getConfiguration(this.extSection)
    const enabled = extConfig.get<boolean>(this.semanticHighlightingKey, true)

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
      if (
        e.affectsConfiguration(
          `${this.extSection}.${this.semanticHighlightingKey}`
        )
      ) {
        const newValue = vscode.workspace
          .getConfiguration(this.extSection)
          .get<boolean>(this.semanticHighlightingKey, true)

        vscode.workspace
          .getConfiguration('editor')
          .update(
            'semanticHighlighting.enabled',
            newValue,
            vscode.ConfigurationTarget.Global
          )
      }

      if (
        e.affectsConfiguration(
          `${this.extSection}.${this.diagnosticsSeverityKey}`
        )
      ) {
        this.sendDiagnosticSettings()
      }
    })
  }

  /** Forwards the current diagnostics.enabledSeverities to the server —
   *  diagnostics are computed server-side, so the server needs to know
   *  about this whenever it changes, not just at startup. The server
   *  re-runs diagnostics for every open document on receiving this, so
   *  the change is visible immediately, not just on the next edit. */
  private sendDiagnosticSettings() {
    const enabledSeverities = vscode.workspace
      .getConfiguration(this.extSection)
      .get<string[]>(this.diagnosticsSeverityKey, DEFAULT_ENABLED_SEVERITIES)

    this.client.sendNotification('scsIntellisense/updateDiagnosticSettings', {
      enabledSeverities,
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
          `SCS IntelliSense: failed to update the schema database — ${result.message}`
        )
        return
      }

      vscode.window.showInformationMessage(
        result.changed
          ? 'SCS IntelliSense: schema database updated.'
          : 'SCS IntelliSense: schema database is already up to date.'
      )
    } catch (err) {
      vscode.window.showErrorMessage(
        `SCS IntelliSense: failed to update the schema database — ${String(err)}`
      )
    }
  }
}
