import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'server.js').fsPath
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'plaintext' }]
  };

  const client = new LanguageClient(
    'exampleLsp',
    'Example LSP',
    serverOptions,
    clientOptions
  );

  context.subscriptions.push(client);
  client.start();
}
