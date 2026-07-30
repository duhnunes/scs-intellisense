import type { SiiRange, SiiValuePart, SiiValueType } from '../interfaces/structure'

const DECIMAL_NUMBER = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?'
const DECIMAL_NUMBER_RE = new RegExp(`^${DECIMAL_NUMBER}$`)
const HEX_NUMBER_RE = /^&[0-9a-fA-F]+$/
const NUMBER_PART_RE = new RegExp(`&[0-9a-fA-F]+|${DECIMAL_NUMBER}`, 'g')
const NUMERIC_VALUE_TYPES = new Set<SiiValueType>([
  'float',
  'float2',
  'float3',
  'float4',
  'placement',
  'fixed',
  'fixed2',
  'fixed3',
  'fixed4',
  'int2',
  'quaternion',
  's16',
  's32',
  's64',
  'u16',
  'u32',
  'u64',
])

export function inferSiiValueType(value: string): SiiValueType {
  const text = value.trim()
  if (!text) return 'string'

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  )
    return 'string'

  if (text === 'true' || text === 'false') return 'bool'

  if (text.startsWith('(') && text.endsWith(')')) {
    if (/\)\s*\(/.test(text)) return 'placement'

    const values = text
      .slice(1, -1)
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter(Boolean)

    if (values.length > 0 && values.every(isNumberLike)) {
      if (values.length === 2) return 'float2'
      if (values.length === 3) return 'float3'
      if (values.length === 4) return 'float4'
      return 'float'
    }
  }

  if (isNumberLike(text)) return 'float'
  if (/^\.[a-z0-9_.]+$/.test(text)) return 'owner_ptr'
  if (/^[a-z0-9_.]+$/.test(text))
    return text.includes('.') ? 'link_ptr' : 'token'

  return 'string'
}

export function collectSiiValueParts(
  source: string,
  range: SiiRange,
  valueType: SiiValueType
): SiiValuePart[] {
  const value = source.slice(range.start, range.end)

  if (isNumericValueType(valueType) && value.trim().startsWith('(')) {
    return collectMatches(value, range.start, NUMBER_PART_RE, 'number')
  }

  if (
    valueType === 'token' ||
    valueType === 'owner_ptr' ||
    valueType === 'link_ptr'
  ) {
    return collectMatches(value, range.start, /[a-z0-9_]+/gi, 'segment')
  }

  return []
}

export function isNumericValueType(valueType: SiiValueType): boolean {
  return NUMERIC_VALUE_TYPES.has(valueType)
}

function isNumberLike(value: string): boolean {
  return DECIMAL_NUMBER_RE.test(value) || HEX_NUMBER_RE.test(value)
}

function collectMatches(
  value: string,
  offset: number,
  expression: RegExp,
  kind: SiiValuePart['kind']
): SiiValuePart[] {
  const parts: SiiValuePart[] = []
  expression.lastIndex = 0

  for (const match of value.matchAll(expression)) {
    const index = match.index
    if (index === undefined || !match[0]) continue
    parts.push({
      kind,
      range: {
        start: offset + index,
        end: offset + index + match[0].length,
      },
    })
  }

  return parts
}
