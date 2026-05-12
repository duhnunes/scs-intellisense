import path from 'node:path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );
  
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc }
  };
  
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'sii' }
    ]
  };
  
  const client = new LanguageClient(
    'scsintellisense',
    'SCS-Intellisense',
    serverOptions,
    clientOptions
  );

  context.subscriptions.push(client);
  client.start();

  vscode.window.showInformationMessage("SCS-Intellisense client started");
}

export function deactivate() {}
