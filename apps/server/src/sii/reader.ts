import { collectSiiValueParts, inferSiiValueType } from './value'
import type {
  ReadSiiOptions,
  SiiAttribute,
  SiiComment,
  SiiCommentKind,
  SiiDocument,
  SiiIssue,
  SiiRange,
  SiiUnit,
} from '../interfaces/sii'

export function normalizeSiiText(text: string): string {
  if (!text) return text
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  return withoutBom.replace(/\r\n/g, '\n')
}

/** Finds every comment while respecting quoted strings and escapes. */
export function scanSiiComments(text: string): SiiComment[] {
  const comments: SiiComment[] = []
  let quote: '"' | "'" | undefined
  let escaped = false
  let cursor = 0

  while (cursor < text.length) {
    const current = text[cursor] ?? ''
    const next = text[cursor + 1] ?? ''

    if (quote) {
      if (escaped) escaped = false
      else if (current === '\\') escaped = true
      else if (current === quote) quote = undefined
      cursor++
      continue
    }

    if (current === '"' || current === "'") {
      quote = current
      cursor++
      continue
    }

    if (current === '/' && next === '/') {
      cursor = readLineComment(text, cursor, 'line', comments)
      continue
    }

    if (current === '#') {
      cursor = readLineComment(text, cursor, 'hash', comments)
      continue
    }

    if (current === '/' && next === '*') {
      cursor = readBlockComment(text, cursor, comments)
      continue
    }

    cursor++
  }

  return comments
}

/** Masks comments without changing any character offsets. */
export function maskSiiComments(text: string): string {
  const comments = scanSiiComments(text)
  if (comments.length === 0) return text

  let cursor = 0
  let masked = ''
  for (const comment of comments) {
    masked += text.slice(cursor, comment.range.start)
    masked += text
      .slice(comment.range.start, comment.range.end)
      .replace(/[^\r\n]/g, ' ')
    cursor = comment.range.end
  }
  return masked + text.slice(cursor)
}

/** Reads a full SiiNunit document. It never throws for malformed source. */
export function readSiiDocument(
  input: string,
  options: ReadSiiOptions = {}
): SiiDocument {
  const text = prepareText(input, options)
  const reader = new SiiReader(text, 'sii')

  reader.skipTrivia()
  const magicStart = reader.position
  const magicMark = reader.readExactWord('SiiNunit')
  if (!magicMark) {
    reader.issue(
      'Expected SiiNunit document marker',
      magicStart,
      magicStart + 1
    )
    return reader.document()
  }

  reader.skipTrivia()
  const rootOpen = reader.position
  if (!reader.consume('{')) {
    reader.issue("Expected '{' after SiiNunit", rootOpen, rootOpen + 1)
    return reader.document({
      magicMark: {
        text: 'SiiNunit',
        range: range(magicStart, reader.position),
      },
    })
  }

  const units = reader.readUnits(true)
  const rootEnd = reader.position
  return reader.document({
    magicMark: { text: 'SiiNunit', range: range(magicStart, magicStart + 8) },
    rootRange: range(rootOpen, rootEnd),
    units,
  })
}

/**
 * Reads a SCS document. SUI is accepted for compatibility, while SII remains
 * the canonical API exposed by `readSiiDocument`.
 */
export function readScsDocument(
  input: string,
  mode: 'sii' | 'sui',
  options: ReadSiiOptions = {}
): SiiDocument {
  return mode === 'sii'
    ? readSiiDocument(input, options)
    : readSuiDocument(input, options)
}

function readSuiDocument(input: string, options: ReadSiiOptions): SiiDocument {
  const text = prepareText(input, options)
  const reader = new SiiReader(text, 'sui')
  const units = reader.readUnits(false)
  return reader.document({ units })
}

function prepareText(input: string, options: ReadSiiOptions): string {
  return options.normalizeLineEndings === false
    ? input
    : normalizeSiiText(input)
}

class SiiReader {
  private readonly masked: string
  private readonly comments: SiiComment[]
  private readonly issues: SiiIssue[] = []
  private readonly mode: 'sii' | 'sui'
  private positionValue = 0

  constructor(
    private readonly text: string,
    mode: 'sii' | 'sui'
  ) {
    this.mode = mode
    this.comments = scanSiiComments(text)
    this.masked = maskComments(text, this.comments)
  }

  get position(): number {
    return this.positionValue
  }

