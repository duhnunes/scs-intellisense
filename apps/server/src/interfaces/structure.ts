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
  /** "x" -> "mod_name" */
  | 'string'
  /** x -> 1.0 // Using normal float-notation | &3f800000 // using ieee754 hexa notation */
  | 'float'
  /** (x, y) -> (1.0, 2.0) */
  | 'float2'
  /** (x, y, z) -> (1.0, 5.0, 3.0) */
  | 'float3'
  /** (x, y, z, w) -> (1.0, 5.0, 3.0, 9.0) */
  | 'float4'
  /** (z, y, z)(w; x, y, z) -> (0, 0, 0) (1; 0, 0, 0) */
  | 'placement'
  /** x -> 10 */
  | 'fixed'
  /** (x, y) -> (10, 22) */
  | 'fixed2'
  /** (x, y, z) -> (10, 22, 33) */
  | 'fixed3'
  /** (x, y, z, w) -> (10, 22, 33, 44) */
  | 'fixed4'
  /** (x, y) -> (20, 69) */
  | 'int2'
  /** (w, x, y, z) -> (1.0, 0.0, 0.0, 0.0) */
  | 'quaternion'
  /** x -> -15 */
  | 's16'
  /** x -> -15 */
  | 's32'
  /** x -> -15 */
  | 's64'
  /** x -> 15 */
  | 'u16'
  /** x -> 15 */
  | 'u32'
  /** x -> 15 */
  | 'u64'
  /** x -> true/false */
  | 'bool'
  /** x -> value -> Token is a string of maximum length of 12 characters, only lowercase alphanumeric characters and underscore can be used `a-z0-9_` */
  | 'token'
  /** x -> .some.nameless.unit -> refers to unit defined within the same SiiNunit */
  | 'owner_ptr'
  /** x -> some.named.unit -> refers to a named unit that is defined elsewhere */
  | 'link_ptr'
  /** "x" -> "/path/to/some/resource.pma" -> is typically used to bind animations to animated models. The syntax is the same as for 'string' type attributes. */
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

/**
 * A top-level `@include "path.sui"` directive — one that appears as a
 * sibling of unit definitions, directly inside the SiiNunit root, rather
 * than inside a unit's body (where it's represented as an SiiAttribute
 * with kind 'include' instead).
 */
export interface SiiInclude {
  kind: 'include'
  path: string
  range: SiiRange
  keyRange: SiiRange
  valueRange: SiiRange
}

export type SiiSeverity = 'error' | 'warning' | 'information' | 'hint'

export interface SiiIssue {
  message: string
  range: SiiRange
  /** Defaults to 'error' when omitted — every issue reader.ts and
   *  rules.ts produce today is a certainty ("this breaks the mod"), so
   *  none of them set this explicitly yet. */
  severity?: SiiSeverity
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
  includes: SiiInclude[]
  comments: SiiComment[]
  issues: SiiIssue[]
}

export interface ReadSiiOptions {
  normalizeLineEndings?: boolean
}

export type AttributeType = SiiValueType

export interface AttributeDef {
  key: string
  type: AttributeType | AttributeType[] | undefined
  isArray: boolean
  arrayElementType: AttributeType | AttributeType[] | undefined
  description: string
}

export interface ClassDef {
  className: string
  description: string
  attributes: AttributeDef[]
}

export interface SiiClass {
  className: string
  unitName: string
  attributes: AttributeDef[]
}
