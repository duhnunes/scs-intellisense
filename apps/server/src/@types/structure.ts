export type AttributeType =
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

  export interface AttributeDef {
    key: string
    type: AttributeType | AttributeType[]
    isArray?: boolean
    arrayElementType?: AttributeType
    description: string
  }

  export interface ClassDef {
    className: string
    attributes: AttributeDef[]
  }

export interface SiiFile {
  magicMark: 'SiiNunit'
  classes: SiiClass[]
}

export interface SiiClass {
  className: string
  unitName: string
  attributes: AttributeDef[]
}