  document(
    values: Partial<Pick<SiiDocument, 'magicMark' | 'rootRange' | 'units'>> = {}
  ): SiiDocument {
    return {
      mode: this.mode,
      text: this.text,
      units: values.units ?? [],
      comments: this.comments,
      issues: this.issues,
      ...(values.magicMark ? { magicMark: values.magicMark } : {}),
      ...(values.rootRange ? { rootRange: values.rootRange } : {}),
    }
  }

  issue(message: string, start: number, end: number): void {
    const safeStart = clamp(start, 0, this.text.length)
    const safeEnd = clamp(Math.max(end, safeStart), safeStart, this.text.length)
    this.issues.push({ message, range: range(safeStart, safeEnd) })
  }

  skipTrivia(): void {
    while (
      this.positionValue < this.masked.length &&
      isWhitespace(this.current())
    ) {
      this.positionValue++
    }
  }

  readExactWord(word: string): boolean {
    if (
      this.masked.slice(
        this.positionValue,
        this.positionValue + word.length
      ) !== word
    )
      return false
    const after = this.masked[this.positionValue + word.length]
    if (after && isNameCharacter(after)) return false
    this.positionValue += word.length
    return true
  }

  consume(character: string): boolean {
    if (this.current() !== character) return false
    this.positionValue++
    return true
  }

  readUnits(stopAtClosingBrace: boolean): SiiUnit[] {
    const units: SiiUnit[] = []

    while (this.positionValue < this.masked.length) {
      this.skipTrivia()
      if (this.positionValue >= this.masked.length) break

      if (this.current() === '}') {
        if (stopAtClosingBrace) {
          this.positionValue++
          return units
        }
        this.issue("Unexpected '}'", this.positionValue, this.positionValue + 1)
        this.positionValue++
        continue
      }

      const unit = this.readUnit()
      if (unit) units.push(unit)
      else this.recoverToNextLine()
    }

    if (stopAtClosingBrace)
      this.issue(
        "Expected '}' to close SiiNunit",
        this.positionValue,
        this.positionValue
      )
    return units
  }

  private readUnit(): SiiUnit | undefined {
    const start = this.positionValue
    const classNameRange = this.readClassNameRange()
    if (!classNameRange) {
      this.issue('Expected className', start, start + 1)
      return undefined
    }

    const className = this.text.slice(classNameRange.start, classNameRange.end)
    this.validateClassName(className, classNameRange.start)
    this.skipHorizontalTrivia()
    const colonStart = this.positionValue
    if (!this.consume(':')) {
      this.issue(
        "Expected ':' between className and unitName",
        colonStart,
        colonStart + 1
      )
      return {
        kind: 'unit',
        className,
        unitName: '',
        range: range(start, this.positionValue),
        classNameRange,
        colonRange: range(colonStart, colonStart + 1),
        unitNameRange: range(this.positionValue, this.positionValue),
        bodyRange: range(this.positionValue, this.positionValue),
        attributes: [],
      }
    }

    this.skipHorizontalTrivia()
    const unitNameRange = this.readUnitNameRange()
    if (!unitNameRange) {
      this.issue(
        'Invalid unitName format',
        this.positionValue,
        this.positionValue + 1
      )
      return {
        kind: 'unit',
        className,
        unitName: '',
        range: range(start, this.positionValue),
        classNameRange,
        colonRange: range(colonStart, colonStart + 1),
        unitNameRange: range(this.positionValue, this.positionValue),
        bodyRange: range(this.positionValue, this.positionValue),
        attributes: [],
      }
    }

    const unitName = this.text.slice(unitNameRange.start, unitNameRange.end)
    this.validateUnitName(unitName, unitNameRange.start)

    this.skipTrivia()
    const bodyOpen = this.positionValue
    if (!this.consume('{')) {
      this.issue("Expected '{' after unitName", bodyOpen, bodyOpen + 1)
      return {
        kind: 'unit',
        className,
        unitName,
        range: range(start, this.positionValue),
        classNameRange,
        colonRange: range(colonStart, colonStart + 1),
        unitNameRange,
        bodyRange: range(bodyOpen, bodyOpen),
        attributes: [],
      }
    }

    const attributes = this.readAttributes()
    const bodyEnd = this.positionValue
    const isClosed = this.masked[bodyEnd] === '}'
    if (isClosed) this.positionValue++
    else this.issue("Expected '}' to close unit", bodyEnd, bodyEnd)

    return {
      kind: 'unit',
      className,
      unitName,
      range: range(start, this.positionValue),
      classNameRange,
      colonRange: range(colonStart, colonStart + 1),
      unitNameRange,
      bodyRange: range(bodyOpen + 1, bodyEnd),
      attributes,
    }
  }

