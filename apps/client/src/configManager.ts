import * as vscode from 'vscode'
import type { LanguageClient } from 'vscode-languageclient/node'
import type { ExtensionLog } from './log'

const DEFAULT_ENABLED_SEVERITIES = ['error', 'warning', 'information', 'hint']

export class ConfigManager {
  private readonly extSection = 'scs-intellisense'
  private readonly semanticHighlightingKey = 'semanticHighlighting'
  private readonly diagnosticsSeverityKey = 'diagnostics.enabledSeverities'

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: LanguageClient,
    private readonly log: ExtensionLog
  ) {
    this.listenForChanges()
    this.registerCommands()
  }

  private listenForChanges() {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration(
          `${this.extSection}.${this.semanticHighlightingKey}`
        )
      ) {
        // The server stops (or starts) sending colors; nothing is written
        // to VS Code's own settings. editor.semanticHighlighting.enabled
        // is on for .sii/.sui through configurationDefaults in package.json.
        const enabled = vscode.workspace
          .getConfiguration(this.extSection)
          .get<boolean>(this.semanticHighlightingKey, true)
        this.client.sendNotification(
          'scsIntellisense/updateSemanticHighlighting',
          { enabled }
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
        this.log.warn(
          'SCHEMA_REFRESH_FAILED',
          `Refresh Schema Database failed: ${result.message}`
        )
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
      this.log.error(
        'SCHEMA_REFRESH_REQUEST_FAILED',
        'Refresh Schema Database could not reach the server',
        err
      )
      vscode.window.showErrorMessage(
        `SCS IntelliSense: failed to update the schema database — ${String(err)}`
      )
    }
  }
}
