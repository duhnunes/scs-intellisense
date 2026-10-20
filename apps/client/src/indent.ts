import * as vscode from 'vscode'

/** What the server needs to build one level of indentation. */
export type EditorIndentOptions = {
  tabSize: number
  insertSpaces: boolean
}

/**
 * The indentation VS Code uses for this document. If it's open in an
 * editor, that editor's resolved options: they include what
 * editor.detectIndentation found in the file's content (game files use
 * tabs). Otherwise the editor.tabSize / editor.insertSpaces settings for
 * the document's language, including `[sii]` overrides.
 */
export function editorIndentFor(
  document: vscode.TextDocument
): EditorIndentOptions {
  const editor = vscode.window.visibleTextEditors.find(
    (candidate) => candidate.document === document
  )
  const { tabSize, insertSpaces } = editor?.options ?? {}
  if (typeof tabSize === 'number' && typeof insertSpaces === 'boolean') {
    return { tabSize, insertSpaces }
  }
  return configuredIndent(document)
}

/** The configured indentation for a language, for files that aren't open. */
export function configuredIndent(
  scope: vscode.ConfigurationScope = { languageId: 'sii' }
): EditorIndentOptions {
  const config = vscode.workspace.getConfiguration('editor', scope)
  return {
    tabSize: config.get<number>('tabSize', 4),
    insertSpaces: config.get<boolean>('insertSpaces', true),
  }
}