  private readAttributes(): SiiAttribute[] {
    const attributes: SiiAttribute[] = []

    while (this.positionValue < this.masked.length) {
      this.skipTrivia()
      if (this.positionValue >= this.masked.length || this.current() === '}')
        break

      const attribute = this.readAttribute()
      if (attribute) attributes.push(attribute)
      else this.recoverToNextLine()
    }

    return attributes
  }

  private readAttribute(): SiiAttribute | undefined {
    const start = this.positionValue
    const isInclude = this.isIncludeDirective()
    const keyRange = isInclude
      ? this.readIncludeRange()
      : this.readAttributeKeyRange()
    if (!keyRange) {
      this.issue('Expected attribute key', start, start + 1)
      return undefined
    }

    const key = this.text
      .slice(keyRange.start, keyRange.end)
      .replace(/\s*\[\s*\d*\s*\]$/, '')
    this.skipHorizontalTrivia()

    if (isInclude) {
      const valueRange = this.readValueRange()
      return this.makeAttribute({
        kind: 'include',
        key: '@include',
        isArray: false,
        range: range(start, valueRange.end),
        keyRange,
        valueRange,
      })
    }

    const colonStart = this.positionValue
    if (!this.consume(':')) {
      this.issue("Expected ':' after attribute key", colonStart, colonStart + 1)
      return undefined
    }

    const valueRange = this.readValueRange()
    return this.makeAttribute({
      kind: 'attribute',
      key,
      isArray: /\[\s*\d*\s*\]$/.test(
        this.text.slice(keyRange.start, keyRange.end)
      ),
      range: range(start, valueRange.end),
      keyRange,
      colonRange: range(colonStart, colonStart + 1),
      valueRange,
    })
  }

  private makeAttribute(
    attribute: Omit<SiiAttribute, 'valueType' | 'valueParts'>
  ): SiiAttribute {
    const valueType = inferSiiValueType(
      this.text.slice(attribute.valueRange.start, attribute.valueRange.end)
    )
    return {
      ...attribute,
      valueType,
      valueParts: collectSiiValueParts(
        this.text,
        attribute.valueRange,
        valueType
      ),
    }
  }

  private readIncludeRange(): SiiRange {
    const start = this.positionValue
    this.positionValue += '@include'.length
    return range(start, this.positionValue)
  }

  private isIncludeDirective(): boolean {
    if (!this.masked.startsWith('@include', this.positionValue)) return false
    const after = this.masked[this.positionValue + '@include'.length] ?? ''
    return !after || isWhitespace(after)
  }

  private readAttributeKeyRange(): SiiRange | undefined {
    const start = this.positionValue
    while (isAttributeCharacter(this.current())) this.positionValue++
    if (this.positionValue === start) return undefined

    this.skipHorizontalTrivia()
    if (this.current() === '[') {
      this.positionValue++
      while (/\d/.test(this.current())) this.positionValue++
      this.skipHorizontalTrivia()
      if (!this.consume(']')) {
        this.issue(
          "Expected ']' after array attribute key",
          this.positionValue,
          this.positionValue + 1
        )
      }
    }

    return range(start, this.positionValue)
  }

  private readValueRange(): SiiRange {
    this.skipHorizontalTrivia()
    const start = this.positionValue
    let quote: '"' | "'" | undefined
    let escaped = false
    let parentheses = 0

    while (this.positionValue < this.masked.length) {
      const current = this.current()
      const next = this.masked[this.positionValue + 1] ?? ''

      if (quote) {
        if (escaped) escaped = false
        else if (current === '\\') escaped = true
        else if (current === quote) quote = undefined
        this.positionValue++
        continue
      }

      if (current === '"' || current === "'") {
        quote = current
        this.positionValue++
        continue
      }
      if (current === '(') parentheses++
      else if (current === ')' && parentheses > 0) parentheses--

      if (
        current === '\n' ||
        current === '\r' ||
        (current === '}' && parentheses === 0) ||
        (current === '/' && next === '*' && parentheses === 0)
      )
        break

      this.positionValue++
    }

    let end = this.positionValue
    while (end > start && isWhitespace(this.masked[end - 1] ?? '')) end--
    return range(start, end)
  }

