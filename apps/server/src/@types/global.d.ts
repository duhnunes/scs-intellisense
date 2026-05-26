import type { Connection } from 'vscode-languageserver'

declare global {
  var connection: Connection | undefined
}

export {}
