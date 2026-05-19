import path from 'node:path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let output: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  output = vscode.window.createOutputChannel('SCS-Intellisense');
  context.subscriptions.push(output);

  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'sii' },
      { scheme: 'file', language: 'sui' }
    ],
    outputChannel: output
    // synchronize: {
    //   fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{sii,sui}')
    // }
  };

  client = new LanguageClient(
    'scsintellisense',
    'SCS-Intellisense',
    serverOptions,
    clientOptions
  );

  context.subscriptions.push(client);
  client.start();

  const registerLogHandler = () => {
    try {
      client?.onNotification('scsIntellisense/log', (payload: any) => {
        try {
          const p = payload as {
            timestamp?: string
            severity?: string
            code?: string
            message: string
            details?: string
            file?: string
          };
          const time = p.timestamp ?? new Date().toISOString();
          const sev = (p.severity ?? 'info').toUpperCase();
          const code = p.code ? ` ${p.code}` : '';
          const file = p.file ? `[${p.file}]` : '';
          output.appendLine(`${time} ${sev}${code}${file} - ${p.message}`);
          if (p.details) {output.appendLine(p.details);}
          output.appendLine('');
          if((p.severity ?? 'info').toLowerCase() === 'error') {output.show(true);}
        } catch (e) {
          console.error('Failed to handle scsIntellisense/log', e);
        }
      });
    } catch (e) {
      console.error('Failed to scsIntellisense/log handle', e);
    }
  };

  const anyClient = client as any;
  if (typeof anyClient.onReady === 'function') {
    try {
      const ready = anyClient.onReady();
      if (ready && typeof ready.then === 'function') {
        ready.then(registerLogHandler).catch((err: any) => {
          console.error('client.onReady rejected', err);
          setTimeout(registerLogHandler, 200);
        });
      } else {
        try { anyClient.onReady(registerLogHandler); } catch { setTimeout(registerLogHandler, 200); }
      }
    } catch {
      setTimeout(registerLogHandler, 200);
    }
  } else {
    setTimeout(registerLogHandler, 200);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('scsIntellisense.showOutput', () => {
      output.show(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('scsIntellisense.clearOutput', () => {
      output.clear();
    })
  );

  vscode.window.showInformationMessage('SCS-Intellisense client started');
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {return undefined;}
  return client.stop();
}
