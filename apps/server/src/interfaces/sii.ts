/** A half-open character range in the normalized source text: [start, end). */
export interface SiiRange {
  start: number
  end: number
}

export type SiiCommentKind = 'line' | 'hash' | 'block'

export interface SiiComment {
  kind: SiiCommentKind
  range: SiiRange
}

export type SiiValueType =
  | 'string'
  | 'float'
  | 'float2'
  | 'float3'
  | 'float4'
  | 'placement'
  | 'fixed'
  | 'fixed2'
  | 'fixed3'
  | 'fixed4'
  | 'int2'
  | 'quaternion'
  | 's16'
  | 's32'
  | 's64'
  | 'u16'
  | 'u32'
  | 'u64'
  | 'bool'
  | 'token'
  | 'owner_ptr'
  | 'link_ptr'
  | 'resource_tie'

/**
 * Subranges that make up a value. They let consumers such as semantic
 * highlighting work without re-scanning the value text.
 */
export interface SiiValuePart {
  kind: 'number' | 'segment'
  range: SiiRange
}

export interface SiiAttribute {
  kind: 'attribute' | 'include'
  key: string
  isArray: boolean
  range: SiiRange
  keyRange: SiiRange
  colonRange?: SiiRange
  valueRange: SiiRange
  valueType: SiiValueType
  valueParts: SiiValuePart[]
}

export interface SiiUnit {
  kind: 'unit'
  className: string
  unitName: string
  range: SiiRange
  classNameRange: SiiRange
  colonRange: SiiRange
  unitNameRange: SiiRange
  bodyRange: SiiRange
  attributes: SiiAttribute[]
}

export interface SiiIssue {
  message: string
  range: SiiRange
}

export interface SiiMagicMark {
  text: 'SiiNunit'
  range: SiiRange
}

/**
 * The reusable, source-oriented representation of an SII document.
 * All ranges refer to `text`, which has normalized line endings and no BOM.
 */
export interface SiiDocument {
  mode: 'sii' | 'sui'
  text: string
  magicMark?: SiiMagicMark
  rootRange?: SiiRange
  units: SiiUnit[]
  comments: SiiComment[]
  issues: SiiIssue[]
}

export interface ReadSiiOptions {
  normalizeLineEndings?: boolean
}
