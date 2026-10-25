import * as vscode from 'vscode'
import type { LanguageClient } from 'vscode-languageclient/node'
import type { ExtensionLog } from './log'

const SECTION = 'scs-intellisense'

/**
 * Every scs-intellisense.* setting the server uses, in the shape of the
 * server's ServerSettings (apps/server/src/settings.ts). Sent at startup
 * and again on every change, so the server always has the current values.
 * The defaults repeat package.json's; the server applies its own to
 * anything missing or malformed.
 */
export function serverSettings() {
  const config = vscode.workspace.getConfiguration(SECTION)
  return {
    enabledSeverities: config.get('diagnostics.enabledSeverities', [
      'error',
      'warning',
      'information',
      'hint',
    ]),
    semanticHighlighting: config.get('semanticHighlighting', true),
    fetchTimeoutMs: config.get('schema.fetchTimeoutMs', 8000),
    completionEnabled: config.get('completion.enabled', false),
    hoverEnabled: config.get('hover.enabled', false),
    formatterEnabled: config.get('formatter.enabled', false),
    formatterBraceStyle: config.get('formatter.braceStyle', '1tbs'),
    formatterIndentUnits: config.get('formatter.indentUnits', true),
  }
}

/** The settings only the client reads, for the log. */
export function describeClientSettings(): string {
  const config = vscode.workspace.getConfiguration(SECTION)
  const onOff = (key: string, fallback: boolean) =>
    config.get<boolean>(key, fallback) ? 'on' : 'off'
  const always = config.get<string[]>('fileMoves.alwaysSave', ['.mat'])
  return `format on save: ${onOff('formatter.formatOnSave', true)}, file moves: auto save ${onOff('fileMoves.autoSave', true)} (always: ${always.join(', ') || 'none'}, above ${config.get<number>('fileMoves.saveAbove', 6)} files, notify: ${onOff('fileMoves.notify', true)})`
}

export class ConfigManager {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: LanguageClient,
    private readonly log: ExtensionLog
  ) {
    this.listenForChanges()
    this.registerCommands()
  }

  /** Any scs-intellisense.* change sends every setting again. Nothing is
   *  written to VS Code's own settings: what .sii/.sui need from them is
   *  in configurationDefaults in package.json. */
  private listenForChanges() {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration(SECTION)) return
        // The server logs its own settings (SETTINGS_UPDATED); these are
        // the client's.
        this.log.info(
          'CLIENT_SETTINGS_UPDATED',
          `Settings changed (${describeClientSettings()})`
        )
        this.client
          .sendNotification('scsIntellisense/updateSettings', serverSettings())
          .catch((error) =>
            this.log.warn(
              'SETTINGS_SEND_FAILED',
              'A settings change could not reach the server; it applies after a window reload',
              error
            )
          )
      })
    )
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
