import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import schema from '../schemas/sii.schema.json'
import Ajv from 'ajv'
import { parseDocument } from '../parser/docParser'

const ajv = new Ajv()
const validate = ajv.compile(schema)

export function validateDocument(doc: TextDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const parsed = parseDocument(doc.getText(), { uri: doc.uri }, diagnostics)

  const valid = validate(parsed)
  if (!valid && validate.errors) {
    console.log('AJV ERRORS:', validate.errors)
    for (const err of validate.errors) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: doc.positionAt(0),
          end: doc.positionAt(0),
        },
        message: `Validation error: ${err.message}`,
        source: 'sii.schema',
      })
    }
  }

  return diagnostics
}