  /**
   * Reads the className "raw", i.e. greedily up to whitespace/`:`/`{`/`}`,
   * regardless of whether every character is actually valid. This mirrors
   * readUnitNameRange() and is deliberate: if we stopped at the first
   * invalid character (e.g. '@'), the cursor would get stuck right on top
   * of it, `:` would never be found, and recoverToNextLine() would end up
   * swallowing the real ':', unitName and opening '{' on that line —
   * desyncing brace matching for the rest of the document. Reading the
   * whole malformed token keeps the parser (and therefore highlighting)
   * in sync; validateClassName() below still reports the bad characters.
   */
  private readClassNameRange(): SiiRange | undefined {
    const start = this.positionValue
    while (
      this.positionValue < this.masked.length &&
      !isWhitespace(this.current()) &&
      this.current() !== ':' &&
      this.current() !== '{' &&
      this.current() !== '}'
    )
      this.positionValue++
    return this.positionValue > start
      ? range(start, this.positionValue)
      : undefined
  }

  private validateClassName(className: string, start: number): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(className)) {
      this.issue(
        `Invalid className: "${className}"`,
        start,
        start + className.length
      )
    }
  }

  private readUnitNameRange(): SiiRange | undefined {
    const start = this.positionValue
    while (
      this.positionValue < this.masked.length &&
      !isWhitespace(this.current()) &&
      this.current() !== '{' &&
      this.current() !== '}'
    )
      this.positionValue++
    return this.positionValue > start
      ? range(start, this.positionValue)
      : undefined
  }

  private validateUnitName(unitName: string, start: number): void {
    let offset = start
    for (const token of unitName.split('.')) {
      const tokenRange = range(offset, offset + token.length)
      if (token.length > 12)
        this.issues.push({
          message: `UnitName token exceeds 12 characters: "${token}"`,
          range: tokenRange,
        })
      if (!/^[a-z0-9_]*$/.test(token)) {
        this.issues.push({
          message: /[A-Z]/.test(token)
            ? `UnitName token contains uppercase letters: "${token}"`
            : `UnitName token contains invalid characters: "${token}"`,
          range: tokenRange,
        })
      }
      if (token.length === 0 && offset !== start)
        this.issues.push({
          message: 'UnitName must not contain empty tokens (consecutive dots)',
          range: tokenRange,
        })
      offset += token.length + 1
    }
  }

  private skipHorizontalTrivia(): void {
    while (
      this.positionValue < this.masked.length &&
      isHorizontalWhitespace(this.current())
    ) {
      this.positionValue++
    }
  }

  private recoverToNextLine(): void {
    while (
      this.positionValue < this.masked.length &&
      this.current() !== '\n' &&
      this.current() !== '}'
    )
      this.positionValue++
    if (this.current() === '\n') this.positionValue++
  }

  private current(): string {
    return this.masked[this.positionValue] ?? ''
  }
}

function readLineComment(
  text: string,
  start: number,
  kind: Extract<SiiCommentKind, 'line' | 'hash'>,
  comments: SiiComment[]
): number {
  let end = start
  while (end < text.length && text[end] !== '\n') end++
  comments.push({ kind, range: range(start, end) })
  return end
}

function readBlockComment(
  text: string,
  start: number,
  comments: SiiComment[]
): number {
  let cursor = start + 2
  let depth = 1
  while (cursor < text.length && depth > 0) {
    if (text[cursor] === '/' && text[cursor + 1] === '*') {
      depth++
      cursor += 2
    } else if (text[cursor] === '*' && text[cursor + 1] === '/') {
      depth--
      cursor += 2
    } else cursor++
  }
  comments.push({ kind: 'block', range: range(start, cursor) })
  return cursor
}

function maskComments(text: string, comments: SiiComment[]): string {
  let cursor = 0
  let masked = ''
  for (const comment of comments) {
    masked += text.slice(cursor, comment.range.start)
    masked += text
      .slice(comment.range.start, comment.range.end)
      .replace(/[^\r\n]/g, ' ')
    cursor = comment.range.end
  }
  return masked + text.slice(cursor)
}

function isWhitespace(character: string): boolean {
  return /\s/.test(character)
}

function isHorizontalWhitespace(character: string): boolean {
  return character === ' ' || character === '\t'
}

function isNameCharacter(character: string): boolean {
  return /[A-Za-z0-9_.-]/.test(character)
}

function isAttributeCharacter(character: string): boolean {
  return /[A-Za-z0-9_.-]/.test(character)
}

function range(start: number, end: number): SiiRange {
  return { start, end }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
