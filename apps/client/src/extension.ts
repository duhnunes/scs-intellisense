import path from 'node:path'
import * as vscode from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { registerBugReportCommand } from './bugReport'
import {
  ConfigManager,
  describeClientSettings,
  serverSettings,
} from './configManager'
import { registerFormatOnSave } from './formatOnSave'
import { MoveAutoSave } from './moveAutoSave'
import { MoveUndo } from './moveUndo'
import { PathEditMarks } from './pathEditMarks'
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

  // Marks the lines whose paths the server rewrites when a file moves.
  const pathEditMarks = new PathEditMarks(log)
  // Puts the paths back if VS Code undoes the move but not the edits.
  const moveUndo = new MoveUndo(log)
  // Saves the files a move edited, and closes their tabs, past a setting.
  const moveAutoSave = new MoveAutoSave(log)
  context.subscriptions.push(pathEditMarks, moveUndo, moveAutoSave)

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'sii' },
      { scheme: 'file', language: 'sui' },
    ],
    // Files changed outside the editor (git checkout, a converter, another
    // program) reach the server's workspace index, which keeps every
    // .sii/.sui of the open folders, and the paths in .mat/.tobj files.
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        '**/*.{sii,sui,mat,tobj}'
      ),
    },
    middleware: {
      workspace: {
        willRenameFiles: async (event, next) => {
          const edit = await next(event)
          await moveUndo.remember(event, edit)
          pathEditMarks.remember(event, edit)
          moveAutoSave.remember(event, edit)
          return edit
        },
      },
    },
    // The LSP library's own messages (server crashes, protocol errors) go
    // to the same channel as everything else.
    outputChannel: log.channel,
    // The server has no `vscode` API of its own (it's a plain Node
    // process), so anything it needs from us — cache location, settings —
    // has to be handed over explicitly. The settings go here at startup
    // and again on every change (ConfigManager), so none needs a reload.
    initializationOptions: {
      globalStoragePath: context.globalStorageUri.fsPath,
      settings: serverSettings(),
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

  context.subscriptions.push(client, syncTextureFiles(client))
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
    `SCS IntelliSense ${context.extension.packageJSON.version} started (VS Code ${vscode.version}; ${describeClientSettings()})`
  )
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}

/**
 * .mat and .tobj aren't this extension's languages, so VS Code doesn't
 * send their text to the server; it would read them from disk and miss
 * unsaved changes (the paths a move just rewrote, before saving). Their
 * text goes over when it changes, and back to disk when they close.
 */
function syncTextureFiles(client: LanguageClient): vscode.Disposable {
  const isTextureFile = (document: vscode.TextDocument) =>
    document.uri.scheme === 'file' &&
    /[.](mat|tobj)$/i.test(document.uri.fsPath)
  return vscode.Disposable.from(
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      if (isTextureFile(document) && client.isRunning())
        void client.sendNotification('scsIntellisense/textureFileChanged', {
          uri: document.uri.toString(),
          text: document.getText(),
        })
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (isTextureFile(document) && client.isRunning())
        void client.sendNotification('scsIntellisense/textureFileClosed', {
          uri: document.uri.toString(),
        })
    })
  )
}
