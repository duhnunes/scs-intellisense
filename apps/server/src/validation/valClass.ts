import type { ParsedClass } from '../interfaces/parser'
import type { ValidationError } from '../interfaces/validation'

export function validateClass(parsed: ParsedClass): ValidationError[] {
  const errors: ValidationError[] = []

  // className length
  if (parsed.className.length === 0) {
    errors.push({
      message: 'ClassName must no be empty',
      start: parsed.classNameStart,
      end: parsed.classNameEnd,
    })
  }

  // unitName tokens
  const tokens = parsed.unitName.split('.')
  let runningOffset = parsed.unitNameStart
  tokens.forEach((token, idx) => {
    const tokenStart = runningOffset
    const tokenEnd = tokenStart + token.length

    if (token.length > 12) {
      errors.push({
        message: `UnitName token exceeds 12 characters: "${token}`,
        start: tokenStart,
        end: tokenEnd,
      })
    }
    if (!/^[a-z0-9_]*$/.test(token)) {
      errors.push({
        message: `UnitName token contains invalid characters: "${token}`,
        start: tokenStart,
        end: tokenEnd,
      })
    }
    if (/[A-Z]/.test(token)) {
      errors.push({
        message: `UnitName token contains uppercase letters: ${token}`,
        start: tokenStart,
        end: tokenEnd,
      })
    }
    if (token.length === 0 && idx !== 0) {
      errors.push({
        message: `UnitName must not contain empty tokens (consecutive dots)`,
        start: tokenStart,
        end: tokenEnd,
      })
    }

    runningOffset += token.length + 1
  })

  // colonPos
  if (parsed.colonPos === undefined) {
    errors.push({
      message: "Missing ':' between className and unitName",
      start: parsed.classNameEnd,
      end: parsed.unitNameStart,
    })
  }

  return errors
}
