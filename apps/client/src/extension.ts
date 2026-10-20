import path from 'node:path'
import * as vscode from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { registerBugReportCommand } from './bugReport'
import { ConfigManager } from './configManager'
import { registerFormatOnSave } from './formatOnSave'
import { ExtensionLog, type LogEntry } from './log'
import { registerWorkspaceFormatCommands } from './workspaceFormat'

let client: LanguageClient | undefined

export function activate(context: vscode.ExtensionContext) {
  const log = new ExtensionLog()
  context.subscriptions.push(log)

  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'))

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  }

  const extConfig = vscode.workspace.getConfiguration('scs-intellisense')

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'sii' },
      { scheme: 'file', language: 'sui' },
    ],
    // The LSP library's own messages (server crashes, protocol errors) go
    // to the same channel as everything else.
    outputChannel: log.channel,
    // The server has no `vscode` API of its own (it's a plain Node
    // process), so anything it needs from us — cache location, initial
    // settings — has to be handed over explicitly here. Only
    // globalStoragePath and this initial snapshot go through this path;
    // diagnostics.enabledSeverities changes later on are forwarded live
    // by ConfigManager via a notification instead (see configManager.ts).
    // Everything else here is static — changing it requires a window
    // reload, same as schema.fetchTimeoutMs.
    initializationOptions: {
      globalStoragePath: context.globalStorageUri.fsPath,
      enabledSeverities: extConfig.get('diagnostics.enabledSeverities', [
        'error',
        'warning',
        'information',
        'hint',
      ]),
      fetchTimeoutMs: extConfig.get('schema.fetchTimeoutMs', 8000),
      // EXPERIMENTAL, off by default.
      completionEnabled: extConfig.get('completion.enabled', false),
      hoverEnabled: extConfig.get('hover.enabled', false),
      formatterEnabled: extConfig.get('formatter.enabled', false),
      formatterBraceStyle: extConfig.get('formatter.braceStyle', '1tbs'),
    },
  }

  client = new LanguageClient(
    'scsintellisense',
    'SCS IntelliSense',
    serverOptions,
    clientOptions
  )

  // Registered before start(), so not even the first entries the server
  // sends while starting up are lost.
  client.onNotification('scsIntellisense/log', (entry: LogEntry) =>
    log.write(entry)
  )

  context.subscriptions.push(client)
  client.start().catch((error) => {
    log.error(
      'CLIENT_START_FAILED',
      'The language server failed to start',
      error
    )
  })

  // ConfigManager registers the "refresh schema" command, which needs to
  // send a request through `client` — so it's created only once `client`
  // exists, not before.
  new ConfigManager(context, client, log)
  registerWorkspaceFormatCommands(context, client, log)
  registerFormatOnSave(context, client)
  registerBugReportCommand(context, log)

  context.subscriptions.push(
    vscode.commands.registerCommand('scsIntellisense.showOutput', () =>
      log.channel.show(true)
    ),
    vscode.commands.registerCommand('scsIntellisense.clearOutput', () =>
      log.clear()
    )
  )

  log.info(
    'CLIENT_STARTED',
    `SCS IntelliSense ${context.extension.packageJSON.version} started (VS Code ${vscode.version})`
  )
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}
