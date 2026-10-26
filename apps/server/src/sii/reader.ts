import { collectSiiValueParts, inferSiiValueType } from './value'
import type {
  ReadSiiOptions,
  SiiAttribute,
  SiiComment,
  SiiCommentKind,
  SiiDocument,
  SiiInclude,
  SiiIssue,
  SiiIssueCode,
  SiiRange,
  SiiUnit,
} from '../interfaces/structure'

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
      'missing-siinunit',
      'Expected SiiNunit document marker',
      magicStart,
      magicStart + 1
    )
    return reader.document()
  }

  reader.skipTrivia()
  const rootOpen = reader.position
  if (!reader.consume('{')) {
    reader.issue(
      'missing-siinunit-open-brace',
      "Expected '{' after SiiNunit",
      rootOpen,
      rootOpen + 1
    )
    return reader.document({
      magicMark: {
        text: 'SiiNunit',
        range: range(magicStart, reader.position),
      },
    })
  }

  const { units, includes } = reader.readUnits(true)
  const rootEnd = reader.position

  // readUnits() stops the moment it finds the root's matching '}' — but
  // per the file format, that brace should be the last meaningful thing
  // in the file (aside from a trailing blank line, which the docs
  // explicitly recommend). Silently ignoring anything left over would
  // just make part of a file mysteriously do nothing, with no
  // explanation — most commonly because a second "SiiNunit { ... }"
  // block got pasted in by mistake. skipTrivia() already treats masked
  // comments as whitespace, so a trailing comment alone won't trigger
  // this.
  reader.skipTrivia()
  if (reader.position < text.length) {
    const isDuplicate = text.startsWith('SiiNunit', reader.position)
    reader.issue(
      isDuplicate ? 'duplicate-siinunit' : 'content-after-siinunit',
      isDuplicate
        ? 'Duplicate SiiNunit block — only one is allowed per file'
        : 'Unexpected content after the SiiNunit closing brace',
      reader.position,
      text.length
    )
  }

  return reader.document({
    magicMark: { text: 'SiiNunit', range: range(magicStart, magicStart + 8) },
    rootRange: range(rootOpen, rootEnd),
    units,
    includes,
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
  const { units, includes, attributes } = reader.readUnits(false)
  return reader.document({ units, includes, attributes })
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
    values: Partial<
      Pick<
        SiiDocument,
        'magicMark' | 'rootRange' | 'units' | 'includes' | 'attributes'
      >
    > = {}
  ): SiiDocument {
    return {
      mode: this.mode,
      text: this.text,
      units: values.units ?? [],
      includes: values.includes ?? [],
      attributes: values.attributes ?? [],
      comments: this.comments,
      issues: this.issues,
      ...(values.magicMark ? { magicMark: values.magicMark } : {}),
      ...(values.rootRange ? { rootRange: values.rootRange } : {}),
    }
  }

  issue(code: SiiIssueCode, message: string, start: number, end: number): void {
    const safeStart = clamp(start, 0, this.text.length)
    const safeEnd = clamp(Math.max(end, safeStart), safeStart, this.text.length)
    this.issues.push({ code, message, range: range(safeStart, safeEnd) })
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

  readUnits(stopAtClosingBrace: boolean): {
    units: SiiUnit[]
    includes: SiiInclude[]
    attributes: SiiAttribute[]
  } {
    const units: SiiUnit[] = []
    const includes: SiiInclude[] = []
    const attributes: SiiAttribute[] = []

    while (this.positionValue < this.masked.length) {
      this.skipTrivia()
      if (this.positionValue >= this.masked.length) break

      if (this.current() === '}') {
        if (stopAtClosingBrace) {
          this.positionValue++
          return { units, includes, attributes }
        }
        this.issue(
          'unexpected-close-brace',
          "Unexpected '}'",
          this.positionValue,
          this.positionValue + 1
        )
        this.positionValue++
        continue
      }

      // `@include` can appear as a sibling of unit definitions, directly
      // inside the SiiNunit root — not just inside a unit's body (that
      // case is handled separately, in readAttribute()). It must be
      // recognized here, before readUnit() ever sees it, or the reader
      // tries to parse "@include" itself as a className.
      if (this.isIncludeDirective()) {
        includes.push(this.readTopLevelInclude())
        continue
      }

      if (this.mode === 'sui' && !this.startsUnitHeader()) {
        const attribute = this.readAttribute()
        if (attribute) attributes.push(attribute)
        else this.recoverToNextLine()
        continue
      }

      const unit = this.readUnit()
      if (unit) units.push(unit)
      else this.recoverToNextLine()
    }

    if (stopAtClosingBrace)
      this.issue(
        'missing-siinunit-close-brace',
        "Expected '}' to close SiiNunit",
        this.positionValue,
        this.positionValue
      )
    return { units, includes, attributes }
  }

  /**
   * Whether the item at the cursor is a unit header (`class : name {`)
   * rather than an attribute (`key: value`); the two look the same up to
   * the ':'. A unit header is followed by '{', on the same line or after
   * line breaks; an attribute never is, since attributes have no braces.
   * Strings are left out of the check, as a value like `text: "{x}"`
   * contains braces. Only looks ahead — the position doesn't move.
   *
   * Used to tell units from bare attributes at the top level of a .sui,
   * and to notice a unit header inside a body, which means the previous
   * unit was never closed.
   */
  private startsUnitHeader(): boolean {
    let lineEnd = this.masked.indexOf('\n', this.positionValue)
    if (lineEnd === -1) lineEnd = this.masked.length
    const line = this.masked
      .slice(this.positionValue, lineEnd)
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '')
    if (line.includes('{')) return true

    let next = lineEnd
    while (next < this.masked.length && isWhitespace(this.masked[next] ?? ''))
      next++
    return this.masked[next] === '{'
  }

  private readUnit(): SiiUnit | undefined {
    const start = this.positionValue
    const classNameRange = this.readClassNameRange()
    if (!classNameRange) {
      this.issue('missing-class-name', 'Expected className', start, start + 1)
      return undefined
    }

    const className = this.text.slice(classNameRange.start, classNameRange.end)
    const namespaceEnd = className.lastIndexOf('::')
    const namespaceRange =
      namespaceEnd > 0
        ? range(classNameRange.start, classNameRange.start + namespaceEnd)
        : undefined
    this.skipHorizontalTrivia()
    const colonStart = this.positionValue
    if (this.consume(':')) {
      this.skipHorizontalTrivia()
    } else {
      this.issue(
        'missing-unit-colon',
        "Expected ':' between className and unitName",
        colonStart,
        colonStart + 1
      )
      // Recover instead of bailing out: a stray character typed where
      // ':' should be (e.g. ';') isn't part of the className OR the
      // unitName, so skip past just that one character and keep reading
      // the header as normal. Without this, readUnits() would retry
      // readUnit() from this exact spot, re-tokenizing leftover
      // fragments of this same line (the stray char, then
      // "prefab.house.dorime") as bogus new class names, and eventually
      // swallow the real '{' via recoverToNextLine() — the same kind of
      // brace desync the className '@' fix addressed earlier.
      // If the current character could plausibly start a unitName on
      // its own (a letter/digit/underscore, the leading '.' of a
      // nameless unit, or the '"' of a quoted name) there's nothing
      // extraneous to skip — e.g.
      // "prefab_model prefab.house.dorime {" with just a missing colon
      // and no stray character at all.
      if (
        this.positionValue < this.masked.length &&
        !isPossibleUnitNameStart(this.current()) &&
        this.current() !== '{' &&
        !isWhitespace(this.current())
      )
        this.positionValue++
      this.skipHorizontalTrivia()
    }
    const unitNameRange = this.readUnitNameRange()
    if (!unitNameRange) {
      this.issue(
        'invalid-unit-name-format',
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
        namespaceRange,
        colonRange: range(colonStart, colonStart + 1),
        unitNameRange: range(this.positionValue, this.positionValue),
        bodyRange: range(this.positionValue, this.positionValue),
        attributes: [],
      }
    }

    const unitName = this.text.slice(unitNameRange.start, unitNameRange.end)

    this.skipTrivia()
    const bodyOpen = this.positionValue
    if (!this.consume('{')) {
      this.issue(
        'missing-unit-open-brace',
        "Expected '{' after unitName",
        bodyOpen,
        bodyOpen + 1
      )
      return {
        kind: 'unit',
        className,
        unitName,
        range: range(start, this.positionValue),
        classNameRange,
        namespaceRange,
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
    // Point at the '{' that was never closed: where the '}' should go
    // can't be known, but which unit is left open can.
    else
      this.issue(
        'missing-unit-close-brace',
        "Expected '}' to close unit",
        bodyOpen,
        bodyOpen + 1
      )

    return {
      kind: 'unit',
      className,
      unitName,
      range: range(start, this.positionValue),
      classNameRange,
      namespaceRange,
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

      // A unit header inside a body means this unit's '}' is missing.
      // Without stopping here, `b : x.z {` would be read as an attribute
      // `b` of this unit and the error would go unreported. readUnit()
      // reports it; the caller then reads the next unit normally.
      if (this.startsUnitHeader()) break

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
      this.issue(
        'missing-attribute-key',
        'Expected attribute key',
        start,
        start + 1
      )
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
      this.issue(
        'missing-attribute-colon',
        "Expected ':' after attribute key",
        colonStart,
        colonStart + 1
      )
      return undefined
    }

    this.skipToValueOnNextLine()
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

  /**
   * Reads a root-level `@include "path.sui"`. Shares the same keyword and
   * value readers as the attribute-level include (readAttribute()), so a
   * `.sui` path is tokenized identically no matter where it appears.
   */
  private readTopLevelInclude(): SiiInclude {
    const start = this.positionValue
    const keyRange = this.readIncludeRange()
    this.skipHorizontalTrivia()
    const valueRange = this.readValueRange()
    const rawValue = this.text.slice(valueRange.start, valueRange.end)
    return {
      kind: 'include',
      path: rawValue.replace(/^["']|["']$/g, ''),
      range: range(start, valueRange.end),
      keyRange,
      valueRange,
    }
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
    // The key ends here unless "[...]" follows. Game files write
    // `base_color : (...)`, so the spaces before ':' are not part of it.
    const nameEnd = this.positionValue

    this.skipHorizontalTrivia()
    if (this.current() !== '[') return range(start, nameEnd)

    this.positionValue++
    while (/\d/.test(this.current())) this.positionValue++
    this.skipHorizontalTrivia()
    if (!this.consume(']')) {
      this.issue(
        'missing-array-close-bracket',
        "Expected ']' after array attribute key",
        this.positionValue,
        this.positionValue + 1
      )
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
        const lineEnd = this.unclosedQuoteLineEnd(this.positionValue)
        if (lineEnd !== undefined) {
          // The whole unclosed text, to the end of its line, as
          // TypeScript marks an unterminated string.
          let textEnd = lineEnd
          while (
            textEnd > this.positionValue + 1 &&
            isWhitespace(this.masked[textEnd - 1] ?? '')
          )
            textEnd--
          this.issue(
            'unclosed-value-quote',
            'This quote is never closed, so the text runs on into the next lines',
            this.positionValue,
            textEnd
          )
          // The value ends with its line, so the rest of the file is read
          // as it's written instead of as part of this text.
          this.positionValue = lineEnd
          break
        }
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
   * Where the line of the quote at `quoteAt` ends, when that quote is
   * never closed; undefined when it is. A string may span lines: 721 do in
   * ATS 1.61, UI markup (`"<img ...><ret>` then `<offset ...>` lines). One
   * that never closes runs to the end of the file, or swallows lines that
   * read as SII: a `}`, or a `key: value` (no line inside those 721
   * strings starts with `}`; the one that looks like `key:` is a list,
   * `bones:root; bones: base; ...`, hence no `;`). Without this, the error
   * was a missing `}` at the end of the file.
   */
  private unclosedQuoteLineEnd(quoteAt: number): number | undefined {
    const text = this.masked
    const quote = text[quoteAt]
    let close = quoteAt + 1
    let escaped = false
    for (; close < text.length; close++) {
      if (escaped) escaped = false
      else if (text[close] === '\\') escaped = true
      else if (text[close] === quote) break
    }
    const lineEnd = text.indexOf('\n', quoteAt)
    if (lineEnd < 0 || lineEnd > close) return undefined // closed on its line
    if (close >= text.length) return lineEnd
    const swallowed = text.slice(lineEnd + 1, close).split('\n')
    return swallowed.some((line) => {
      const trimmed = line.trim()
      return (
        trimmed.startsWith('}') ||
        (/^[A-Za-z_][A-Za-z0-9_]*(\[\d*\])?\s*:/.test(trimmed) &&
          !trimmed.includes(';'))
      )
    })
      ? lineEnd
      : undefined
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
   * in sync. Whether the captured text is actually a *valid* className is
   * a business-rule concern, not a tokenization one — see
   * validateClassName() in validation/rules.ts, which runs against the
   * classNameRange this method returns.
   *
   * A "::" belongs to the className rather than ending it: some game
   * files prefix the class with a namespace (`ui::text : ...`,
   * `hcd::on_job : ...`). Only a single ':' separates className from
   * unitName.
   */
  private readClassNameRange(): SiiRange | undefined {
    const start = this.positionValue
    while (
      this.positionValue < this.masked.length &&
      !isWhitespace(this.current()) &&
      this.current() !== '{' &&
      this.current() !== '}'
    ) {
      if (this.current() === ':') {
        if (this.masked[this.positionValue + 1] !== ':') break
        // Swallow the whole run of colons, so a typo like "a:::b" stays
        // one (invalid) className instead of desyncing the header.
        while (this.current() === ':') this.positionValue++
        continue
      }
      this.positionValue++
    }
    return this.positionValue > start
      ? range(start, this.positionValue)
      : undefined
  }

  /**
   * Reads the unitName raw, the same way readClassNameRange() does.
   * Validity (token length, casing, allowed characters) is checked later
   * in validation/rules.ts against the returned range, not here.
   */
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

  /**
   * After `key:`, a value can start on the next line: the game's own
   * share/ui/template/button.sii writes `n_pml:` and then the string on
   * the line below. Only a quoted string is taken from the next line: no
   * key starts with '"', so it can't be the next attribute, while `key:`
   * followed by another `key2: x` line stays an empty value.
   */
  private skipToValueOnNextLine(): void {
    let next = this.positionValue
    while (isHorizontalWhitespace(this.masked[next] ?? '')) next++
    if (this.masked[next] === '\r') next++
    if (this.masked[next] !== '\n') return
    next++
    while (isHorizontalWhitespace(this.masked[next] ?? '')) next++
    if (this.masked[next] === '"') this.positionValue = next
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

function isPossibleUnitNameStart(character: string): boolean {
  return /[A-Za-z0-9_."]/.test(character)
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
