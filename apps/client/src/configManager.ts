import * as vscode from 'vscode'

export class ConfigManager {
  private readonly extSection = 'scs-intellisense'
  private readonly extKey = 'semanticHighlighting'

  constructor() {
    this.applyCurrentSettings()
    this.listenForChanges()
  }

  private applyCurrentSettings() {
    const extConfig = vscode.workspace.getConfiguration(this.extSection)
    const enabled = extConfig.get<boolean>(this.extKey, true)

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
      if (e.affectsConfiguration(`${this.extSection}.${this.extKey}`)) {
        const newValue = vscode.workspace
          .getConfiguration(this.extSection)
          .get<boolean>(this.extKey, true)

        vscode.workspace
          .getConfiguration('editor')
          .update(
            'semanticHighlighting.enabled',
            newValue,
            vscode.ConfigurationTarget.Global
          )
      }
    })
  }
}
